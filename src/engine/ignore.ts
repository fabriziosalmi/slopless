import * as fs from 'fs';
import * as path from 'path';
import ignore from 'ignore';

/**
 * Its own module because importing it from the CLI ran the CLI. The editor
 * and the MCP server both need this list, and the MCP server speaks JSON-RPC
 * on stdout — a stray "No patterns provided" there is a corrupted protocol,
 * not a stray line.
 */

/**
 * Paths that are never the author's code. Without these a Django project's
 * collected staticfiles reported 1,122 findings inside xregexp.js and 319 inside
 * jquery.js — real matches, in libraries nobody in that repository wrote.
 *
 * `--init` has written these into `.sloplessignore` all along; applying them
 * without being asked is the difference between a tool that is right by default
 * and one that is right once you have read the manual.
 */
export const NEVER_YOURS = [
    'node_modules/', 'bower_components/', 'vendor/', 'third_party/', 'thirdparty/',
    '.venv/', 'venv/', 'site-packages/', 'staticfiles/', '.tox/', '__pycache__/',
    '.git/', 'dist/', 'build/', 'out/', '.next/', 'coverage/', '*.min.js', '*.min.css',
    // Framework build caches. They sit inside the source tree rather than beside
    // it, so a pattern written for the source reaches them: `.vitepress/cache`
    // holds rewritten copies of dependencies, and the rest are the same idea.
    // The `**/` matters: a pattern carrying a slash is anchored to the root,
    // and these live under whichever app directory owns them.
    '**/.vitepress/cache/', '.astro/', '.svelte-kit/', '.nuxt/', '.docusaurus/',
    '.parcel-cache/', '.turbo/', '.angular/',
];

export function applyIgnoreRules(files: string[], configIgnore?: string[], root?: string): string[] {
    return partitionIgnored(files, configIgnore, root).kept;
}

/** The files that survive the ignore rules, and how many each source removed. */
export function partitionIgnored(files: string[], configIgnore?: string[], root?: string): {
    kept: string[];
    vendored: number;
} {
    // The CLI runs in the directory being checked. An editor does not: its
    // process starts wherever the editor did, so the workspace has to be said.
    const cwd = root ?? process.cwd();
    const patterns: string[] = [];
    // A file git is told to ignore is build output, a local artefact, or
    // something generated — none of which anyone here wrote, which is the same
    // reason the list above exists. Reading it means the check agrees with what
    // the repository already considers its own source. `.sloplessignore` still
    // wins, because it is the one written for this tool.
    const gitignorePath = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
        patterns.push(...fs.readFileSync(gitignorePath, 'utf8').split(/\r?\n/));
    }
    const ignorePath = path.join(cwd, '.sloplessignore');
    if (fs.existsSync(ignorePath)) {
        // `ignore` splits a bare multi-line string, but treats an array entry as one
        // literal pattern, so the file has to be split before it goes in.
        patterns.push(...fs.readFileSync(ignorePath, 'utf8').split(/\r?\n/));
    }
    if (configIgnore?.length) patterns.push(...configIgnore);

    const relativeTo = (file: string) => {
        const relative = path.relative(cwd, path.resolve(cwd, file));
        return !relative || relative.startsWith('..') || path.isAbsolute(relative) ? null : relative;
    };

    const asked = patterns.length > 0 ? ignore().add(patterns) : null;
    const never = ignore().add(NEVER_YOURS);
    let vendored = 0;
    const kept = files.filter(file => {
        const relative = relativeTo(file);
        if (relative === null) return true;
        if (asked?.ignores(relative)) return false;
        if (never.ignores(relative)) { vendored++; return false; }
        return true;
    });
    return { kept, vendored };
}
