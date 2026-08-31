import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';

const RULES_DIR = path.resolve(__dirname, '../../rules');

describe('RuleLoader', () => {
    it('loads all rules without errors', () => {
        const rules = RuleLoader.loadRules([RULES_DIR]);
        expect(rules.length).toBeGreaterThan(100);
    });

    it('every rule has required fields', () => {
        const rules = RuleLoader.loadRules([RULES_DIR]);
        for (const rule of rules) {
            expect(rule.id, `rule missing id`).toBeTruthy();
            expect(rule.name, `${rule.id} missing name`).toBeTruthy();
            expect(rule.message, `${rule.id} missing message`).toBeTruthy();
            expect(rule.severity, `${rule.id} missing severity`).toMatch(/^(error|warning)$/);
            expect(rule.category, `${rule.id} missing category`).toBeTruthy();
        }
    });

    it('every rule has at least one match condition', () => {
        const rules = RuleLoader.loadRules([RULES_DIR]);
        for (const rule of rules) {
            const m = rule.match;
            const hasCondition = !!(
                m.regex ||
                m.git_check ||
                m.ast_check ||
                m.heuristic_check ||
                m.semantic_check ||
                m.type_check
            );
            expect(hasCondition, `${rule.id} has no match condition`).toBe(true);
        }
    });

    it('rule IDs are unique', () => {
        const rules = RuleLoader.loadRules([RULES_DIR]);
        const ids = rules.map(r => r.id);
        const unique = new Set(ids);
        expect(unique.size).toBe(ids.length);
    });

    it('all regex patterns compile without error', () => {
        const rules = RuleLoader.loadRules([RULES_DIR]);
        for (const rule of rules) {
            if (rule.match.regex) {
                expect(() => new RegExp(rule.match.regex!), `${rule.id} has invalid regex`).not.toThrow();
            }
        }
    });

    it('loads rules from custom directory', () => {
        const rules = RuleLoader.loadRules([RULES_DIR]);
        const vbcIds = rules.filter(r => r.id.startsWith('VBC-'));
        expect(vbcIds.length).toBeGreaterThan(100);
    });
});
