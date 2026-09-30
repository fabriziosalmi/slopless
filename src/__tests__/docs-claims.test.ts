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
    // `\s+` because the sentence wraps, and an indexOf that silently returned -1
    // used to turn this slice into "everything to the end of the page" — which
    // held up only until a later paragraph mentioned a rule in backticks.
    const start = page.search(/The opt-in set is/);
    const end = page.search(/Every\s+rule page says whether/);
    const section = start >= 0 && end > start ? page.slice(start, end) : '';

    it('finds the list it is meant to check', () => {
        expect(start, 'the "The opt-in set is" paragraph moved or was reworded').toBeGreaterThan(-1);
        expect(end, 'the sentence that ends the opt-in list moved or was reworded').toBeGreaterThan(start);
        expect(section.length).toBeGreaterThan(0);
    });

    it('lists each rule that ships disabled, and no rule that does not', () => {
        const optIn = rules.filter(rule => rule.opt_in).map(rule => rule.id).sort();
        const listed = [...section.matchAll(/`(VBC-[\w-]+)`/g)].map(match => match[1]).sort();
        expect(listed).toEqual(optIn);
    });
});

/**
 * `--only` names categories, and the list of them is written three times: in the
 * CLI's help, in the docs, and implicitly in the rules. The help and the docs both
 * omitted `correctness`, which three rules use, so a category was reachable and
 * nobody could have found out from either. The rules are the truth.
 */
describe('--only is documented with every category the rules declare', () => {
    const categories = [...new Set(rules.map(rule => rule.category))].sort();
    const help = fs.readFileSync(path.join(ROOT, 'src', 'index.ts'), 'utf8')
        .split('\n').find(line => line.includes("'--only <categories>'")) ?? '';
    const docs = fs.readFileSync(path.join(ROOT, 'docs', 'configuration.md'), 'utf8')
        .split('\n').find(line => line.startsWith('`--only` takes any of')) ?? '';

    it('found both places it is written', () => {
        expect(help, 'the --only option moved in src/index.ts').not.toBe('');
        expect(docs, 'the "`--only` takes any of" sentence moved').not.toBe('');
    });

    for (const category of categories) {
        it(`names ${category} in the help and in the docs`, () => {
            expect(help, 'CLI help').toContain(category);
            expect(docs, 'docs').toContain('`' + category + '`');
        });
    }
});
