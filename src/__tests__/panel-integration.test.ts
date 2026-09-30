import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { host, type Item, type Provider, type Row } from './fakes/vscode';
import { activate } from '../../packages/vscode-slopless/client/src/extension';

// The extension is activated against a stand-in for the editor and its tree is
// walked the way the editor walks it. What this is for is what the pure tests
// cannot reach: the tree provider, which the editor refuses to draw if two items
// share an id, and the wiring between the commands, the filter and the scan. None
// of that could be seen without opening the window.

const git = (cwd: string, ...args: string[]) =>
    cp.execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe' });

/** Every node the editor would ask about, with the item it would draw. */
function walkTree(provider: Provider) {
    const items: { node: Row; item: Item }[] = [];
    const visit = (node?: Row) => {
        for (const child of provider.getChildren(node)) {
            items.push({ node: child, item: provider.getTreeItem(child) });
            visit(child);
        }
    };
    visit();
    return items;
}

describe('the findings panel, as the editor drives it', () => {
    let sandbox: string;

    const write = (name: string, body: string) => {
        const at = path.join(sandbox, name);
        fs.mkdirSync(path.dirname(at), { recursive: true });
        fs.writeFileSync(at, body);
    };

    const start = async () => {
        host.reset(sandbox);
        const context = {
            subscriptions: [] as unknown[],
            extension: { packageJSON: { version: '0.0.0-test' } },
            asAbsolutePath: (p: string) => path.join(sandbox, p),
            workspaceState: {
                get: (key: string) => host.state[key],
                update: (key: string, value: unknown) => {
                    host.state[key] = value;
                    return Promise.resolve();
                },
            },
        };
        activate(context as never);
        // `activate` starts a scan and does not hand it back, so the fake keeps
        // what the extension started; asking for one more and waiting for all of
        // them leaves nothing running when the sandbox is removed.
        await host.commands.get('slopless.scan')!();
        await Promise.all(host.pending);
    };
    const run = (command: string, ...args: unknown[]) => host.commands.get(command)!(...args);
    const rows = () => walkTree(host.provider);

    beforeEach(() => {
        sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-panel-')));
        git(sandbox, 'init', '-q');
        write('slopless.config.json', '{}');
        write('a.ts', 'var first = 1;\nvar second = 2;\n');
        write('sub/a.ts', 'var third = 3;\n');            // the same name in another directory
        write('clean.ts', 'export const ok = 1;\n');
        // Carries its own disable marker, so the panel must not list it.
        write('notes.md', '<!-- slopless-disable-next-line VBC-928 -- fixture -->\nLorem ipsum dolor sit amet.\n');
        git(sandbox, 'add', '-A');
        git(sandbox, 'commit', '-qm', 'init');
    });
    afterEach(() => fs.rmSync(sandbox, { recursive: true, force: true }));

    it('lists the files that have findings, and only those', async () => {
        await start();
        const files = host.provider.getChildren();
        expect(files.map((f: Row) => f.path).sort()).toEqual(['a.ts', 'sub/a.ts']);
    });

    it('does not list a finding the author suppressed, which is what the CLI does too', async () => {
        await start();
        expect(host.provider.getChildren().some((f: Row) => f.path === 'notes.md')).toBe(false);
    });

    it('gives every node an id of its own, in both groupings', async () => {
        await start();
        for (const grouping of ['slopless.groupByFile', 'slopless.groupByRule']) {
            await run(grouping);
            const ids = rows().map(({ item }) => item.id);
            expect(ids.length, grouping).toBeGreaterThan(2);
            expect(ids.every(id => typeof id === 'string' && id.length > 0), grouping).toBe(true);
            expect(new Set(ids).size, `${grouping}: ids repeat`).toBe(ids.length);
        }
    });

    it('tells two files of one name apart', async () => {
        await start();
        const same = host.provider.getChildren().map((node: Row) => host.provider.getTreeItem(node));
        expect(same.map((i: Item) => i.label)).toEqual(['a.ts', 'a.ts']);
        expect(new Set(same.map((i: Item) => i.id)).size).toBe(2);
        expect(new Set(same.map((i: Item) => i.description)).size).toBe(2);
    });

    it('counts on the badge and says which number is which', async () => {
        await start();
        expect(host.view.options.showCollapseAll).toBe(true);
        expect(host.view.badge).toEqual({ value: 3, tooltip: '3 warnings' });
        expect(host.view.message).toBe('0 errors and 3 warnings in 2 of 5 files.');
    });

    it('groups by rule, and remembers the choice', async () => {
        await start();
        await run('slopless.groupByRule');
        expect(host.contexts['slopless.grouping']).toBe('rule');
        expect(host.state['slopless.grouping']).toBe('rule');

        const [rule] = host.provider.getChildren();
        expect(rule.kind).toBe('rule');
        expect(rule.group.ruleId).toBe('VBC-005');
        const leaves = host.provider.getChildren(rule).map((n: Row) => host.provider.getTreeItem(n));
        expect(leaves.map((i: Item) => i.label)).toEqual(['a.ts:1', 'a.ts:2', 'a.ts:1']);
        expect(leaves.every((i: Item) => i.contextValue === 'finding')).toBe(true);

        await run('slopless.groupByFile');
        expect(host.contexts['slopless.grouping']).toBe('file');
        expect(host.provider.getChildren()[0].kind).toBe('file');
    });

    it('starts in the grouping it was left in', async () => {
        host.reset(sandbox);
        host.state['slopless.grouping'] = 'rule';
        const context = {
            subscriptions: [], extension: { packageJSON: { version: '0' } },
            asAbsolutePath: (p: string) => p,
            workspaceState: { get: (k: string) => host.state[k], update: () => Promise.resolve() },
        };
        activate(context as never);
        await Promise.all(host.pending);
        expect(host.provider.grouping).toBe('rule');
        expect(host.contexts['slopless.grouping']).toBe('rule');
    });

    describe('narrowed to what git says changed', () => {
        it('shows only the changed files, and says so', async () => {
            write('sub/a.ts', 'var third = 3;\nvar fourth = 4;\n');
            await start();
            await run('slopless.onlyChanged');

            expect(host.contexts['slopless.onlyChanged']).toBe(true);
            expect(host.provider.getChildren().map((f: Row) => f.path)).toEqual(['sub/a.ts']);
            expect(host.view.message).toBe('0 errors and 2 warnings in 1 of 5 files. Only files changed in git.');
            expect(host.view.badge?.value).toBe(2);

            await run('slopless.copyReport');
            expect(host.clipboard).toContain('Only files changed in git.');
            expect(host.clipboard).toContain('sub/a.ts');
            expect(host.clipboard).not.toContain('### a.ts');

            await run('slopless.allFiles');
            expect(host.contexts['slopless.onlyChanged']).toBe(false);
            expect(host.provider.getChildren()).toHaveLength(2);
            expect(host.view.message).not.toContain('Only files changed');
        });

        it('notices a file that became changed after the filter was switched on', async () => {
            await start();
            await run('slopless.onlyChanged');
            expect(host.provider.getChildren()).toHaveLength(0);

            // Edited and saved, as the editor would report it.
            write('a.ts', 'var first = 1;\nvar second = 2;\nvar more = 3;\n');
            for (const handler of host.saveHandlers) {
                await handler({
                    uri: { fsPath: path.join(sandbox, 'a.ts'), toString: () => `file://${path.join(sandbox, 'a.ts')}` },
                    getText: () => fs.readFileSync(path.join(sandbox, 'a.ts'), 'utf8'),
                });
            }
            expect(host.provider.getChildren().map((f: Row) => f.path)).toEqual(['a.ts']);
            expect(host.provider.getChildren()[0].findings).toHaveLength(3);
        });

        it('refuses, and says why, where git cannot tell', async () => {
            fs.rmSync(path.join(sandbox, '.git'), { recursive: true, force: true });
            await start();
            await run('slopless.onlyChanged');

            expect(host.provider.changed).toBeNull();
            expect(host.contexts['slopless.onlyChanged']).toBe(false);
            expect(host.provider.getChildren()).toHaveLength(2);
            expect(host.messages.join('\n')).toContain('not a git repository');
        });
    });

    it('opens the docs from a rule as well as from a finding', async () => {
        await start();
        await run('slopless.groupByRule');
        const [rule] = host.provider.getChildren();
        await run('slopless.openRuleDocs', rule);
        await run('slopless.openRuleDocs', host.provider.getChildren(rule)[0]);
        // A node that is neither does nothing rather than throwing.
        await run('slopless.openRuleDocs', undefined);
        expect(host.opened).toEqual([
            'https://fabriziosalmi.github.io/slopless/rules/VBC-005',
            'https://fabriziosalmi.github.io/slopless/rules/VBC-005',
        ]);
    });
});
