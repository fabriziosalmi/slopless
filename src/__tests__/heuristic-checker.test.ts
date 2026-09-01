import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { HeuristicChecker } from '../checkers/heuristic-checker';
import { RuleLoader } from '../engine/loader';

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
