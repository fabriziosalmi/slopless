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

describe('lintText — what the CLI says, for a buffer', () => {
    let sandbox: string;

    beforeEach(() => {
        sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-buffer-')));
    });
    afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

    const config = (body: unknown) => {
        const at = path.join(sandbox, 'slopless.config.json');
        fs.writeFileSync(at, JSON.stringify(body));
        return at;
    };
    const ids = async (text: string, file: string, at?: string) =>
        (await lintText(text, file, at)).map(v => v.ruleId);

    it('honours a disable directive, and only for the rule and the line it names', async () => {
        const marker = '// slopless-disable-next-line VBC-005 -- fixture\n';
        expect(await ids('var x = 1;\n', 'sample.ts', config({}))).toContain('VBC-005');
        expect(await ids(marker + 'var x = 1;\n', 'sample.ts', config({}))).not.toContain('VBC-005');
        // A directive for another rule silences nothing here.
        expect(await ids('// slopless-disable-next-line VBC-001 -- no\nvar x = 1;\n', 'sample.ts', config({})))
            .toContain('VBC-005');
    });

    it('reads the directive from the buffer, not from what was last saved', async () => {
        // The marker is typed, not yet saved: the file on disk is the old text.
        const file = path.join(sandbox, 'unsaved.ts');
        fs.writeFileSync(file, 'var x = 1;\n');
        const typed = '// slopless-disable-next-line VBC-005 -- fixture\nvar x = 1;\n';
        expect(await ids(typed, file, config({}))).not.toContain('VBC-005');

        // And the other way round: a marker saved and since deleted is gone.
        fs.writeFileSync(file, typed);
        expect(await ids('var x = 1;\n', file, config({}))).toContain('VBC-005');
    });

    it('honours the project vocabulary', async () => {
        const text = 'const blacklist = [];\n';
        const named = { rules: { 'VBC-338': 'warning' } };
        expect(await ids(text, 'sample.ts', config(named))).toContain('VBC-338');
        expect(await ids(text, 'sample.ts', config({ ...named, vocabulary: ['blacklist'] })))
            .not.toContain('VBC-338');
        // Whole words only: claiming one word does not excuse a neighbour.
        expect(await ids('const whitelist = [];\n', 'sample.ts', config({ ...named, vocabulary: ['blacklist'] })))
            .toContain('VBC-338');
    });

    it('leaves machine output alone, as the CLI does', async () => {
        const minified = 'var a=1;'.repeat(400) + '\n';
        expect(await ids(minified, 'bundle.js', config({}))).toEqual([]);
        // The same findings in text a person wrote are still reported.
        expect(await ids('var a = 1;\n', 'bundle.js', config({}))).toContain('VBC-005');
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
        // An empty config, not the repository's own: this project names VBC-338 in
        // its config, so asking for "the default" from the repository root would
        // be asking for the default plus that.
        const rules = resolveRules(config({}));
        expect(rules.length).toBeGreaterThan(100);
        expect(rules.some(rule => rule.opt_in)).toBe(false);
    });

    it('drops a rule the config turns off', () => {
        const at = config({ rules: { 'VBC-005': 'off' } });
        expect(resolveRules(at).some(rule => rule.id === 'VBC-005')).toBe(false);
        expect(resolveRules(config({})).some(rule => rule.id === 'VBC-005')).toBe(true);
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

        const withoutIt = resolveRules(config({}));
        expect(withoutIt.some(rule => rule.id === optIn!.id)).toBe(false);

        const at = config({ rules: { [optIn!.id]: 'warning' } });
        expect(resolveRules(at).some(rule => rule.id === optIn!.id)).toBe(true);
    });
});
