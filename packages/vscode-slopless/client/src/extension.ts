import * as path from 'path';
import * as vscode from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

import { lintText, applyIgnoreRules, loadConfig, resolveRules } from 'slopless/dist/engine/api';

import {
    commentSyntax, findingBlock, plural, report, suppression, type Finding,
} from './report';
import { caveats, type Grouping } from './panel';
import {
    changedFiles, describe, FileNode, FindingsProvider, SCAN_LIMIT, type Node,
} from './findings-tree';

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

let client: LanguageClient | undefined;

/**
 * Which scan is the current one. Starting a scan, or deactivating, moves it on,
 * and a scan that finds it is no longer the current one stops and says nothing:
 * pressing refresh while one was running used to start a second, and whichever
 * finished last wrote its answer over the other's.
 */
let scanGeneration = 0;

/** What was saved while a scan was reading, to be laid over what the scan read. */
interface ScanRun {
    saved: Map<string, { uri: vscode.Uri; findings: Finding[] }>;
}
let running: ScanRun | undefined;

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
        const mine = ++scanGeneration;
        const run: ScanRun = { saved: new Map() };
        running = run;
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
                const withFindings = new Map<string, FileNode>();
                let read = 0;
                let unreadable = 0;
                for (const uri of files) {
                    // Between files, where stopping costs nothing.
                    if (mine !== scanGeneration) return;
                    try {
                        const bytes = await vscode.workspace.fs.readFile(uri);
                        const findings = (await lintText(
                            Buffer.from(bytes).toString('utf8'),
                            uri.fsPath,
                            config,
                        )) as unknown as Finding[];
                        read++;
                        if (findings.length) withFindings.set(uri.fsPath, new FileNode(uri, findings));
                    } catch (error) {
                        unreadable++;
                        output.appendLine(`${uri.fsPath}: ${(error as Error).message}`);
                    }
                }
                if (mine !== scanGeneration) return;

                // A file saved while this scan was reading was linted from the
                // editor's own text, which is newer than anything the scan read
                // before the save; without this its entry reverted to the old one.
                for (const { uri, findings } of run.saved.values()) {
                    if (findings.length) withFindings.set(uri.fsPath, new FileNode(uri, findings));
                    else withFindings.delete(uri.fsPath);
                }
                running = undefined;

                // What was read, not what was tried: a file that could not be
                // opened was not checked, and counting it as read said it was.
                provider.read = read;
                provider.unreadable = unreadable;
                // The search hit its limit, whatever the ignore rules then took out
                // of what it listed: files past the limit were never listed at all.
                provider.truncated = candidates.length >= SCAN_LIMIT;
                provider.replace([...withFindings.values()]);
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
                caveats(provider.summary()),
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
            // By the rule's own tag rather than a list of ids here, so a rule of the
            // project's own that reports secrets is held to the same.
            const reportsSecrets = resolveRules(configFor(uri))
                .some(rule => rule.id === finding.ruleId && rule.tags?.includes('secrets'));
            const lines = Array.from({ length: document.lineCount }, (_, n) => document.lineAt(n).text);
            await vscode.env.clipboard.writeText(findingBlock(
                vscode.workspace.asRelativePath(uri, false), finding, lines, 3, reportsSecrets,
            ));
            vscode.window.showInformationMessage(reportsSecrets
                ? `Copied ${finding.ruleId}, without its lines: it reports a secret.`
                : `Copied ${finding.ruleId} with its lines.`);
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
                running?.saved.set(document.uri.fsPath, { uri: document.uri, findings });
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
    // A scan still reading when the extension goes stops at its next file rather
    // than carrying on, and writing into a panel that is being torn down.
    scanGeneration++;
    running = undefined;
    return client?.stop();
}
