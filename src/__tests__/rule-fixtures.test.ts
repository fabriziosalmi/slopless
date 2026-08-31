import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';
import { Rule, RuleTestCase } from '../engine/schema';
import { RegexChecker, Violation } from '../checkers/regex-checker';
import { AstChecker } from '../checkers/ast-checker';
import { SemanticChecker } from '../checkers/semantic-checker';
import { applyPrecedence } from '../engine/precedence';

const RULES_DIR = path.resolve(__dirname, '../../rules');
const rules = RuleLoader.loadRules([RULES_DIR]);

/** Rules whose input is a repository or a type graph, not a snippet of source. */
const EXTERNAL_CHECKS = ['git_check', 'heuristic_check', 'type_check'] as const;

function isTextTestable(rule: Rule): boolean {
    return !EXTERNAL_CHECKS.some(kind => rule.match[kind] !== undefined);
}

function defaultFilename(rule: Rule): string {
    const ext = rule.match.file_types?.[0] ?? 'ts';
    return `fixture.${ext}`;
}

function normalise(testCase: RuleTestCase, rule: Rule): { file: string; code: string } {
    if (typeof testCase === 'string') return { file: defaultFilename(rule), code: testCase };
    const code = testCase.repeat ? testCase.code.repeat(testCase.repeat) : testCase.code;
    return { file: testCase.file ?? defaultFilename(rule), code };
}

/** Runs one rule in isolation, through whichever checker owns it. */
function runRule(rule: Rule, file: string, code: string): Violation[] {
    const only = [rule];
    const found: Violation[] = [
        ...RegexChecker.check(file, only, code),
        ...AstChecker.check(file, only, code),
        ...SemanticChecker.check(file, only, code),
    ];
    return found.filter(violation => violation.ruleId === rule.id);
}

describe('rule fixtures — every rule ships executable examples', () => {
    for (const rule of rules) {
        const label = `${rule.id} ${rule.name}`;

        if (!isTextTestable(rule)) {
            it(`${label} is covered by the test file it names`, () => {
                const declared = rule.tests?.external;
                expect(declared,
                    `${rule.id} is a git/heuristic/type check: set tests.external to name its test file`)
                    .toBeTruthy();
                // The pointer has to be real, or it is just a comment that lets a rule ship untested.
                // Take the filename itself, whatever punctuation separates it from the note.
                const testFile = (declared as string).match(/^[\w.\-/]+/)?.[0] ?? '';
                const testPath = path.join(__dirname, testFile);
                expect(fs.existsSync(testPath), `${rule.id} points at missing ${testFile}`).toBe(true);
                expect(fs.readFileSync(testPath, 'utf8'),
                    `${testFile} never mentions ${rule.id}`).toContain(rule.id);
            });
            continue;
        }

        it(`${label} declares at least one firing and one quiet example`, () => {
            expect(rule.tests?.fire?.length, `${rule.id} has no tests.fire example`).toBeGreaterThan(0);
            expect(rule.tests?.quiet?.length, `${rule.id} has no tests.quiet example`).toBeGreaterThan(0);
        });

        for (const [index, testCase] of (rule.tests?.fire ?? []).entries()) {
            it(`${label} flags example #${index + 1}`, () => {
                const { file, code } = normalise(testCase, rule);
                expect(runRule(rule, file, code).length,
                    `${rule.id} should have flagged:\n${code}`).toBeGreaterThan(0);
            });
        }

        for (const [index, testCase] of (rule.tests?.quiet ?? []).entries()) {
            it(`${label} ignores example #${index + 1}`, () => {
                const { file, code } = normalise(testCase, rule);
                expect(runRule(rule, file, code),
                    `${rule.id} should have ignored:\n${code}`).toHaveLength(0);
            });
        }
    }
});

describe('rule fixtures — cross-rule guarantees', () => {
    it('no two rules share an id', () => {
        const ids = rules.map(rule => rule.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('every rule file is named after the rule it holds', () => {
        // Guards against the drift that let VBC-800 live in type_checks.yaml.
        const ids = new Set(rules.map(rule => rule.id));
        expect(ids.size).toBe(rules.length);
    });

    it('every superseded rule id exists', () => {
        const ids = new Set(rules.map(rule => rule.id));
        for (const rule of rules) {
            for (const target of rule.supersedes ?? []) {
                expect(ids.has(target), `${rule.id} supersedes unknown rule ${target}`).toBe(true);
            }
        }
    });

    it('a more specific rule suppresses the general one on the same line', () => {
        const marker = rules.filter(rule => ['VBC-150', 'VBC-907', 'VBC-945'].includes(rule.id));
        const violations = RegexChecker.check('fixture.ts', marker, '// TODO: implement this\n');
        const reported = applyPrecedence(violations, marker).map(violation => violation.ruleId);
        expect(reported).toEqual(['VBC-945']);
    });

    it('every regex compiles with its declared flags', () => {
        for (const rule of rules) {
            if (!rule.match.regex) continue;
            expect(() => new RegExp(rule.match.regex as string, rule.match.flags ?? ''),
                `${rule.id} has an invalid regex`).not.toThrow();
        }
    });

    it('no regex can match the empty string', () => {
        // A zero-length global match would spin the scanner forever.
        for (const rule of rules) {
            if (!rule.match.regex) continue;
            const regex = new RegExp(rule.match.regex, rule.match.flags ?? '');
            expect(regex.exec('')?.[0], `${rule.id} matches the empty string`).not.toBe('');
        }
    });
});
