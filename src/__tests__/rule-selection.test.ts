import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';
import { selectRules, UsageError } from '../index';

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

    it('refuses a category that does not exist', () => {
        // This used to return zero rules, so the run reported "no issues detected".
        expect(() => selectRules(rules, { only: 'nonsense' })).toThrow(UsageError);
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

    // A rule about a hazard must never be opt-in: silence there is the wrong default.
    // The exception is a rule whose hazard no current browser has, and each one is
    // named here with the reason, so the exception cannot grow by accident.
    const OBSOLETE_HAZARDS: Record<string, string> = {
        // target="_blank" has implied noopener since 2021 (Chrome 88, Firefox 79,
        // Safari 12.1). Reported as an error, it was 66 findings of nothing across
        // five repositories.
        'VBC-086': 'the hazard it names was closed in every browser in 2021',
    };

    it('marks the house-style prose rules and nothing structural', () => {
        expect(optIn.length).toBeGreaterThan(0);
        const structural = optIn.filter(rule => rule.category !== 'docs').map(rule => rule.id).sort();
        expect(structural).toEqual(Object.keys(OBSOLETE_HAZARDS).sort());
        expect(optIn.every(rule => rule.severity === 'warning')).toBe(true);
    });

    it('only excuses a hazard that is actually opt-in', () => {
        // An entry above that stopped being opt-in is an exception nobody needs.
        for (const id of Object.keys(OBSOLETE_HAZARDS)) {
            expect(rules.find(rule => rule.id === id)?.opt_in, id).toBe(true);
        }
    });

    it('leaves the markers of unfinished or generated content enabled', () => {
        // These are what the project is for, as opposed to a preference about prose.
        for (const id of ['VBC-334', 'VBC-928', 'VBC-933']) {
            const rule = rules.find(r => r.id === id);
            expect(rule?.opt_in, `${id} should stay on by default`).toBeFalsy();
        }
    });
});

describe('--only names a category, and says so when it does not', () => {
    it('rejects a rule id, which is the mistake people actually make', () => {
        // Silently selecting nothing reported "no issues detected": a green run
        // that never ran. The typo has to be louder than the result.
        expect(() => selectRules(rules, { only: 'VBC-077' })).toThrow(UsageError);
        expect(() => selectRules(rules, { only: 'VBC-077' })).toThrow(/unknown --only category/);
    });

    it('lists the categories that do exist', () => {
        expect(() => selectRules(rules, { only: 'secuirty' })).toThrow(/Available: .*security/);
    });

    it('names every unknown value, not just the first', () => {
        expect(() => selectRules(rules, { only: 'core,nope,alsonope' }))
            .toThrow(/categories: alsonope, nope/);
    });

    it('still selects when every category is real', () => {
        const selected = selectRules(rules, { only: 'core,security' });
        expect(selected.length).toBeGreaterThan(0);
        expect(selected.every(rule => rule.category === 'core' || rule.category === 'security')).toBe(true);
    });
});
