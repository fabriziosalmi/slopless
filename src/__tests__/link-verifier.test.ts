import { describe, it, expect } from 'vitest';
import { LinkVerifier } from '../engine/link-verifier';
import { HeuristicChecker } from '../checkers/heuristic-checker';
import type { Rule } from '../engine/schema';

type Method = 'HEAD' | 'GET';

/** A request function that records what was asked and answers from a table. */
function fake(answer: (url: string, method: Method) => number | Error | Promise<number> = () => 200) {
    const calls: { url: string; method: Method }[] = [];
    let running = 0;
    let peak = 0;
    const perHostRunning = new Map<string, number>();
    const peakPerHost = new Map<string, number>();

    const request = async (url: string, method: Method) => {
        calls.push({ url, method });
        const host = new URL(url).host;
        running++;
        peak = Math.max(peak, running);
        const here = (perHostRunning.get(host) ?? 0) + 1;
        perHostRunning.set(host, here);
        peakPerHost.set(host, Math.max(peakPerHost.get(host) ?? 0, here));
        try {
            // Yield, so that a request really is in flight while the next one starts.
            await new Promise(resolve => setImmediate(resolve));
            const result = await answer(url, method);
            if (result instanceof Error) throw result;
            return result;
        } finally {
            running--;
            perHostRunning.set(host, (perHostRunning.get(host) ?? 1) - 1);
        }
    };
    return { request, calls, peak: () => peak, peakOn: (host: string) => peakPerHost.get(host) ?? 0 };
}

const code = (name: string) => Object.assign(new Error(name), { code: name });

describe('LinkVerifier — asking once', () => {
    it('asks about a URL once however often it appears', async () => {
        const net = fake();
        const verifier = new LinkVerifier({ request: net.request });
        await verifier.verify(['https://a.test/x', 'https://a.test/x', 'https://a.test/x']);
        expect(net.calls).toHaveLength(1);
        expect(net.calls[0].method).toBe('HEAD');
    });

    it('asks once when two files ask at the same moment', async () => {
        const net = fake();
        const verifier = new LinkVerifier({ request: net.request });
        await Promise.all([verifier.verify(['https://a.test/x']), verifier.verify(['https://a.test/x'])]);
        expect(net.calls).toHaveLength(1);
    });

    it('remembers an answer, and forgets it when it has gone stale', async () => {
        let clock = 0;
        const net = fake();
        const verifier = new LinkVerifier({ request: net.request, ttlMs: 1000, now: () => clock });

        await verifier.verify(['https://a.test/x']);
        clock = 999;
        await verifier.verify(['https://a.test/x']);
        expect(net.calls).toHaveLength(1);

        clock = 1000;
        await verifier.verify(['https://a.test/x']);
        expect(net.calls).toHaveLength(2);
    });
});

describe('LinkVerifier — how many at once', () => {
    it('never has more than perHost requests in flight to one host', async () => {
        const net = fake();
        const verifier = new LinkVerifier({ request: net.request, perHost: 3 });
        const urls = Array.from({ length: 20 }, (_, i) => `https://same.test/${i}`);
        await verifier.verify(urls);
        expect(net.calls).toHaveLength(20);
        expect(net.peakOn('same.test')).toBeLessThanOrEqual(3);
        expect(net.peakOn('same.test')).toBeGreaterThan(1);
    });

    it('runs different hosts side by side, up to the overall limit', async () => {
        const net = fake();
        const verifier = new LinkVerifier({ request: net.request, perHost: 2, total: 5 });
        const urls = Array.from({ length: 30 }, (_, i) => `https://host${i}.test/`);
        await verifier.verify(urls);
        expect(net.peak()).toBeLessThanOrEqual(5);
        expect(net.peak()).toBeGreaterThan(2);
    });
});

describe('LinkVerifier — what an answer means', () => {
    const outcome = async (answer: (url: string, m: Method) => number | Error | Promise<number>) => {
        const verifier = new LinkVerifier({ request: fake(answer).request });
        return (await verifier.verify(['https://a.test/p'])).get('https://a.test/p');
    };

    it('calls 404 and 410 broken, after a GET confirms what HEAD said', async () => {
        expect(await outcome(() => 404)).toBe('broken');
        expect(await outcome(() => 410)).toBe('broken');
    });

    it('does not call a rate limit, a bot block or a bad minute broken', async () => {
        for (const status of [403, 429, 500, 503]) {
            expect(await outcome(() => status), String(status)).toBe('unknown');
        }
    });

    it('accepts a server that refuses HEAD and answers GET', async () => {
        expect(await outcome((_, m) => (m === 'HEAD' ? 405 : 200))).toBe('ok');
    });

    it('accepts a redirect without following it', async () => {
        expect(await outcome(() => 301)).toBe('ok');
    });

    it('calls an unresolvable host broken and says nothing about a refused address', async () => {
        expect(await outcome(() => code('ENOTFOUND'))).toBe('broken');
        expect(await outcome(() => code('ESLOPLESSBLOCKED'))).toBe('unknown');
    });

    it('says nothing when the request never finished', async () => {
        expect(await outcome(() => code('ETIMEDOUT'))).toBe('unknown');
    });
});

describe('LinkVerifier — a host that stops answering', () => {
    it('is left alone after a few failures, and what was left is counted', async () => {
        const net = fake(() => code('ETIMEDOUT'));
        const verifier = new LinkVerifier({ request: net.request, perHost: 1, tripAfter: 3 });
        const urls = Array.from({ length: 12 }, (_, i) => `https://dead.test/${i}`);
        await verifier.verify(urls);

        // Two requests per link (HEAD, then GET) until the third failure trips it.
        expect(net.calls.length).toBeLessThan(urls.length);
        expect(verifier.skipped).toBeGreaterThan(0);
        expect(verifier.skipped + net.calls.length / 2).toBeGreaterThanOrEqual(urls.length - 2);
    });

    it('does not affect another host', async () => {
        const net = fake(url => (url.includes('dead.test') ? code('ETIMEDOUT') : 200));
        const verifier = new LinkVerifier({ request: net.request, perHost: 1, tripAfter: 2 });
        const dead = Array.from({ length: 6 }, (_, i) => `https://dead.test/${i}`);
        const result = await verifier.verify([...dead, 'https://fine.test/']);
        expect(result.get('https://fine.test/')).toBe('ok');
    });

    it('is asked again once the quiet period has passed', async () => {
        let clock = 0;
        let alive = false;
        const net = fake(() => (alive ? 200 : code('ETIMEDOUT')));
        const verifier = new LinkVerifier({
            request: net.request, perHost: 1, tripAfter: 2, ttlMs: 1000, now: () => clock,
        });
        await verifier.verify(['https://flaky.test/1', 'https://flaky.test/2']);

        alive = true;
        clock = 1500;
        const later = await verifier.verify(['https://flaky.test/3']);
        expect(later.get('https://flaky.test/3')).toBe('ok');
    });
});

describe('LinkVerifier — the budget', () => {
    it('stops asking once the run budget is spent, and counts what it did not ask', async () => {
        let clock = 0;
        // Every request costs a second of the pretend clock.
        const net = fake(() => { clock += 1000; return 200; });
        const verifier = new LinkVerifier({
            request: net.request, perHost: 1, total: 1, now: () => clock, fileBudgetMs: 1e9,
        });
        verifier.startRun(3000);

        const urls = Array.from({ length: 10 }, (_, i) => `https://a.test/${i}`);
        const result = await verifier.verify(urls);

        expect(net.calls.length).toBeLessThan(10);
        expect(verifier.skipped).toBe(10 - net.calls.length);
        // What was not asked about is unknown, never broken and never ok.
        const unasked = urls.filter(url => !net.calls.some(call => call.url === url));
        for (const url of unasked) expect(result.get(url)).toBe('unknown');
    });

    it('starts the clock at the first request, not at startRun', async () => {
        let clock = 0;
        const net = fake();
        const verifier = new LinkVerifier({ request: net.request, now: () => clock, fileBudgetMs: 1e9 });
        verifier.startRun(1000);

        // A long analysis happens before the first link is looked at.
        clock = 60_000;
        const result = await verifier.verify(['https://a.test/x']);
        expect(result.get('https://a.test/x')).toBe('ok');
        expect(verifier.skipped).toBe(0);
    });

    it('does not remember a link it skipped, so a later run can check it', async () => {
        let clock = 0;
        const net = fake();
        const verifier = new LinkVerifier({ request: net.request, now: () => clock, fileBudgetMs: 1e9 });

        verifier.startRun(1);
        clock = 10;
        await verifier.verify(['https://a.test/first']);     // starts the clock
        clock = 20;
        await verifier.verify(['https://a.test/late']);      // past the deadline
        expect(verifier.skipped).toBe(1);

        verifier.startRun(10_000);
        const again = await verifier.verify(['https://a.test/late']);
        expect(again.get('https://a.test/late')).toBe('ok');
    });

    it('gives a single file a budget of its own when the run has none', async () => {
        let clock = 0;
        const net = fake(() => { clock += 4000; return 200; });
        const verifier = new LinkVerifier({
            request: net.request, perHost: 1, total: 1, now: () => clock, fileBudgetMs: 10_000,
        });
        await verifier.verify(Array.from({ length: 10 }, (_, i) => `https://a.test/${i}`));
        expect(verifier.skipped).toBeGreaterThan(0);
        expect(net.calls.length).toBeLessThan(10);
    });

    it('treats a budget of zero as no limit', async () => {
        let clock = 0;
        const net = fake(() => { clock += 1000; return 200; });
        const verifier = new LinkVerifier({ request: net.request, now: () => clock, fileBudgetMs: 1e9 });
        verifier.startRun(0);
        await verifier.verify(Array.from({ length: 20 }, (_, i) => `https://a.test/${i}`));
        expect(verifier.skipped).toBe(0);
        expect(net.calls).toHaveLength(20);
    });
});

describe('HeuristicChecker — where each broken link is', () => {
    const rule = { id: 'VBC-401', name: 'broken-links', severity: 'warning', category: 'docs',
        message: "Broken link '{url}' at line {line}.",
        match: { heuristic_check: 'link-checker' } } as unknown as Rule;

    it('reports every appearance on its own line, from one request', async () => {
        const net = fake(() => 404);
        const verifier = new LinkVerifier({ request: net.request });
        const content = [
            'one [gone](https://a.test/gone)',
            '',
            'two [gone](https://a.test/gone) again',
            '[fine](./local.md)',
            'three [gone](https://a.test/gone)',
        ].join('\n');

        const found = await HeuristicChecker.check('doc.md', [rule], content, verifier);
        expect(found.map(v => v.line)).toEqual([1, 3, 5]);
        // HEAD then GET to confirm, once, for three appearances.
        expect(net.calls).toHaveLength(2);
    });
});
