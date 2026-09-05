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

    it('drops framework build caches, which sit inside the source tree', () => {
        // None of these paths may contain a segment the sandbox ignore file
        // already covers, or the test would pass without the list being read.
        const generated = [
            'apps/site/.vitepress/cache/deps/vue.js',
            'web/.astro/types.d.ts',
            'web/.svelte-kit/generated/root.svelte',
            'app/.nuxt/app.config.mjs',
            'www/.docusaurus/registry.js',
            'src/__pycache__/mod.cpython-311.pyc',
            'ui/.turbo/turbo-build.log',
        ];
        expect(applyIgnoreRules([...generated, 'src/app.ts'])).toEqual(['src/app.ts']);
    });

    it('reads .gitignore, because a file git ignores is not source either', () => {
        fs.writeFileSync(path.join(sandbox, '.gitignore'), 'generated/\n*.tmp\n');
        expect(applyIgnoreRules(['generated/out.js', 'notes.tmp', 'src/app.ts']))
            .toEqual(['src/app.ts']);
    });

    it('takes a root, because an editor does not run in the directory it checks', () => {
        fs.writeFileSync(path.join(sandbox, '.gitignore'), 'built/\n');
        const elsewhere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-cwd-')));
        process.chdir(elsewhere);
        try {
            const files = [path.join(sandbox, 'built/x.js'), path.join(sandbox, 'src/app.ts')];
            // Without the root it cannot see the sandbox's .gitignore at all.
            expect(applyIgnoreRules(files)).toEqual(files);
            expect(applyIgnoreRules(files, undefined, sandbox))
                .toEqual([path.join(sandbox, 'src/app.ts')]);
        } finally {
            process.chdir(sandbox);
            fs.rmSync(elsewhere, { recursive: true, force: true });
        }
    });

    it('returns the list untouched when nothing is configured', () => {
        fs.rmSync(path.join(sandbox, '.sloplessignore'));
        const files = ['src/index.ts', 'docs/story.md'];
        expect(applyIgnoreRules(files)).toEqual(files);
    });
});
