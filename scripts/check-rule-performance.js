#!/usr/bin/env node
/**
 * Times every rule pattern against the input shapes that make a backtracking
 * engine work hardest, and fails when one grows with the square of its input.
 *
 * This lives in a script rather than in the test suite because vitest runs its
 * files in parallel and a timing there measures the contention as much as the
 * pattern: the same match read 12ms alone and 259ms under a loaded suite, and a
 * threshold tuned to one was wrong for the other about a third of the time. Run
 * on its own, the numbers mean something.
 *
 * `src/__tests__/rule-performance.test.ts` bans the two shapes that caused this
 * in the first place, deterministically. This catches whatever that cannot see.
 */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RULES_DIR = path.join(__dirname, '..', 'rules');

/** One unit of each shape, repeated to size. */
const SHAPES = {
    'blank lines': '\n',
    'indented blank lines': '   \n',
    'spaces': ' ',
    'one repeated letter': 'a',
    'open angle brackets': '<',
    'quotes': '"',
    'braces': '{',
    'backticks': '`',
    'unclosed svg in buttons': '<button>\n  <svg>\n',
    'unclosed tags': '<div class="a" ',
    'unclosed div handlers': '<div onClick ',
    'imports with no require': 'import x from "y";\n',
    'requires with no import': 'const p = require("path");\n',
    'assignments': 'a = ',
    'relative paths': '../',
    'urls': 'http://',
    'attributes': 'foo="bar" ',
    'mixed naming': 'a_b aB ',
    'long words': 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx ',
};

const SMALL_BYTES = 15000;
/** Four times the input is four times the work when linear, sixteen when not. */
const SIZE_FACTOR = 4;
const NOTICEABLE_MS = 40;
const GROWTH_LIMIT = 8;
const ABSOLUTE_LIMIT_MS = 2000;

/** The fastest of several runs: contention can only ever make a run slower. */
function timeMatch(source, flags, subject, samples) {
    let fastest = Infinity;
    for (let attempt = 0; attempt < samples; attempt++) {
        const regex = new RegExp(source, flags);
        const started = process.hrtime.bigint();
        regex.test(subject);
        fastest = Math.min(fastest, Number(process.hrtime.bigint() - started) / 1e6);
    }
    return fastest;
}

const rules = [];
for (const file of fs.readdirSync(RULES_DIR).filter(f => /\.ya?ml$/.test(f))) {
    let doc;
    try {
        doc = yaml.load(fs.readFileSync(path.join(RULES_DIR, file), 'utf8'));
    } catch (error) {
        console.error(`✗ ${file} does not parse: ${error.message}`);
        process.exitCode = 1;
        continue;
    }
    if (doc && doc.match && typeof doc.match.regex === 'string') rules.push(doc);
}

if (rules.length < 100) {
    console.error(`✗ Only ${rules.length} regex rules loaded. Something is wrong with the rules `
        + 'directory, and a check that examines nothing cannot pass.');
    process.exit(1);
}

const failures = [];
let slowest = { ms: 0, id: '-', shape: '-' };

for (const [shape, unit] of Object.entries(SHAPES)) {
    const repeats = Math.max(1, Math.floor(SMALL_BYTES / unit.length));
    const small = unit.repeat(repeats);
    const large = unit.repeat(repeats * SIZE_FACTOR);

    for (const rule of rules) {
        const source = rule.match.regex;
        const flags = rule.match.flags || '';

        const probe = timeMatch(source, flags, small, 1);
        if (probe > slowest.ms) slowest = { ms: probe, id: rule.id, shape };
        if (probe < NOTICEABLE_MS / GROWTH_LIMIT) continue;

        const atSmall = timeMatch(source, flags, small, 3);
        const atLarge = timeMatch(source, flags, large, 3);
        if (atLarge < NOTICEABLE_MS) continue;

        const growth = atLarge / atSmall;
        if (growth >= GROWTH_LIMIT) {
            failures.push(`${rule.id} on ${shape}: ${atSmall.toFixed(0)}ms at ${small.length} bytes `
                + `became ${atLarge.toFixed(0)}ms at ${large.length} `
                + `(x${growth.toFixed(1)}; linear would be x${SIZE_FACTOR})`);
        } else if (atLarge > ABSOLUTE_LIMIT_MS) {
            failures.push(`${rule.id} on ${shape}: ${atLarge.toFixed(0)}ms at ${large.length} bytes`);
        }
    }
}

if (failures.length > 0) {
    for (const failure of failures) console.error('✗ ' + failure);
    console.error('\nA rule that grows with the square of its input is a denial of service: the '
        + 'content is whatever a pull request contains, and a JavaScript regex cannot be '
        + 'interrupted once it has started. Bound the repetition that is doing the scanning.');
    process.exit(1);
}

console.log(`${rules.length} rule patterns × ${Object.keys(SHAPES).length} hostile input shapes: `
    + `all linear. Slowest single match ${slowest.ms.toFixed(1)}ms `
    + `(${slowest.id} on ${slowest.shape}). ✓`);
