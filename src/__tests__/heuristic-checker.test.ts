import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { HeuristicChecker } from '../checkers/heuristic-checker';
import { RuleLoader } from '../engine/loader';
import type { Rule } from '../engine/schema';

const RULES_DIR = path.resolve(__dirname, '../../rules');
const rules = RuleLoader.loadRules([RULES_DIR]).filter(rule => rule.id === 'VBC-401');

describe('HeuristicChecker — VBC-401 broken-links', () => {
    it('only inspects markdown', async () => {
        const violations = await HeuristicChecker.check(
            'notes.txt', rules, '[docs](https://this-host-does-not-resolve.invalid)\n');
        expect(violations).toHaveLength(0);
    });

    it('ignores relative links, which are not fetchable', async () => {
        const violations = await HeuristicChecker.check('readme.md', rules, 'See [the guide](./guide.md).\n');
        expect(violations).toHaveLength(0);
    });

    it('flags an absolute link that cannot be reached', async () => {
        // .invalid is reserved by RFC 2606 and never resolves, so this needs no network.
        const violations = await HeuristicChecker.check(
            'readme.md', rules, 'See [the guide](https://slopless-test.invalid/guide).\n');
        expect(violations).toHaveLength(1);
        expect(violations[0].ruleId).toBe('VBC-401');
        expect(violations[0].line).toBe(1);
    }, 15000);
});

describe('HeuristicChecker — VBC-921 stale-copyright-year', () => {
    const copyright = RuleLoader.loadRules([RULES_DIR]).filter(rule => rule.id === 'VBC-921');
    const thisYear = new Date().getFullYear();

    it('ignores a notice carrying the current year', async () => {
        const found = await HeuristicChecker.check('a.ts', copyright, `// Copyright (c) ${thisYear} Someone\n`);
        expect(found).toHaveLength(0);
    });

    it('ignores a range that ends in the current year', async () => {
        const found = await HeuristicChecker.check('a.ts', copyright, `// Copyright 2020-${thisYear} Someone\n`);
        expect(found).toHaveLength(0);
    });

    it('ignores a range ending in "present"', async () => {
        const found = await HeuristicChecker.check('a.ts', copyright, '// Copyright 2020-present Someone\n');
        expect(found).toHaveLength(0);
    });

    it('ignores a range whose end is generated, which is what the message asks for', async () => {
        const generated = [
            '<p>© 2020-{new Date().getFullYear()} Someone</p>',
            '<p>© 2020-${new Date().getFullYear()} Someone</p>',
            '<p>© 2020-{{ year }} Someone</p>',
            '<p>© 2020-<%= year %> Someone</p>',
        ];
        for (const line of generated) {
            expect(await HeuristicChecker.check('a.ts', copyright, `${line}\n`)).toEqual([]);
        }
    });

    it('flags a notice that stopped at a year gone by', async () => {
        const found = await HeuristicChecker.check('a.ts', copyright, `// Copyright (c) ${thisYear - 3} Someone\n`);
        expect(found).toHaveLength(1);
        expect(found[0].ruleId).toBe('VBC-921');
        expect(found[0].message).toContain(String(thisYear));
    });

    it('flags a range that stopped before the current year', async () => {
        const found = await HeuristicChecker.check('a.ts', copyright, `// Copyright 2019-${thisYear - 2} Someone\n`);
        expect(found).toHaveLength(1);
    });
});

// Three identical runs over one repository gave 1, 4 and 4 findings, because a
// slow server, a rate limit and a bot block were all reported as broken links.
describe('a link is broken only when the server says it is not there', () => {
    const rule = { id: 'VBC-401', name: 'broken-links', severity: 'warning', category: 'docs',
        message: "Broken link '{url}' at line {line}.",
        match: { heuristic_check: 'link-checker' } } as unknown as Rule;

    const withFetch = async (impl: (url: string, init: RequestInit) => Promise<Response>) => {
        const original = globalThis.fetch;
        globalThis.fetch = ((u: string, i: RequestInit) => impl(u, i)) as typeof fetch;
        try {
            return await HeuristicChecker.check('a.md', [rule], '[x](https://example.com/p)\n');
        } finally {
            globalThis.fetch = original;
        }
    };
    const reply = (status: number) => new Response(null, { status });

    it('reports a 404', async () => {
        expect(await withFetch(async () => reply(404))).toHaveLength(1);
    });

    it('reports a 410', async () => {
        expect(await withFetch(async () => reply(410))).toHaveLength(1);
    });

    it('says nothing when the request never finished', async () => {
        expect(await withFetch(async () => { throw new Error('timeout'); })).toHaveLength(0);
    });

    it('says nothing about a rate limit or a bot block', async () => {
        for (const status of [403, 429]) {
            expect(await withFetch(async () => reply(status)), String(status)).toHaveLength(0);
        }
    });

    it('says nothing when the server was having a bad minute', async () => {
        expect(await withFetch(async () => reply(503))).toHaveLength(0);
    });

    it('accepts a link whose server refuses HEAD but answers GET', async () => {
        const found = await withFetch(async (_u, init) =>
            init.method === 'HEAD' ? reply(405) : reply(200));
        expect(found).toHaveLength(0);
    });
});
