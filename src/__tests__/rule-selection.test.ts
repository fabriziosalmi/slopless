import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';
import { selectRules } from '../index';

const rules = RuleLoader.loadRules([path.resolve(__dirname, '../../rules')]);

describe('selectRules', () => {
    it('returns everything when nothing is asked for', () => {
        expect(selectRules(rules, {})).toHaveLength(rules.length);
    });

    it('keeps only the named categories', () => {
        const picked = selectRules(rules, { only: 'security,core' });
        expect(picked.length).toBeGreaterThan(0);
        expect(picked.length).toBeLessThan(rules.length);
        expect(new Set(picked.map(r => r.category))).toEqual(new Set(['security', 'core']));
    });

    it('tolerates spaces around the commas', () => {
        expect(selectRules(rules, { only: 'security, core' }))
            .toHaveLength(selectRules(rules, { only: 'security,core' }).length);
    });

    it('returns nothing for a category that does not exist', () => {
        expect(selectRules(rules, { only: 'nonsense' })).toHaveLength(0);
    });

    it('drops warnings when only errors are wanted', () => {
        const picked = selectRules(rules, { minSeverity: 'error' });
        expect(picked.every(r => r.severity === 'error')).toBe(true);
        expect(picked.length).toBeGreaterThan(0);
    });

    it('keeps everything at the default severity', () => {
        expect(selectRules(rules, { minSeverity: 'warning' })).toHaveLength(rules.length);
    });

    it('applies both filters together', () => {
        const picked = selectRules(rules, { only: 'security', minSeverity: 'error' });
        expect(picked.every(r => r.category === 'security' && r.severity === 'error')).toBe(true);
    });
});

describe('opt-in rules', () => {
    const optIn = rules.filter(rule => rule.opt_in);

    it('marks the house-style prose rules and nothing structural', () => {
        expect(optIn.length).toBeGreaterThan(0);
        // A rule about a hazard must never be opt-in: silence there is the wrong default.
        expect(optIn.every(rule => rule.category === 'docs')).toBe(true);
        expect(optIn.every(rule => rule.severity === 'warning')).toBe(true);
    });

    it('leaves the markers of unfinished or generated content enabled', () => {
        // These are what the project is for, as opposed to a preference about prose.
        for (const id of ['VBC-334', 'VBC-928', 'VBC-933']) {
            const rule = rules.find(r => r.id === id);
            expect(rule?.opt_in, `${id} should stay on by default`).toBeFalsy();
        }
    });
});
