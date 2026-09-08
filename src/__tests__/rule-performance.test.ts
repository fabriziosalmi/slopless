import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';

const rules = RuleLoader.loadRules([path.join(__dirname, '..', '..', 'rules')])
    .filter(rule => typeof rule.match.regex === 'string');

/**
 * A pattern that compiles is not a pattern that finishes.
 *
 * `rule-loader.test.ts` asserts every regex is valid and the fixtures exercise
 * each one against a few dozen characters, which is far too little for
 * super-linear growth to show. Five rules shipped that way: `VBC-104` took 44
 * seconds on 200,000 blank lines, `VBC-035` 15 seconds on 32,000 unclosed tags,
 * and `VBC-017-B`, `VBC-936` and `VBC-051` were seconds on inputs anyone can put
 * in a pull request. None is interruptible, because a JavaScript regex cannot be
 * stopped once entered.
 *
 * What is banned here is the shape rather than the symptom. Measuring the
 * symptom needs wall-clock time, and this suite runs its files in parallel, so
 * the same match reads 12ms alone and 259ms under load — a threshold tuned to
 * one is wrong for the other. `scripts/check-rule-performance.js` does the
 * timing, serially, where the number means something. These two checks catch
 * different things and neither replaces the other.
 */
describe('rule patterns avoid the shapes that backtrack catastrophically', () => {
    it('does not start a multiline pattern with ^\\s*', () => {
        // With `m` every line start is a match position and `\s*` there can
        // swallow the newlines that follow it, so the engine has an ambiguous
        // split at every blank line and a file of them is quadratic. Indentation
        // is horizontal whitespace: `^[ \t]*` says that and cannot span lines.
        const offenders = rules
            .filter(rule => (rule.match.flags ?? '').includes('m'))
            .filter(rule => /\^\\s[*+]/.test(rule.match.regex as string))
            .map(rule => `${rule.id} — use ^[ \\t]* instead of ^\\s*`);

        expect(offenders).toEqual([]);
    });

    it('does not scan to the end of the file with an unbounded tempered token', () => {
        // `(?:(?!X)[\s\S])*` walks forward one character at a time looking for X,
        // and when X is absent it walks to the end of the file — once for every
        // candidate before it. A repetition bound turns that from quadratic into
        // linear, and the cost of the bound is a missed finding on input larger
        // than the bound, which is the safe direction.
        const offenders = rules
            .filter(rule => /\(\?:\(\?![^)]*\)\[\\s\\S\]\)\*/.test(rule.match.regex as string))
            .map(rule => `${rule.id} — bound the repetition, as in {0,2000}?`);

        expect(offenders).toEqual([]);
    });

    it('is examining every regex rule, so neither check passes by being empty', () => {
        expect(rules.length).toBeGreaterThan(100);
        expect(rules.filter(rule => (rule.match.flags ?? '').includes('m')).length)
            .toBeGreaterThan(0);
    });
});
