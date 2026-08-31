import { describe, it, expect } from 'vitest';
import { SemanticChecker } from '../checkers/semantic-checker';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';

const RULES_DIR = path.resolve(__dirname, '../../rules');
const rules = RuleLoader.loadRules([RULES_DIR]);

function check(content: string, filename = 'test.ts') {
    return SemanticChecker.check(filename, rules, content);
}

function checkRule(ruleId: string, content: string, filename = 'test.ts') {
    const ruleSet = rules.filter(r => r.id === ruleId);
    return SemanticChecker.check(filename, ruleSet, content);
}

describe('SemanticChecker — skips non-JS/TS files', () => {
    it('returns empty for .yaml files', () => {
        const violations = check('id: VBC-001\n', 'rule.yaml');
        expect(violations).toHaveLength(0);
    });

    it('returns empty for .md files', () => {
        const violations = check('# Hello World\n', 'README.md');
        expect(violations).toHaveLength(0);
    });
});

describe('SemanticChecker — boolean-naming', () => {
    it('does not flag well-named boolean: isActive', () => {
        const code = `const isActive = true;`;
        const violations = checkRule('VBC-501', code);
        expect(violations).toHaveLength(0);
    });

    it('does not flag well-named boolean: hasPermission', () => {
        const code = `const hasPermission: boolean = false;`;
        const violations = checkRule('VBC-501', code);
        expect(violations).toHaveLength(0);
    });

    it('does not flag non-boolean variable named without prefix', () => {
        const code = `const counter = 0;`;
        const violations = checkRule('VBC-501', code);
        expect(violations).toHaveLength(0);
    });
});

describe('SemanticChecker — collection-suffix', () => {
    it('does not flag array named with plural suffix', () => {
        const code = `const items = [];`;
        const violations = checkRule('VBC-503', code);
        expect(violations).toHaveLength(0);
    });

    it('does not flag array named with List suffix', () => {
        const code = `const itemList: string[] = [];`;
        const violations = checkRule('VBC-503', code);
        expect(violations).toHaveLength(0);
    });

    it('flags array with singular non-collection name', () => {
        const code = `const item: string[] = ['a', 'b'];`;
        const violations = checkRule('VBC-503', code);
        expect(violations.length).toBeGreaterThan(0);
    });
});

describe('SemanticChecker — boolean-redundancy', () => {
    it('flags if/else that returns true/false directly', () => {
        const code = `
function check(x: number): boolean {
    if (x > 0) {
        return true;
    } else {
        return false;
    }
}`;
        const violations = checkRule('VBC-502', code);
        expect(violations.length).toBeGreaterThan(0);
    });

    it('does not flag if/else that returns different values', () => {
        const code = `
function check(x: number): number {
    if (x > 0) {
        return 1;
    } else {
        return -1;
    }
}`;
        const violations = checkRule('VBC-502', code);
        expect(violations).toHaveLength(0);
    });
});

describe('SemanticChecker — semantic-shadowing', () => {
    it('flags variable named "fs" (shadows node module)', () => {
        const code = `const fs = 'not a real fs';`;
        const violations = checkRule('VBC-504', code);
        expect(violations.length).toBeGreaterThan(0);
    });

    it('flags variable named "path" (shadows node module)', () => {
        const code = `const path = '/some/path';`;
        const violations = checkRule('VBC-504', code);
        expect(violations.length).toBeGreaterThan(0);
    });

    it('does not flag regular variable name', () => {
        const code = `const userId = '123';`;
        const violations = checkRule('VBC-504', code);
        expect(violations).toHaveLength(0);
    });
});
