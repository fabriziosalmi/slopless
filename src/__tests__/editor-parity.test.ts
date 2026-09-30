import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { lintText } from '../engine/api';

// The editor panel and the MCP server call `lintText`; the command line has its
// own loop. They were written separately and had drifted: the panel showed an
// error the author had suppressed and thirteen findings the project's vocabulary
// had excused, on the repository that ships the tool. This runs both on the same
// files and requires the same answer, so a check added to one and not the other
// fails here instead of in somebody's side panel.
//
// The command line is the built one, because it cannot be imported: importing it
// runs it. `dist` is committed and CI requires it to match a fresh build, so the
// file is always there; when it is stale, rebuild.
const CLI = path.join(__dirname, '..', '..', 'dist', 'index.js');

describe('the editor and the command line agree', () => {
    let sandbox: string;
    const files = ['a.ts', 'notes.md', 'bundle.js'];

    beforeAll(() => {
        sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-parity-')));
        fs.writeFileSync(path.join(sandbox, 'slopless.config.json'), JSON.stringify({
            rules: { 'VBC-338': 'warning' },
            vocabulary: ['blacklist'],
        }));
        fs.writeFileSync(path.join(sandbox, 'a.ts'), [
            'var plain = 1;',
            '// slopless-disable-next-line VBC-005 -- fixture',
            'var silenced = 2;',
            'const blacklist = [];',
            'const whitelist = [];',
            '',
        ].join('\n'));
        fs.writeFileSync(path.join(sandbox, 'notes.md'), [
            '# Notes',
            '',
            '<!-- slopless-disable-next-line VBC-928 -- fixture quoting the finding -->',
            'Lorem ipsum dolor sit amet.',
            '',
            'Lorem ipsum dolor sit amet, once more.',
            '',
        ].join('\n'));
        fs.writeFileSync(path.join(sandbox, 'bundle.js'), 'var a=1;'.repeat(400) + '\n');
    });
    afterAll(() => fs.rmSync(sandbox, { recursive: true, force: true }));

    const key = (file: string, ruleId: string, line: number) => `${path.basename(file)}:${line} ${ruleId}`;

    it('report the same findings on the same files', async () => {
        expect(fs.existsSync(CLI), `${CLI} is missing: run npm run build`).toBe(true);

        const run = cp.spawnSync(process.execPath, [
            CLI, '-f', 'json', '--no-cache', '--link-budget', '1',
            '-c', path.join(sandbox, 'slopless.config.json'),
            ...files.map(file => path.join(sandbox, file)),
        ], { cwd: sandbox, encoding: 'utf8' });
        // Exit 1 means errors were found, which is an answer; anything else is not.
        expect([0, 1], run.stderr).toContain(run.status);
        const command = (JSON.parse(run.stdout) as { file: string; ruleId: string; line: number }[])
            .map(v => key(v.file, v.ruleId, v.line)).sort();

        const editor: string[] = [];
        for (const file of files) {
            const at = path.join(sandbox, file);
            const found = await lintText(fs.readFileSync(at, 'utf8'), at, path.join(sandbox, 'slopless.config.json'));
            editor.push(...found.map(v => key(at, v.ruleId, v.line)));
        }
        editor.sort();

        // Not trivially equal: the fixture produces findings, and the ones it is
        // built to silence are not among them.
        expect(command).toContain('a.ts:1 VBC-005');
        expect(command).toContain('a.ts:5 VBC-338');
        expect(command).not.toContain('a.ts:3 VBC-005');
        expect(command).not.toContain('a.ts:4 VBC-338');
        expect(command.some(k => k.startsWith('bundle.js'))).toBe(false);

        expect(editor).toEqual(command);
    });
});
