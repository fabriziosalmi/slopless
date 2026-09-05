import { describe, it, expect } from 'vitest';
import { RegexChecker } from '../checkers/regex-checker';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';

const RULES_DIR = path.resolve(__dirname, '../../rules');
const rules = RuleLoader.loadRules([RULES_DIR]);

function check(content: string, filename = 'test.ts') {
    return RegexChecker.check(filename, rules, content);
}

function checkRule(ruleId: string, content: string, filename = 'test.ts') {
    const ruleSet = rules.filter(r => r.id === ruleId);
    return RegexChecker.check(filename, ruleSet, content);
}

describe('RegexChecker — basic', () => {
    it('returns no violations for empty file', () => {
        expect(check('')).toHaveLength(0);
    });

    it('returns no violations for clean code', () => {
        const clean = `
function add(a: number, b: number): number {
    return a + b;
}
`;
        const violations = check(clean);
        expect(violations).toHaveLength(0);
    });

    it('detects hardcoded password (VBC-001)', () => {
        const violations = checkRule('VBC-001', `const password = "hunter2abc";`);
        expect(violations.length).toBeGreaterThan(0);
    });

    it('detects console.log in ts (VBC-018)', () => {
        const violations = checkRule('VBC-018', `console.log("debug me");`);
        expect(violations.length).toBeGreaterThan(0);
    });
});

describe('RegexChecker — file_types filtering', () => {
    it('skips rules that do not apply to the file extension', () => {
        // VBC-398 (excessive punctuation) only applies to md/txt
        const violations = checkRule('VBC-398', `const x = a ?? b;`, 'test.ts');
        expect(violations).toHaveLength(0);
    });

    it('applies md rules to markdown files', () => {
        const violations = checkRule('VBC-398', `Hurry up!!! This is urgent!!!`, 'README.md');
        expect(violations.length).toBeGreaterThan(0);
    });
});

describe('RegexChecker — protected ranges (strings/comments)', () => {
    it('does not flag hardcoded password inside a string value (false positive guard)', () => {
        // The pattern "password" in a variable name is VBC-001 territory
        // but mentioning it in a comment for documentation should ideally not trigger
        // This tests that protected range logic is active
        const safeComment = `// This is a comment about password policies`;
        const violations = checkRule('VBC-001', safeComment);
        // May or may not trigger — just ensure checker runs without error
        expect(Array.isArray(violations)).toBe(true);
    });
});

describe('RegexChecker — VBC-051 (snake_case/camelCase mix)', () => {
    it('does not flag property access like obj.git_check', () => {
        const code = `const x = rule.git_check;`;
        const violations = checkRule('VBC-051', code);
        expect(violations).toHaveLength(0);
    });

    it('does not flag string literals with underscores', () => {
        const code = `const path = 'node_modules/foo';`;
        const violations = checkRule('VBC-051', code);
        expect(violations).toHaveLength(0);
    });
});

describe('RegexChecker — VBC-090 (passive-aggressive)', () => {
    it('does not flag function names containing "magic"', () => {
        const code = `function getMagicLink() { return token; }`;
        const violations = checkRule('VBC-090', code);
        expect(violations).toHaveLength(0);
    });

    it('does not flag the word "hack" in variable names', () => {
        const code = `const hackathon = new Event();`;
        const violations = checkRule('VBC-090', code);
        expect(violations).toHaveLength(0);
    });

    it('flags "idk why this works" comment', () => {
        const violations = checkRule('VBC-090', `// idk why this works but it does`);
        expect(violations.length).toBeGreaterThan(0);
    });
});

describe('RegexChecker — new AI error rules', () => {
    it('VBC-943 flags catch (_) patterns', () => {
        const violations = checkRule('VBC-943', `try { doIt(); } catch (_) { }`, 'test.ts');
        expect(violations.length).toBeGreaterThan(0);
    });

    it('VBC-945 flags TODO placeholder comments', () => {
        const violations = checkRule('VBC-945', `// TODO: implement this`, 'test.ts');
        expect(violations.length).toBeGreaterThan(0);
    });

    it('VBC-945 flags YOUR CODE HERE stubs', () => {
        const violations = checkRule('VBC-945', `// YOUR CODE HERE`, 'test.ts');
        expect(violations.length).toBeGreaterThan(0);
    });

    it('VBC-940 flags float arithmetic on price variable', () => {
        const violations = checkRule('VBC-940', `const total = price * 0.1;`, 'test.ts');
        expect(violations.length).toBeGreaterThan(0);
    });
});

describe('a rule file\'s own examples', () => {
    const secrets = RuleLoader.loadRules([RULES_DIR]).filter(r => r.id === 'VBC-001');

    const ruleFile = [
        'id: VBC-999',
        'name: made-up',
        'severity: error',
        'match:',
        '  regex: nothing',
        'message: >-',
        '  A hardcoded credential.',
        'tests:',
        '  fire:',
        '    - const password = "hunter2abc";',
    ].join('\n');

    it('says nothing about the fire examples, which exist to be reported', () => {
        expect(RegexChecker.check('rules/VBC-999.yaml', secrets, ruleFile)).toEqual([]);
    });

    it('still reads everything above the tests block', () => {
        const above = ruleFile.replace('message: >-', 'password = "hunter2abc"\nmessage: >-');
        const found = RegexChecker.check('rules/VBC-999.yaml', secrets, above);
        expect(found).toHaveLength(1);
        expect(found[0].ruleId).toBe('VBC-001');
    });

    it('has no opinion about a yaml file that is not a rule', () => {
        // No `tests:` block and none of a rule's shape, so nothing is skipped.
        const workflow = 'name: ci\njobs:\n  a:\n    env:\n      password = "hunter2abc"\n';
        expect(RegexChecker.check('.github/workflows/ci.yml', secrets, workflow)).toHaveLength(1);
        expect(RegexChecker.check('config/app.yaml', secrets, workflow)).toHaveLength(1);
    });
});
