import { describe, it, expect } from 'vitest';
import { RegexChecker } from '../checkers/regex-checker';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';

const RULES_DIR = path.resolve(__dirname, '../../rules');
const rules = RuleLoader.loadRules([RULES_DIR]);

function checkRule(ruleId: string, content: string, filename = 'test.ts') {
    const ruleSet = rules.filter(r => r.id === ruleId);
    return RegexChecker.check(filename, ruleSet, content);
}

/**
 * Regression tests: these strings MUST NOT trigger their respective rules.
 * Any new test added here documents a confirmed false positive that was fixed.
 */
describe('False positive regressions', () => {

    describe('VBC-090 — passive-aggressive-comments', () => {
        it('getMagicLink() function name must not trigger', () => {
            expect(checkRule('VBC-090', `function getMagicLink() { return token; }`)).toHaveLength(0);
        });
        it('hackathon variable must not trigger', () => {
            expect(checkRule('VBC-090', `const hackathon = new Event('hackathon2025');`)).toHaveLength(0);
        });
        it('"simply put" in documentation must not trigger', () => {
            expect(checkRule('VBC-090', `// simply put, this returns the user`, 'docs.ts')).toHaveLength(0);
        });
        it('"sanity check" comment must not trigger', () => {
            expect(checkRule('VBC-090', `// sanity check: ensure id is not null`)).toHaveLength(0);
        });
    });

    describe('VBC-051 — mixed naming convention', () => {
        it('property access obj.git_check must not trigger', () => {
            expect(checkRule('VBC-051', `if (rule.git_check) return;`)).toHaveLength(0);
        });
        it('string "node_modules/" must not trigger', () => {
            expect(checkRule('VBC-051', `const path = 'node_modules/';`)).toHaveLength(0);
        });
        it('property access rule.ast_check must not trigger', () => {
            expect(checkRule('VBC-051', `const t = rule.ast_check?.type;`)).toHaveLength(0);
        });
    });

    describe('VBC-096 — complex-regex-pattern', () => {
        it('shebang line #!/usr/bin/env must not trigger', () => {
            expect(checkRule('VBC-096', `#!/usr/bin/env node`)).toHaveLength(0);
        });
        it('filter chain with .vscode/ path must not trigger', () => {
            expect(checkRule('VBC-096', `files.filter(f => f.includes('.vscode/'))`)).toHaveLength(0);
        });
    });

    describe('VBC-398 — excessive-punctuation', () => {
        it('TypeScript ?? operator must not trigger', () => {
            expect(checkRule('VBC-398', `const x = a ?? b;`, 'test.ts')).toHaveLength(0);
        });
        it('TypeScript !! double negation must not trigger', () => {
            expect(checkRule('VBC-398', `const isValid = !!value;`, 'test.ts')).toHaveLength(0);
        });
        it('nullish coalescing assignment ??= must not trigger', () => {
            expect(checkRule('VBC-398', `options ??= {};`, 'test.ts')).toHaveLength(0);
        });
    });

    describe('VBC-928 — lorem-ipsum', () => {
        it('own YAML rule file must not trigger', () => {
            // VBC-928 is file_type restricted to md/txt/html/js/ts — yaml is safe
            expect(checkRule('VBC-928', `regex: lorem ipsum`, 'rule.yaml')).toHaveLength(0);
        });
    });

    describe('VBC-901 — ip-address', () => {
        it('own YAML rule file must not trigger', () => {
            // VBC-901 has file_types: [js, ts, py, go, java, json, env]
            expect(checkRule('VBC-901', `regex: "\\d{1,3}\\.\\d{1,3}"`, 'rule.yaml')).toHaveLength(0);
        });
    });

    describe('VBC-943 — ignored-catch-variable', () => {
        it('catch (err) must not trigger', () => {
            expect(checkRule('VBC-943', `try { x(); } catch (err) { log(err); }`)).toHaveLength(0);
        });
        it('catch (error) must not trigger', () => {
            expect(checkRule('VBC-943', `try { x(); } catch (error) { console.error(error); }`)).toHaveLength(0);
        });
        it('catch (_) must trigger', () => {
            expect(checkRule('VBC-943', `try { x(); } catch (_) { }`).length).toBeGreaterThan(0);
        });
    });

    describe('VBC-005 — use-var', () => {
        it('"var" inside a line comment must not trigger', () => {
            expect(checkRule('VBC-005', `const apiBase = base; // the Vite env var or localhost`)).toHaveLength(0);
        });
        it('"var" inside a block comment must not trigger', () => {
            expect(checkRule('VBC-005', `/* reads live CSS var for canvas */\nconst x = 1;`)).toHaveLength(0);
        });
        it('ambient `declare var` must not trigger', () => {
            expect(checkRule('VBC-005', `declare var AudioWorkletProcessor: object;`)).toHaveLength(0);
        });
        it('ambient `declare var` in a .d.ts must not trigger', () => {
            expect(checkRule('VBC-005', `declare var sampleRate: number;`, 'global.d.ts')).toHaveLength(0);
        });
        it('a real `var` declaration MUST still trigger', () => {
            expect(checkRule('VBC-005', `var count = 1;`).length).toBeGreaterThan(0);
        });
    });
});
