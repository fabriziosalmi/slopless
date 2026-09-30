import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    countsText, fileDescription, findingDescription, groupByRule, locationLabel, orderFiles,
    parseStatus, shortDir, summaryMessage, type Summary,
} from '../../packages/vscode-slopless/client/src/panel';
import { report, type Finding } from '../../packages/vscode-slopless/client/src/report';

const finding = (over: Partial<Finding> = {}): Finding => ({
    ruleId: 'VBC-005', name: 'use-var', severity: 'warning', message: 'Use let.', line: 1, ...over,
});
const file = (p: string, findings: Finding[]) => ({ path: p, findings });

describe('how a file row reads', () => {
    it('puts the end of the path first, because a narrow sidebar cuts the right-hand side', () => {
        // Both used to read "packages/vscode-slopless…" once cut.
        const client = fileDescription('packages/vscode-slopless/client/src/report.ts', [finding()]);
        const server = fileDescription('packages/vscode-slopless/server/src/server.ts', [finding()]);
        expect(client.startsWith('client/src')).toBe(true);
        expect(server.startsWith('server/src')).toBe(true);
        expect(client).not.toBe(server);
    });

    it('tells two files with one name apart', () => {
        expect(fileDescription('packages/a/src/index.ts', [finding()]))
            .not.toBe(fileDescription('packages/b/src/index.ts', [finding()]));
    });

    it('says nothing about a directory for a file at the root', () => {
        expect(shortDir('CHANGELOG.md')).toBe('');
        expect(fileDescription('CHANGELOG.md', [finding({ severity: 'error' }), finding()]))
            .toBe('1 error, 1 warning');
    });

    it('reads a Windows-style path the same way', () => {
        expect(shortDir('packages\\x\\src\\a.ts')).toBe('x/src');
    });

    it('counts errors only when there are some', () => {
        expect(countsText(0, 5)).toBe('5 warnings');
        expect(countsText(1, 0)).toBe('1 error, 0 warnings');
    });
});

describe('how a finding row reads', () => {
    it('leads with the line, the one thing needed to go and look', () => {
        expect(findingDescription(finding({ line: 42 }))).toBe('line 42 · VBC-005');
        expect(locationLabel('src/engine/api.ts', 54)).toBe('api.ts:54');
    });
});

describe('orderFiles', () => {
    it('puts errors first, then the most findings, then the path', () => {
        const ordered = orderFiles([
            file('z.ts', [finding(), finding(), finding()]),
            file('b.ts', [finding()]),
            file('a.ts', [finding()]),
            file('e.ts', [finding({ severity: 'error' })]),
        ]);
        expect(ordered.map(f => f.path)).toEqual(['e.ts', 'z.ts', 'a.ts', 'b.ts']);
    });

    it('does not reorder what it was given', () => {
        const given = [file('b.ts', [finding()]), file('a.ts', [finding()])];
        orderFiles(given);
        expect(given.map(f => f.path)).toEqual(['b.ts', 'a.ts']);
    });
});

describe('groupByRule', () => {
    const files = [
        file('b.ts', [finding({ ruleId: 'VBC-084', name: 'long-line', line: 9 }), finding({ line: 3 })]),
        file('a.ts', [finding({ ruleId: 'VBC-084', name: 'long-line', line: 2 })]),
        file('c.ts', [finding({ ruleId: 'VBC-001', name: 'secret', severity: 'error' })]),
    ];

    it('lists errors first, then the rule with the most findings', () => {
        expect(groupByRule(files).map(g => `${g.ruleId}:${g.items.length}`))
            .toEqual(['VBC-001:1', 'VBC-084:2', 'VBC-005:1']);
    });

    it('keeps every finding exactly once, in file and line order', () => {
        const groups = groupByRule(files);
        expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(4);
        const long = groups.find(g => g.ruleId === 'VBC-084')!;
        expect(long.items.map(i => `${i.file.path}:${i.finding.line}`)).toEqual(['a.ts:2', 'b.ts:9']);
    });
});

describe('summaryMessage', () => {
    const base: Summary = { errors: 1, warnings: 119, files: 17, read: 252, limit: 2000 };

    it('says which number is which, and how much was read', () => {
        expect(summaryMessage(base)).toBe('1 error and 119 warnings in 17 of 252 files.');
    });

    it('says when the list is narrowed', () => {
        expect(summaryMessage({ ...base, scope: 'Only files changed in git.' }))
            .toBe('1 error and 119 warnings in 17 of 252 files. Only files changed in git.');
    });

    it('does not read as clean when nothing is found, and says what was looked at', () => {
        expect(summaryMessage({ ...base, errors: 0, warnings: 0, files: 0 })).toBe('Nothing found in 252 files.');
    });

    it('says when the scan stopped short, without dropping the counts', () => {
        const message = summaryMessage({ ...base, read: 2000 });
        expect(message).toContain('1 error and 119 warnings');
        expect(message).toContain('Stopped at 2000 files');
    });
});

describe('the report says what it covers', () => {
    it('names the narrowing, so a report of the changed files is not read as the whole', () => {
        const text = report([file('a.ts', [finding()])], 252, '1.18.1', 'Only files changed in git.');
        expect(text).toContain('Only files changed in git.');
        expect(report([file('a.ts', [finding()])], 252, '1.18.1')).not.toContain('Only files');
    });
});

describe('parseStatus, against what git really prints', () => {
    let repo: string;
    const git = (cwd: string, ...args: string[]) =>
        cp.execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });

    beforeAll(() => {
        repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-status-')));
        git(repo, 'init', '-q');
        fs.mkdirSync(path.join(repo, 'sub', 'dir'), { recursive: true });
        for (const name of ['keep.txt', 'gone.txt', 'old.txt', 'sp ace.txt', 'sub/dir/in.txt']) {
            fs.writeFileSync(path.join(repo, name), 'a\n');
        }
        git(repo, 'add', '-A');
        git(repo, 'commit', '-qm', 'init');

        fs.appendFileSync(path.join(repo, 'keep.txt'), 'b\n');                // modified
        fs.appendFileSync(path.join(repo, 'sp ace.txt'), 'b\n');              // modified, a space in the name
        fs.appendFileSync(path.join(repo, 'sub', 'dir', 'in.txt'), 'b\n');    // modified, in a subdirectory
        fs.rmSync(path.join(repo, 'gone.txt'));                               // deleted
        git(repo, 'mv', 'old.txt', 'new.txt');                                // renamed
        fs.writeFileSync(path.join(repo, 'untracked.txt'), 'x\n');            // untracked
        fs.mkdirSync(path.join(repo, 'newdir'));
        fs.writeFileSync(path.join(repo, 'newdir', 'file.txt'), 'x\n');       // untracked, in a new directory
    });
    afterAll(() => fs.rmSync(repo, { recursive: true, force: true }));

    const status = (cwd: string) => git(cwd, 'status', '--porcelain', '-z', '--untracked-files=all');
    const names = (paths: string[], root: string) => paths.map(p => path.relative(root, p)).sort();

    it('lists what changed, what is new and where a file was moved to, and not what is gone', () => {
        expect(names(parseStatus(status(repo), repo), repo)).toEqual([
            'keep.txt', 'new.txt', 'newdir/file.txt', 'sp ace.txt', 'sub/dir/in.txt', 'untracked.txt',
        ].sort());
    });

    it('names only files that exist, which the old name of a rename is not', () => {
        // Checked against the disk rather than for one name: read as an entry of
        // its own the old name comes out cut at the wrong place, as `.txt`, and a
        // test that looks for `old.txt` would pass on that.
        const listed = parseStatus(status(repo), repo);
        expect(listed.length).toBeGreaterThan(0);
        for (const found of listed) expect(fs.existsSync(found), found).toBe(true);
    });

    it('answers for a workspace that is a subdirectory, using its own root', () => {
        const root = path.join(repo, 'sub', 'dir');
        const prefix = git(root, 'rev-parse', '--show-prefix').trim();
        expect(prefix).toBe('sub/dir/');
        // Git prints paths from the top of the repository wherever it is run, so
        // only what lies under the workspace is kept, and it is joined onto the
        // workspace's own path.
        expect(names(parseStatus(status(root), root, prefix), root)).toEqual(['in.txt']);
    });

    it('says nothing for an empty status', () => {
        expect(parseStatus('', repo)).toEqual([]);
    });
});
