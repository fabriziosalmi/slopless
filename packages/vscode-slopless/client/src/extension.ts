import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

import { lintText, applyIgnoreRules, loadConfig } from 'slopless/dist/engine/api';

import {
    commentSyntax, findingBlock, plural, report, suppression, type Finding,
} from './report';
import {
    countOf, countsText, fileDescription, findingDescription, groupByRule, locationLabel, orderFiles,
    parseStatus, shortDir, summaryMessage, type Grouping, type RuleGroup,
} from './panel';

/**
 * The languages the rules actually reach, which is what `docs/languages.md`
 * generates from the rules themselves. Listing fewer here would leave a file
 * unchecked with nothing saying so; listing more would attach a server to a
 * document it has nothing to say about.
 */
const LANGUAGES = [
    'javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'astro',
    'python', 'go', 'rust', 'java', 'ruby', 'csharp', 'c', 'cpp', 'kotlin', 'swift',
    'php', 'shellscript', 'html', 'css', 'scss', 'less', 'markdown', 'json', 'yaml',
    'plaintext', 'dotenv',
];

/** The same set as file extensions, for the workspace scan. */
const SCANNED = '**/*.{ts,tsx,js,jsx,mjs,cjs,astro,py,go,rs,java,rb,cs,c,h,cpp,kt,swift,'
    + 'php,sh,html,css,scss,less,md,json,yaml,yml}';

/**
 * A coarse exclude so the search does not walk into a dependency tree at all.
 * What is actually kept is decided by the engine's own list, below — this one is
 * only here to keep `findFiles` from enumerating a hundred thousand files first.
 *
 * The list used to live here in full, and it drifted: the panel reported 853
 * errors out of a VitePress dependency cache that the CLI had been skipping
 * since 1.12.4, because that was two lists and only one of them was updated.
 */
const CHEAP_EXCLUDE = '**/{node_modules,.git,dist,build,out,coverage}/**';
const SCAN_LIMIT = 2000;

/**
 * The workspace's `slopless.config.json`, for whichever folder a file belongs to.
 *
 * The engine falls back to `process.cwd()` when nobody says where the config is,
 * and the extension host's working directory is not the workspace — it is
 * whatever VS Code was launched from. So every call that reads config has to be
 * told, or the panel silently runs the defaults: rules set to `off` kept
 * appearing, and opt-in rules never appeared at all.
 */
function configFor(uri: vscode.Uri): string | undefined {
    const folder = vscode.workspace.getWorkspaceFolder(uri)
        ?? vscode.workspace.workspaceFolders?.[0];
    return folder && path.join(folder.uri.fsPath, 'slopless.config.json');
}

type Node = FileNode | RuleNode | FindingNode;

class FileNode {
    readonly kind = 'file';
    /** Relative to the workspace, which is what `orderFiles` and the tooltip read. */
    readonly path: string;
    constructor(readonly uri: vscode.Uri, readonly findings: Finding[]) {
        this.path = vscode.workspace.asRelativePath(uri, false);
    }
}

class RuleNode {
    readonly kind = 'rule';
    constructor(readonly group: RuleGroup<FileNode>) {}
}

class FindingNode {
    readonly kind = 'finding';
    constructor(
        readonly uri: vscode.Uri,
        readonly finding: Finding,
        /** Unique among all nodes: VS Code requires it of the ids it is given. */
        readonly id: string,
        /** Under a rule the file is part of what identifies it; under a file it is not. */
        readonly under: 'file' | 'rule',
    ) {}
}

class FindingsProvider implements vscode.TreeDataProvider<Node> {
    private files: FileNode[] = [];
    /** How many files the last scan read, so a report can say what it covered. */
    read = 0;
    grouping: Grouping = 'file';
    /** Absolute paths of the files git says changed, or null when the list is not narrowed. */
    changed: Set<string> | null = null;
    private readonly changedEvent = new vscode.EventEmitter<Node | undefined>();
    readonly onDidChangeTreeData = this.changedEvent.event;

    refresh() {
        this.changedEvent.fire(undefined);
    }

    replace(files: FileNode[]) {
        this.files = files;
        this.refresh();
    }

    /** Replaces one file's findings, dropping the file when nothing is left. */
    update(uri: vscode.Uri, findings: Finding[]) {
        const rest = this.files.filter(file => file.uri.fsPath !== uri.fsPath);
        this.replace(findings.length ? [...rest, new FileNode(uri, findings)] : rest);
    }

    /** What is on show: everything, or only what git says changed. */
    visible(): FileNode[] {
        const { changed } = this;
        return changed ? this.files.filter(file => changed.has(file.uri.fsPath)) : this.files;
    }

    scope(): string | undefined {
        return this.changed ? 'Only files changed in git.' : undefined;
    }

    counts(): { errors: number; warnings: number; files: number } {
        const visible = this.visible();
        const { errors, warnings } = countOf(visible.flatMap(file => file.findings));
        return { errors, warnings, files: visible.length };
    }

    all(): FileNode[] {
        return orderFiles(this.visible());
    }

    getChildren(node?: Node): Node[] {
        if (!node) {
            return this.grouping === 'rule'
                ? groupByRule(this.visible()).map(group => new RuleNode(group))
                : this.all();
        }
        if (node.kind === 'file') {
            return node.findings
                .slice()
                .sort((a, b) => a.line - b.line)
                .map((finding, n) => new FindingNode(node.uri, finding, `finding:${node.uri}:${n}`, 'file'));
        }
        if (node.kind === 'rule') {
            return node.group.items.map(({ file, finding }, n) =>
                new FindingNode(file.uri, finding, `rule:${node.group.ruleId}:${n}`, 'rule'));
        }
        return [];
    }

    getTreeItem(node: Node): vscode.TreeItem {
        if (node.kind === 'file') {
            const item = new vscode.TreeItem(
                path.basename(node.uri.fsPath),
                vscode.TreeItemCollapsibleState.Collapsed,
            );
            // An id of its own, from the path, so that a file keeps its open or closed
            // state when a save reorders the list, and two of one name stay two.
            item.id = `file:${node.uri}`;
            item.resourceUri = node.uri;
            item.description = fileDescription(node.path, node.findings);
            item.tooltip = node.path;
            item.iconPath = vscode.ThemeIcon.File;
            return item;
        }

        if (node.kind === 'rule') {
            const { group } = node;
            const item = new vscode.TreeItem(
                `${group.ruleId} ${group.name}`,
                vscode.TreeItemCollapsibleState.Collapsed,
            );
            item.id = `rule:${group.ruleId}`;
            item.contextValue = 'rule';
            item.description = `${plural(group.items.length, 'finding')} in ${
                plural(new Set(group.items.map(({ file }) => file.path)).size, 'file')}`;
            item.iconPath = severityIcon(group.severity);
            item.tooltip = new vscode.MarkdownString(
                `**${group.ruleId} — ${group.name}** (${group.severity})\n\n${group.items[0].finding.message}`,
            );
            return item;
        }

        const { finding } = node;
        const where = vscode.workspace.asRelativePath(node.uri, false);
        const item = new vscode.TreeItem(
            node.under === 'rule' ? locationLabel(where, finding.line) : finding.message,
            vscode.TreeItemCollapsibleState.None,
        );
        item.id = node.id;
        item.contextValue = 'finding';   // what the right-click menu matches on
        item.description = node.under === 'rule' ? shortDir(where) : findingDescription(finding);
        item.tooltip = new vscode.MarkdownString(
            `**${finding.ruleId} — ${finding.name}**\n\n${where}:${finding.line}\n\n${finding.message}`,
        );
        item.iconPath = severityIcon(finding.severity);
        item.command = {
            command: 'slopless.reveal',
            title: 'Open',
            arguments: [node.uri, finding.line],
        };
        return item;
    }
}

function severityIcon(severity: string): vscode.ThemeIcon {
    const error = severity === 'error';
    return new vscode.ThemeIcon(
        error ? 'error' : 'warning',
        new vscode.ThemeColor(error ? 'list.errorForeground' : 'list.warningForeground'),
    );
}

/**
 * The counts go on the activity-bar icon and in the line under the title, not in
 * the title: the view lives in a container that is already called Slopless, and a
 * title of "Slopless — 1 / 119" read "Slopless: Slopless — 1 / 119".
 */
function describe(view: vscode.TreeView<Node>, provider: FindingsProvider) {
    const { errors, warnings, files } = provider.counts();
    view.badge = errors || warnings
        ? { value: errors + warnings, tooltip: countsText(errors, warnings) }
        : undefined;
    view.message = summaryMessage({
        errors, warnings, files, read: provider.read, limit: SCAN_LIMIT, scope: provider.scope(),
    });
}

/** Files git says differ from the last commit, or null where git cannot say. */
async function changedFiles(root: string): Promise<Set<string> | null> {
    const git = (args: string[]) => new Promise<string>((resolve, reject) => {
        execFile('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 },
            (error, stdout) => (error ? reject(error) : resolve(stdout)));
    });
    try {
        const prefix = (await git(['rev-parse', '--show-prefix'])).trim();
        const status = await git(['status', '--porcelain', '-z', '--untracked-files=all']);
        return new Set(parseStatus(status, root, prefix));
    } catch {
        return null;
    }
}

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext) {
    const provider = new FindingsProvider();
    provider.grouping = context.workspaceState.get<Grouping>('slopless.grouping') === 'rule' ? 'rule' : 'file';
    const view = vscode.window.createTreeView('sloplessFindings', {
        treeDataProvider: provider,
        // Two hundred files open after one click each is the state the panel is
        // left in; this closes them all in one.
        showCollapseAll: true,
    });
    context.subscriptions.push(view);
    const setContext = (key: string, value: unknown) =>
        vscode.commands.executeCommand('setContext', key, value);
    void setContext('slopless.grouping', provider.grouping);
    void setContext('slopless.onlyChanged', false);

    const output = vscode.window.createOutputChannel('Slopless');
    context.subscriptions.push(output);

    startLanguageServer(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('slopless.reveal', async (uri: vscode.Uri, line: number) => {
            const document = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(document);
            // Findings are 1-based; the editor is not.
            const at = new vscode.Position(Math.max(0, line - 1), 0);
            editor.selection = new vscode.Selection(at, at);
            editor.revealRange(new vscode.Range(at, at), vscode.TextEditorRevealType.InCenter);
        }),
    );

    const scan = async () => {
        await vscode.window.withProgress(
            { location: { viewId: 'sloplessFindings' }, title: 'Scanning' },
            async () => {
                const folder = vscode.workspace.workspaceFolders?.[0];
                const root = folder?.uri.fsPath;
                const config = root
                    ? path.join(root, 'slopless.config.json')
                    : undefined;
                const candidates = await vscode.workspace.findFiles(
                    SCANNED, CHEAP_EXCLUDE, SCAN_LIMIT,
                );
                // The same decision the CLI makes, made by the same code: the
                // engine's list plus .gitignore and .sloplessignore, and the
                // workspace config's own `ignore` entries, which the panel used
                // to skip because nothing told it where the config was.
                const keep = new Set(
                    root
                        ? applyIgnoreRules(
                            candidates.map(uri => uri.fsPath),
                            loadConfig(config).ignore,
                            root,
                        )
                        : candidates.map(uri => uri.fsPath),
                );
                const files = candidates.filter(uri => keep.has(uri.fsPath));
                const withFindings: FileNode[] = [];
                for (const uri of files) {
                    try {
                        const bytes = await vscode.workspace.fs.readFile(uri);
                        const findings = (await lintText(
                            Buffer.from(bytes).toString('utf8'),
                            uri.fsPath,
                            config,
                        )) as unknown as Finding[];
                        if (findings.length) withFindings.push(new FileNode(uri, findings));
                    } catch (error) {
                        output.appendLine(`${uri.fsPath}: ${(error as Error).message}`);
                    }
                }
                provider.read = files.length;
                provider.replace(withFindings);
                await narrow();
                describe(view, provider);
            },
        );
    };

    context.subscriptions.push(vscode.commands.registerCommand('slopless.scan', scan));

    const group = (grouping: Grouping) => async () => {
        provider.grouping = grouping;
        void context.workspaceState.update('slopless.grouping', grouping);
        await setContext('slopless.grouping', grouping);
        provider.refresh();
    };
    context.subscriptions.push(
        vscode.commands.registerCommand('slopless.groupByRule', group('rule')),
        vscode.commands.registerCommand('slopless.groupByFile', group('file')),
    );

    /**
     * Brings the narrowed list up to date with git, when it is narrowed. Asked again
     * on every scan and every save, because the set of changed files is not fixed:
     * the file just saved may be one that was not in it a moment ago.
     */
    const narrow = async () => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!provider.changed || !root) return;
        provider.changed = await changedFiles(root) ?? provider.changed;
    };
    const onlyChanged = async (on: boolean) => {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const changed = on && root ? await changedFiles(root) : null;
        if (on && !changed) {
            // Saying so, rather than showing everything under a label that claims
            // otherwise.
            vscode.window.showWarningMessage(
                'Slopless cannot tell which files changed: this is not a git repository, '
                + 'or git is not available.',
            );
            return;
        }
        provider.changed = changed;
        await setContext('slopless.onlyChanged', on);
        describe(view, provider);
        provider.refresh();
    };
    context.subscriptions.push(
        vscode.commands.registerCommand('slopless.onlyChanged', () => onlyChanged(true)),
        vscode.commands.registerCommand('slopless.allFiles', () => onlyChanged(false)),
    );

    const version = context.extension.packageJSON.version as string;

    context.subscriptions.push(
        vscode.commands.registerCommand('slopless.copyReport', async () => {
            const { errors, warnings } = provider.counts();
            await vscode.env.clipboard.writeText(report(
                provider.all().map(file => ({ path: file.path, findings: file.findings })),
                provider.read,
                version,
                provider.scope(),
            ));
            vscode.window.showInformationMessage(
                `Copied: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}.`,
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('slopless.copyFinding', async (node: Node) => {
            if (!node || node.kind !== 'finding') return;
            const { finding, uri } = node;
            const document = await vscode.workspace.openTextDocument(uri);
            const lines = Array.from({ length: document.lineCount }, (_, n) => document.lineAt(n).text);
            await vscode.env.clipboard.writeText(findingBlock(
                vscode.workspace.asRelativePath(uri, false), finding, lines,
            ));
            vscode.window.showInformationMessage(`Copied ${finding.ruleId} with its lines.`);
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('slopless.copySuppression', async (node: Node) => {
            if (!node || node.kind !== 'finding') return;
            const { finding, uri } = node;
            const comment = commentSyntax(uri.fsPath);
            if (!comment) {
                // .astro and .md have more than one comment syntax depending on
                // where in the file you are, and guessing wrong writes a line
                // that silences nothing while looking as though it does.
                vscode.window.showWarningMessage(
                    `${path.extname(uri.fsPath)} has more than one comment syntax; `
                    + 'write the marker yourself so it lands in the right one.',
                );
                return;
            }
            // Indented to match the line it will sit above, and the reason left
            // empty on purpose: a suppression without one is the thing this tool
            // exists to complain about.
            const document = await vscode.workspace.openTextDocument(uri);
            const target = document.lineAt(Math.max(0, finding.line - 1)).text;
            await vscode.env.clipboard.writeText(
                suppression(comment, finding.ruleId, target),
            );
            vscode.window.showInformationMessage(
                `Copied the marker for ${finding.ruleId}. It ends in "-- "; say why.`,
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('slopless.openRuleDocs', async (node: Node) => {
            const ruleId = node?.kind === 'finding' ? node.finding.ruleId
                : node?.kind === 'rule' ? node.group.ruleId
                : undefined;
            if (!ruleId) return;
            await vscode.env.openExternal(vscode.Uri.parse(
                `https://fabriziosalmi.github.io/slopless/rules/${ruleId}`,
            ));
        }),
    );

    // Saving one file used to rescan the whole workspace — up to the limit, on
    // every save. Only the saved file can have changed, so only the saved file
    // is read again and its entry in the tree replaced.
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async document => {
            if (!vscode.workspace.getWorkspaceFolder(document.uri)) return;
            try {
                const findings = (await lintText(
                    document.getText(),
                    document.uri.fsPath,
                    configFor(document.uri),
                )) as unknown as Finding[];
                provider.update(document.uri, findings);
                await narrow();
                describe(view, provider);
            } catch (error) {
                output.appendLine(`${document.uri.fsPath}: ${(error as Error).message}`);
            }
        }),
    );

    void scan();
}

function startLanguageServer(context: vscode.ExtensionContext) {
    const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
            options: { execArgv: ['--nolazy', '--inspect=6009'] },
        },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: LANGUAGES.map(language => ({ scheme: 'file', language })),
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/slopless.config.json'),
        },
    };

    client = new LanguageClient(
        'sloplessServer',
        'Slopless Language Server',
        serverOptions,
        clientOptions,
    );
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
