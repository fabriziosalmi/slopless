import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';
import { appliesTo, coverageOf, describeCoverage, tierOf, extensionOf, uncovered } from '../engine/coverage';
import { Rule } from '../engine/schema';

const rules = RuleLoader.loadRules([path.resolve(__dirname, '../../rules')]);

const rule = (over: Partial<Rule['match']>): Rule => ({
    id: 'VBC-000', name: 'n', severity: 'error', category: 'core',
    message: 'm', match: over,
} as Rule);

describe('extensionOf', () => {
    it('reads the last extension, lowercased', () => {
        expect(extensionOf('a/b/App.TSX')).toBe('tsx');
        expect(extensionOf('a.b.min.js')).toBe('js');
    });

    it('gives a dotfile no extension, because .gitignore is a name', () => {
        expect(extensionOf('.gitignore')).toBe('');
        expect(extensionOf('Makefile')).toBe('');
    });
});

describe('appliesTo agrees with what the checkers do', () => {
    it('lets an undeclared regex rule read anything', () => {
        expect(appliesTo(rule({ regex: 'x' }), 'rs')).toBe(true);
    });

    it('holds a declared regex rule to its list', () => {
        expect(appliesTo(rule({ regex: 'x', file_types: ['py'] }), 'py')).toBe(true);
        expect(appliesTo(rule({ regex: 'x', file_types: ['py'] }), 'go')).toBe(false);
    });

    it('confines the parsing tiers to what the parser reads', () => {
        for (const match of [{ ast_check: { type: 'empty-catch' } }, { semantic_check: 'x' }] as Rule['match'][]) {
            expect(appliesTo(rule(match), 'ts')).toBe(true);
            expect(appliesTo(rule(match), 'py')).toBe(false);
            expect(appliesTo(rule(match), 'rs')).toBe(false);
        }
    });

    it('confines the type tier further, to files that carry types', () => {
        expect(appliesTo(rule({ type_check: 'x' } as Rule['match']), 'ts')).toBe(true);
        expect(appliesTo(rule({ type_check: 'x' } as Rule['match']), 'js')).toBe(false);
    });

    it('never counts a git rule against a file', () => {
        expect(appliesTo(rule({ git_check: 'x' } as Rule['match']), 'ts')).toBe(false);
    });
});

describe('coverage over the real rule set', () => {
    it('reports zero for a language nothing reads', () => {
        // The bug this exists for: a Rust file with a hardcoded password and an
        // http:// URL reported "No static analysis issues detected".
        const [rust] = coverageOf(['src/lib.rs'], rules);
        expect(rust.rules).toBe(0);
        expect(uncovered([rust])).toHaveLength(1);
    });

    it('reports far more for TypeScript than for anything else', () => {
        const [ts] = coverageOf(['a.ts'], rules);
        const [py] = coverageOf(['a.py'], rules);
        expect(ts.rules).toBeGreaterThan(py.rules);
        expect(py.rules).toBeGreaterThan(0);
    });

    it('counts files per extension and orders by how many there are', () => {
        const found = coverageOf(['a.ts', 'b.ts', 'c.rs'], rules);
        expect(found.map(c => [c.ext, c.files])).toEqual([['ts', 2], ['rs', 1]]);
    });

    it('names the languages it read, and says when one was read by nothing', () => {
        const line = describeCoverage(coverageOf(['a.ts', 'c.rs'], rules), rules.length);
        expect(line).toMatch(/\.ts \d+ rules/);
        expect(line).toContain('.rs nothing applies');
    });
});

describe('every rule lands in exactly one tier', () => {
    it('has no rule the tier check cannot name', () => {
        for (const r of rules) {
            expect(['regex', 'ast', 'semantic', 'heuristic', 'type', 'git'], r.id).toContain(tierOf(r));
        }
    });
});
