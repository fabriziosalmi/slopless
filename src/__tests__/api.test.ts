import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { lintText, resolveRules } from '../engine/api';
import { RuleLoader } from '../engine/loader';

const RULES_DIR = path.join(__dirname, '..', '..', 'rules');

describe('lintText', () => {
    it('reports on a buffer that is not on disk', async () => {
        const findings = await lintText('var x = 1;\n', 'sample.ts');
        expect(findings.map(v => v.ruleId)).toContain('VBC-005');
    });

    it('lets the path decide, so the same text answers differently', async () => {
        // The whole point of taking a path alongside the text: a credential in a
        // fixture is a fixture, and the same line in src/ is a finding.
        const secret = 'const password = "hunter2abc";\n';
        const source = await lintText(secret, 'src/auth/session.ts');
        const fixture = await lintText(secret, 'src/auth/session.test.ts');

        expect(source.map(v => v.ruleId)).toContain('VBC-001');
        expect(fixture.map(v => v.ruleId)).not.toContain('VBC-001');
    });

    it('reports an empty file as empty rather than as clean', async () => {
        // Nothing found and nothing there are different answers, and the second
        // is the one an empty file deserves.
        expect((await lintText('', 'sample.ts')).map(v => v.ruleId)).toEqual(['VBC-026']);
    });
});

describe('resolveRules', () => {
    let sandbox: string;
    const original = process.cwd();

    beforeEach(() => {
        sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-api-')));
    });
    afterEach(() => {
        process.chdir(original);
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const config = (body: unknown) => {
        const at = path.join(sandbox, 'slopless.config.json');
        fs.writeFileSync(at, JSON.stringify(body));
        return at;
    };

    it('is the set the linter would run, with opt-in rules left out', () => {
        const rules = resolveRules();
        expect(rules.length).toBeGreaterThan(100);
        expect(rules.some(rule => rule.opt_in)).toBe(false);
    });

    it('drops a rule the config turns off', () => {
        const at = config({ rules: { 'VBC-005': 'off' } });
        expect(resolveRules(at).some(rule => rule.id === 'VBC-005')).toBe(false);
        expect(resolveRules().some(rule => rule.id === 'VBC-005')).toBe(true);
    });

    it('applies a severity the config overrides', () => {
        const at = config({ rules: { 'VBC-005': 'warning' } });
        expect(resolveRules(at).find(rule => rule.id === 'VBC-005')?.severity).toBe('warning');
    });

    it('reads the config it is pointed at, not the one beside the process', () => {
        // The editor and the MCP server do not run in the workspace, so a config
        // that only applies when cwd happens to be right is a config that never
        // applied there at all.
        const at = config({ rules: { 'VBC-005': 'off' } });
        process.chdir(os.tmpdir());
        expect(resolveRules(at).some(rule => rule.id === 'VBC-005')).toBe(false);
    });

    it('resolves customRulesPaths against the config, not the working directory', () => {
        fs.mkdirSync(path.join(sandbox, 'my-rules'));
        fs.writeFileSync(path.join(sandbox, 'my-rules', 'VBC-9001.yaml'), [
            'id: VBC-9001',
            'name: no-frobnicating',
            'severity: warning',
            'category: clean-code',
            'match:',
            '  regex: frobnicate',
            '  file_types: [ts]',
            'message: Frobnicating at line {line}.',
            'tests:',
            '  fire:',
            '    - frobnicate()',
            '  quiet:',
            '    - fizzbuzz()',
        ].join('\n'));

        const at = config({ customRulesPaths: ['./my-rules'] });
        process.chdir(os.tmpdir());
        expect(resolveRules(at).some(rule => rule.id === 'VBC-9001')).toBe(true);
    });

    it('turns an opt-in rule on when the config names it', () => {
        const optIn = RuleLoader.loadRules([RULES_DIR]).find(rule => rule.opt_in);
        expect(optIn, 'no opt-in rule to exercise').toBeDefined();

        const withoutIt = resolveRules();
        expect(withoutIt.some(rule => rule.id === optIn!.id)).toBe(false);

        const at = config({ rules: { [optIn!.id]: 'warning' } });
        expect(resolveRules(at).some(rule => rule.id === optIn!.id)).toBe(true);
    });
});
