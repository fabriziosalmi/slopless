import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

/**
 * The link checker fetches URLs written in Markdown, and the workflow that runs
 * it triggers on `pull_request`, which includes pull requests from forks. That
 * makes the URL an attacker-supplied string and the CI runner the thing making
 * the request: a link to `http://169.254.169.254/` or `http://127.0.0.1:6379/`
 * is a request the runner makes on someone else's behalf.
 *
 * Two things close it. The address a connection actually uses is validated
 * rather than the one a preliminary lookup returned, so a name that answers
 * with a public address and then with a loopback one cannot slip through the
 * gap between the two. And redirects are not followed at all, so a public host
 * cannot forward the request inward.
 */

const BLOCKED = 'ESLOPLESSBLOCKED';

export function isBlockedAddress(error: unknown): boolean {
    return (error as { code?: string } | undefined)?.code === BLOCKED;
}

/** Reserved, private, or otherwise not a public host on the internet. */
export function isPrivateOrReserved(ip: string): boolean {
    const address = ip.replace(/^\[|\]$/g, '');

    if (net.isIPv4(address)) {
        const [a, b] = address.split('.').map(Number);
        if (a === 0) return true;                       // 0.0.0.0/8, "this network"
        if (a === 10) return true;                      // RFC 1918
        if (a === 127) return true;                     // loopback
        if (a === 169 && b === 254) return true;        // link-local, and cloud metadata
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a === 100 && b >= 64 && b <= 127) return true;   // RFC 6598 carrier NAT
        if (a === 192 && b === 0) return true;          // RFC 6890 protocol assignments, RFC 5737 docs
        if (a === 198 && (b === 18 || b === 19)) return true; // RFC 2544 benchmarking
        if (a === 198 && b === 51) return true;         // RFC 5737 documentation
        if (a === 203 && b === 0) return true;          // RFC 5737 documentation
        if (a >= 224) return true;                      // multicast and everything reserved above it
        return false;
    }

    if (!net.isIPv6(address)) return true;              // not an address we can reason about

    const groups = expandIPv6(address);
    if (!groups) return true;

    if (groups.every(part => part === 0)) return true;                       // ::
    if (groups.slice(0, 7).every(part => part === 0) && groups[7] === 1) return true;  // ::1

    // An IPv4 address wearing an IPv6 hat reaches exactly the same machine.
    // `new URL()` normalises `::ffff:127.0.0.1` to `::ffff:7f00:1`, so the
    // dotted form is gone by the time this sees it and the bits have to be
    // read out rather than matched as text.
    const mapped = groups.slice(0, 5).every(part => part === 0) && groups[5] === 0xffff;
    const nat64 = groups[0] === 0x64 && groups[1] === 0xff9b
        && groups.slice(2, 6).every(part => part === 0);
    if (mapped || nat64) {
        const v4 = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
        return isPrivateOrReserved(v4);
    }

    if ((groups[0] & 0xffc0) === 0xfe80) return true;   // fe80::/10 link-local
    if ((groups[0] & 0xfe00) === 0xfc00) return true;   // fc00::/7 unique local
    if ((groups[0] & 0xff00) === 0xff00) return true;   // ff00::/8 multicast
    if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;  // RFC 3849 documentation
    return false;
}

/** The eight 16-bit groups of an IPv6 address, with `::` filled back in. */
function expandIPv6(address: string): number[] | null {
    const [head, tail, ...rest] = address.toLowerCase().split('::');
    if (rest.length) return null;

    const parse = (part: string) => (part ? part.split(':').map(g => parseInt(g, 16)) : []);
    const left = parse(head);
    const right = tail === undefined ? [] : parse(tail);
    const groups = tail === undefined
        ? left
        : [...left, ...new Array(8 - left.length - right.length).fill(0), ...right];

    return groups.length === 8 && groups.every(g => Number.isInteger(g) && g >= 0 && g <= 0xffff)
        ? groups
        : null;
}

/**
 * Node resolves the name again when it connects, so validating a lookup we ran
 * ourselves would leave a window. This is the lookup the connection uses.
 */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
    dns.lookup(hostname, options as dns.LookupAllOptions, (error, address, family) => {
        if (error) return (callback as (e: NodeJS.ErrnoException) => void)(error);

        const resolved = Array.isArray(address)
            ? address
            : [{ address: address as string, family: family as number }];
        const refused = resolved.find(entry => isPrivateOrReserved(entry.address));
        if (refused) {
            const blocked: NodeJS.ErrnoException = new Error(
                `${hostname} resolves to ${refused.address}, which is not a public address`,
            );
            blocked.code = BLOCKED;
            return (callback as (e: NodeJS.ErrnoException) => void)(blocked);
        }
        (callback as (...args: unknown[]) => void)(null, address, family);
    });
};

/**
 * The status a request answers with, or a throw carrying the reason it could
 * not be made. Redirects are reported as they are rather than followed.
 */
export function requestStatus(rawUrl: string, method: 'HEAD' | 'GET', timeoutMs: number): Promise<number> {
    return new Promise((resolve, reject) => {
        let url: URL;
        try {
            url = new URL(rawUrl);
        } catch {
            const bad: NodeJS.ErrnoException = new Error(`not a URL: ${rawUrl}`);
            bad.code = BLOCKED;
            return reject(bad);
        }

        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            const scheme: NodeJS.ErrnoException = new Error(`refusing ${url.protocol}`);
            scheme.code = BLOCKED;
            return reject(scheme);
        }

        const literal = url.hostname.replace(/^\[|\]$/g, '');
        if (net.isIP(literal) && isPrivateOrReserved(literal)) {
            const blocked: NodeJS.ErrnoException = new Error(`${literal} is not a public address`);
            blocked.code = BLOCKED;
            return reject(blocked);
        }

        const transport = url.protocol === 'https:' ? https : http;
        const request = transport.request(
            url,
            {
                method,
                lookup: guardedLookup,
                timeout: timeoutMs,
                headers: { 'user-agent': 'slopless (+https://github.com/fabriziosalmi/slopless)' },
            },
            response => {
                response.resume();  // the body is never read, but it has to be drained
                resolve(response.statusCode ?? 0);
            },
        );

        request.on('timeout', () => {
            const timedOut: NodeJS.ErrnoException = new Error('timed out');
            timedOut.code = 'ETIMEDOUT';
            request.destroy(timedOut);
        });
        request.on('error', reject);
        request.end();
    });
}
