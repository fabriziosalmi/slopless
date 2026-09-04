import { describe, it, expect } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { isPrivateOrReserved, requestStatus, isBlockedAddress } from '../engine/safe-request';

describe('isPrivateOrReserved', () => {
    it('refuses the addresses a CI runner should never be asked to reach', () => {
        const refused = [
            '169.254.169.254',      // cloud metadata, the one that matters
            '127.0.0.1', '0.0.0.0', '10.0.0.1', '172.16.0.1', '172.31.255.255',
            '192.168.1.1', '100.64.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
            '::1', '::', 'fe80::1', 'febf::1', 'fd00::1', 'fc00::1', 'ff02::1',
            '2001:db8::1',
        ];
        for (const address of refused) {
            expect(isPrivateOrReserved(address), address).toBe(true);
        }
    });

    it('reads an IPv4 address out of the IPv6 form that new URL() produces', () => {
        // `new URL('http://[::ffff:127.0.0.1]/')`.hostname is `[::ffff:7f00:1]`:
        // the dotted form is gone, so matching it as text finds nothing. This
        // reached a live socket until the bits were read out instead.
        expect(isPrivateOrReserved('::ffff:7f00:1')).toBe(true);       // 127.0.0.1
        expect(isPrivateOrReserved('::ffff:a9fe:a9fe')).toBe(true);    // 169.254.169.254
        expect(isPrivateOrReserved('::ffff:a00:1')).toBe(true);        // 10.0.0.1
        expect(isPrivateOrReserved('64:ff9b::7f00:1')).toBe(true);     // NAT64 of 127.0.0.1
        expect(isPrivateOrReserved('::ffff:808:808')).toBe(false);     // 8.8.8.8
    });

    it('allows ordinary public addresses', () => {
        for (const address of ['8.8.8.8', '1.1.1.1', '140.82.121.4', '2606:4700:4700::1111']) {
            expect(isPrivateOrReserved(address), address).toBe(false);
        }
    });

    it('refuses anything it cannot read as an address', () => {
        expect(isPrivateOrReserved('not-an-address')).toBe(true);
        expect(isPrivateOrReserved('::ffff:1:2:3:4:5:6:7')).toBe(true);
    });
});

describe('requestStatus', () => {
    it('refuses a scheme that is not http or https', async () => {
        await expect(requestStatus('file:///etc/passwd', 'HEAD', 500)).rejects.toSatisfy(isBlockedAddress);
        await expect(requestStatus('gopher://example.org/', 'HEAD', 500)).rejects.toSatisfy(isBlockedAddress);
    });

    it('refuses a private address written as a literal', async () => {
        for (const url of [
            'http://169.254.169.254/latest/meta-data/',
            'http://127.0.0.1:6379/',
            'http://[::1]:8080/',
            'http://[::ffff:127.0.0.1]:8080/',
            'http://10.0.0.1/admin',
        ]) {
            await expect(requestStatus(url, 'HEAD', 500), url).rejects.toSatisfy(isBlockedAddress);
        }
    });

    it('never opens a socket to a refused address', async () => {
        // A listener that records connections. If the guard runs before the
        // connect, this server hears nothing at all.
        let connections = 0;
        const server = http.createServer((_req, res) => res.end('ok'));
        server.on('connection', () => { connections++; });
        await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
        const { port } = server.address() as AddressInfo;

        try {
            await expect(requestStatus(`http://127.0.0.1:${port}/`, 'GET', 1000)).rejects.toSatisfy(isBlockedAddress);
            expect(connections).toBe(0);

            // The same server, reached the way it is meant to be, does answer —
            // so the count above is the guard working, not the server being deaf.
            const status = await new Promise<number>((resolve, reject) => {
                http.get(`http://127.0.0.1:${port}/`, res => { res.resume(); resolve(res.statusCode ?? 0); })
                    .on('error', reject);
            });
            expect(status).toBe(200);
            expect(connections).toBe(1);
        } finally {
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    });

    it('reports a name that does not resolve as the errno, not as blocked', async () => {
        // .invalid is reserved by RFC 2606 and never resolves, so this needs no network.
        await expect(requestStatus('https://slopless-test.invalid/', 'HEAD', 2000))
            .rejects.toMatchObject({ code: expect.stringMatching(/ENOTFOUND|EAI_AGAIN/) });
    }, 15000);
});
