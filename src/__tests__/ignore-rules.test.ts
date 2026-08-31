import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyIgnoreRules } from '../index';

describe('applyIgnoreRules', () => {
    const originalCwd = process.cwd();
    let sandbox: string;

    beforeEach(() => {
        sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-ignore-')));
        process.chdir(sandbox);
        fs.writeFileSync(path.join(sandbox, '.sloplessignore'), 'node_modules/\ndist/\ndocs/\n*.min.js\n');
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    it('drops every path the ignore file covers', () => {
        // Each line has to become its own pattern; a single multi-line string passed
        // inside an array is treated as one literal pattern and matches nothing.
        const kept = applyIgnoreRules([
            'src/index.ts', 'docs/story.md', 'dist/index.js',
            'node_modules/x/y.js', 'vendor/app.min.js',
        ]);
        expect(kept).toEqual(['src/index.ts']);
    });

    it('accepts an absolute path inside the project and still ignores it', () => {
        const kept = applyIgnoreRules([path.join(sandbox, 'docs', 'story.md')]);
        expect(kept).toHaveLength(0);
    });

    it('keeps an absolute path inside the project that nothing ignores', () => {
        const target = path.join(sandbox, 'src', 'index.ts');
        expect(applyIgnoreRules([target])).toEqual([target]);
    });

    it('never throws on a path outside the project, and keeps it', () => {
        // `ignore` rejects anything that is not a relative path, which used to crash
        // the whole run with a RangeError before the file list was even read.
        const outside = path.join(os.tmpdir(), 'somewhere-else', 'notes.md');
        expect(() => applyIgnoreRules([outside])).not.toThrow();
        expect(applyIgnoreRules([outside])).toEqual([outside]);
    });

    it('merges patterns from the config with the ignore file', () => {
        const kept = applyIgnoreRules(['src/index.ts', 'vendor/lib.ts'], ['vendor/**']);
        expect(kept).toEqual(['src/index.ts']);
    });

    it('returns the list untouched when nothing is configured', () => {
        fs.rmSync(path.join(sandbox, '.sloplessignore'));
        const files = ['src/index.ts', 'docs/story.md'];
        expect(applyIgnoreRules(files)).toEqual(files);
    });
});
