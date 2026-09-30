import { isBlockedAddress, requestStatus } from './safe-request';

/**
 * What the network said about a link, as far as it can be trusted.
 *
 * `unknown` is a real answer and the common one when something went wrong: a
 * timeout says the server was slow, or the runner was, or a rate limit was hit.
 * Reporting it as broken made the rule non-deterministic — three identical runs
 * over one repository gave 1, 4 and 4 findings.
 */
export type LinkOutcome = 'broken' | 'ok' | 'unknown';

type Request = (url: string, method: 'HEAD' | 'GET', timeoutMs: number) => Promise<number>;

export interface VerifierOptions {
    request?: Request;
    /** Requests in flight to one host. Polite to the host, and enough to be quick. */
    perHost?: number;
    /** Requests in flight in all. */
    total?: number;
    timeoutMs?: number;
    /** How long an answer is believed. An editor keeps one verifier for hours. */
    ttlMs?: number;
    /** What one file may spend when no run-wide budget is in force. */
    fileBudgetMs?: number;
    /** Consecutive failures that mark a host as not answering. */
    tripAfter?: number;
    now?: () => number;
}

/**
 * Checks whether the links in a document resolve, without letting that become the
 * slowest thing the tool does.
 *
 * It used to go through them one at a time, each a HEAD and then often a GET at
 * five seconds apiece, and forgot every answer. One 9.6KB report with 85 links to
 * a single host cost 49 seconds and produced no findings; a whole repository took
 * 50 seconds with the rule on and 1 with it off. So: a URL is asked about once, a
 * host is asked a few things at a time, a host that stops answering is left
 * alone, and there is a budget — with a count of what it left unchecked, because
 * a link nobody looked at must not read as a link that passed.
 */
export class LinkVerifier {
    private readonly request: Request;
    private readonly perHost: number;
    private readonly timeoutMs: number;
    private readonly ttlMs: number;
    private readonly fileBudgetMs: number;
    private readonly tripAfter: number;
    private readonly now: () => number;

    private readonly answered = new Map<string, { at: number; outcome: LinkOutcome }>();
    private readonly inFlight = new Map<string, Promise<LinkOutcome>>();
    private readonly hosts = new Map<string, HostState>();
    private readonly overall: Semaphore;

    private runBudgetMs: number | null = null;
    private runDeadline: number | null = null;
    /** Links that were not asked about, because the budget ran out or the host went quiet. */
    skipped = 0;

    constructor(options: VerifierOptions = {}) {
        this.request = options.request ?? requestStatus;
        this.perHost = options.perHost ?? 4;
        this.timeoutMs = options.timeoutMs ?? 5000;
        this.ttlMs = options.ttlMs ?? 10 * 60_000;
        this.fileBudgetMs = options.fileBudgetMs ?? 15_000;
        this.tripAfter = options.tripAfter ?? 3;
        this.now = options.now ?? Date.now;
        this.overall = new Semaphore(options.total ?? 16);
    }

    /**
     * Begins a run with a wall-clock budget for the network, in milliseconds;
     * zero or less means no limit. The clock starts at the first request rather
     * than here, because the files are analysed first and a slow analysis must
     * not spend the budget of a check that has not begun.
     */
    startRun(budgetMs: number): void {
        this.runBudgetMs = budgetMs > 0 ? budgetMs : null;
        this.runDeadline = null;
        this.skipped = 0;
    }

    /** Forgets everything. For tests, and for a caller that wants a clean slate. */
    reset(): void {
        this.answered.clear();
        this.inFlight.clear();
        this.hosts.clear();
        this.runBudgetMs = null;
        this.runDeadline = null;
        this.skipped = 0;
    }

    async verify(urls: string[]): Promise<Map<string, LinkOutcome>> {
        const distinct = [...new Set(urls)];
        // A file has a budget of its own even when the run has none, so a single
        // document in an editor cannot hold a worker for minutes either.
        const fileDeadline = this.now() + this.fileBudgetMs;
        const outcomes = await Promise.all(distinct.map(url => this.outcomeOf(url, fileDeadline)));
        return new Map(distinct.map((url, index) => [url, outcomes[index]]));
    }

    private outcomeOf(url: string, fileDeadline: number): Promise<LinkOutcome> {
        const known = this.answered.get(url);
        if (known && this.now() - known.at < this.ttlMs) return Promise.resolve(known.outcome);

        // The same URL asked about twice at once is one request.
        const pending = this.inFlight.get(url);
        if (pending) return pending;

        const started = this.ask(url, fileDeadline).finally(() => this.inFlight.delete(url));
        this.inFlight.set(url, started);
        return started;
    }

    private async ask(url: string, fileDeadline: number): Promise<LinkOutcome> {
        const host = this.hostOf(url);
        if (!host) return 'unknown';
        const state = this.stateFor(host);

        const releaseHost = await state.slots.acquire();
        const releaseOverall = await this.overall.acquire();
        try {
            // Checked here, after the queue, because a link that waited for its
            // turn is the one most likely to find the budget gone.
            if (this.outOfTime(fileDeadline)) return this.skip();
            if (state.quietUntil > this.now()) return this.skip();

            const outcome = await this.judge(url, state);
            // A skipped link was never asked about, so it is not remembered: a
            // later run with time to spare should be able to check it.
            this.answered.set(url, { at: this.now(), outcome });
            return outcome;
        } finally {
            releaseOverall();
            releaseHost();
        }
    }

    private outOfTime(fileDeadline: number): boolean {
        const now = this.now();
        if (this.runBudgetMs !== null) {
            this.runDeadline ??= now + this.runBudgetMs;
            if (now >= this.runDeadline) return true;
        }
        return now >= fileDeadline;
    }

    private skip(): LinkOutcome {
        this.skipped++;
        return 'unknown';
    }

    /**
     * Whether the link is definitely broken. A timeout is not evidence of that:
     * it says the server was slow, or the runner was, or a rate limit was hit.
     */
    private async judge(url: string, state: HostState): Promise<LinkOutcome> {
        for (const method of ['HEAD', 'GET'] as const) {
            try {
                const status = await this.request(url, method, this.timeoutMs);
                state.failures = 0;
                // A redirect means the server knows the URL and is pointing
                // somewhere else, so the link is not broken. It is not followed:
                // following it would let a public host forward this request at
                // an address the guard just refused.
                if (status >= 200 && status < 400) return 'ok';
                // 404 and 410 are the only answers that mean the page is not there.
                // 403 and 429 mean the server declined to talk to a script, and 5xx
                // means it was having a bad minute; neither is a broken link.
                if (method === 'GET') return status === 404 || status === 410 ? 'broken' : 'unknown';
            } catch (error) {
                // An address we refused to connect to tells us nothing about the
                // link, so nothing is claimed about it either way.
                if (isBlockedAddress(error)) return 'unknown';
                // DNS answering "no such host" is a definite answer and worth
                // reporting; a timeout or a reset is the network being the
                // network, and says nothing about the link.
                if (isUnknownHost(error)) return 'broken';
                // A host that keeps timing out is not going to answer the next
                // dozen links either, and each one costs ten seconds to learn it.
                if (++state.failures >= this.tripAfter) {
                    state.quietUntil = this.now() + this.ttlMs;
                    return 'unknown';
                }
                // Otherwise fall through to GET, then give up without claiming
                // anything.
            }
        }
        return 'unknown';
    }

    private hostOf(url: string): string | null {
        try {
            return new URL(url).host.toLowerCase();
        } catch {
            return null;
        }
    }

    private stateFor(host: string): HostState {
        let state = this.hosts.get(host);
        if (!state) {
            state = { slots: new Semaphore(this.perHost), failures: 0, quietUntil: 0 };
            this.hosts.set(host, state);
        }
        return state;
    }
}

interface HostState {
    slots: Semaphore;
    failures: number;
    quietUntil: number;
}

function isUnknownHost(error: unknown): boolean {
    // `fetch` wrapped the cause; a raw request throws the errno itself.
    const wrapped = error as { code?: string; cause?: { code?: string } } | undefined;
    const code = wrapped?.code ?? wrapped?.cause?.code;
    return code === 'ENOTFOUND' || code === 'EAI_AGAIN';
}

/** A counting semaphore: `acquire` resolves with the function that gives the slot back. */
class Semaphore {
    private readonly waiting: Array<() => void> = [];

    constructor(private free: number) {}

    async acquire(): Promise<() => void> {
        if (this.free > 0) {
            this.free--;
        } else {
            // The slot is handed straight to the next in line, not returned to
            // the pool and raced for, so the queue stays in order.
            await new Promise<void>(resolve => this.waiting.push(resolve));
        }
        let released = false;
        return () => {
            if (released) return;
            released = true;
            const next = this.waiting.shift();
            if (next) next();
            else this.free++;
        };
    }
}

/** The one the checker uses, so every file in a run shares what was learned. */
export const linkVerifier = new LinkVerifier();
