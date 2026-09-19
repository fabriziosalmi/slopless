import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';

const ROOT = path.join(__dirname, '..', '..');
const rules = RuleLoader.loadRules([path.join(ROOT, 'rules')]);

/**
 * `docs/configuration.md` names every rule that ships disabled, because a user
 * who wants one back has to know it exists. The count beside the list is
 * generated; the list is prose with a description per rule, so it is checked
 * instead. VBC-920 went opt-in in 1.17.2, and this is what would have noticed
 * it was missing from the list.
 */
describe('the configuration page names every opt-in rule', () => {
    const page = fs.readFileSync(path.join(ROOT, 'docs', 'configuration.md'), 'utf8');
    const section = page.slice(page.indexOf('The opt-in set is'), page.indexOf('Every rule page says whether'));

    it('finds the list it is meant to check', () => {
        expect(section.length, 'the "The opt-in set is" paragraph moved or was reworded')
            .toBeGreaterThan(0);
    });

    it('lists each rule that ships disabled, and no rule that does not', () => {
        const optIn = rules.filter(rule => rule.opt_in).map(rule => rule.id).sort();
        const listed = [...section.matchAll(/`(VBC-[\w-]+)`/g)].map(match => match[1]).sort();
        expect(listed).toEqual(optIn);
    });
});
