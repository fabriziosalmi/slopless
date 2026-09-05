import * as path from 'path';
import * as vscode from 'vscode';

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from 'vscode-languageclient/node';

import { lintText, applyIgnoreRules } from 'slopless/dist/engine/api';

import {
    commentSyntax, findingBlock, plural, report, suppression, type Finding,
} from './report';

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

type Node = FileNode | FindingNode;

class FileNode {
    readonly kind = 'file';
    constructor(readonly uri: vscode.Uri, readonly findings: Finding[]) {}
}

class FindingNode {
    readonly kind = 'finding';
    constructor(readonly uri: vscode.Uri, readonly finding: Finding) {}
}

class FindingsProvider implements vscode.TreeDataProvider<Node> {
    private files: FileNode[] = [];
    /** How many files the last scan read, so a report can say what it covered. */
    read = 0;
    private readonly changed = new vscode.EventEmitter<Node | undefined>();
    readonly onDidChangeTreeData = this.changed.event;

    /** Errors first, then by how much is wrong, so the top of the list is the top of the list. */
    replace(files: FileNode[]) {
        this.files = files.sort((a, b) => {
            const errors = (f: FileNode) => f.findings.filter(v => v.severity === 'error').length;
            return errors(b) - errors(a)
                || b.findings.length - a.findings.length
                || a.uri.fsPath.localeCompare(b.uri.fsPath);
        });
        this.changed.fire(undefined);
    }

    /** Replaces one file's findings, dropping the file when nothing is left. */
    update(uri: vscode.Uri, findings: Finding[]) {
        const rest = this.files.filter(file => file.uri.fsPath !== uri.fsPath);
        this.replace(findings.length ? [...rest, new FileNode(uri, findings)] : rest);
    }

    counts(): { errors: number; warnings: number; files: number } {
        const all = this.files.flatMap(f => f.findings);
        return {
            errors: all.filter(v => v.severity === 'error').length,
            warnings: all.filter(v => v.severity !== 'error').length,
            files: this.files.length,
        };
    }

    all(): FileNode[] {
        return this.files;
    }

    getChildren(node?: Node): Node[] {
        if (!node) return this.files;
        if (node.kind === 'file') {
            return node.findings
                .slice()
                .sort((a, b) => a.line - b.line)
                .map(finding => new FindingNode(node.uri, finding));
        }
        return [];
    }

    getTreeItem(node: Node): vscode.TreeItem {
        if (node.kind === 'file') {
            const errors = node.findings.filter(v => v.severity === 'error').length;
            const warnings = node.findings.length - errors;
            const item = new vscode.TreeItem(
                path.basename(node.uri.fsPath),
                vscode.TreeItemCollapsibleState.Collapsed,
            );
            item.resourceUri = node.uri;
            // The directory, not just the counts: two CHANGELOG.md and two
            // VBC-001.yaml looked like the same file listed twice.
            const where = vscode.workspace.asRelativePath(node.uri, false);
            const counted = errors
                ? `${plural(errors, 'error')}, ${plural(warnings, 'warning')}`
                : plural(warnings, 'warning');
            item.description = `${counted} · ${path.dirname(where)}`;
            item.tooltip = where;
            item.iconPath = vscode.ThemeIcon.File;
            return item;
        }

        const { finding } = node;
        const item = new vscode.TreeItem(finding.message, vscode.TreeItemCollapsibleState.None);
        item.contextValue = 'finding';   // what the right-click menu matches on
        item.description = `${finding.ruleId} · ${finding.name} · line ${finding.line}`;
        item.tooltip = new vscode.MarkdownString(
            `**${finding.ruleId} — ${finding.name}**\n\n${finding.message}`,
        );
        item.iconPath = new vscode.ThemeIcon(
            finding.severity === 'error' ? 'error' : 'warning',
            new vscode.ThemeColor(
                finding.severity === 'error' ? 'list.errorForeground' : 'list.warningForeground',
            ),
        );
        item.command = {
            command: 'slopless.reveal',
            title: 'Open',
            arguments: [node.uri, finding.line],
        };
        return item;
    }
}

/** The one-line summary under the panel's title. */
function describe(view: vscode.TreeView<Node>, provider: FindingsProvider, read?: number) {
    const { errors, warnings, files } = provider.counts();
    view.title = errors || warnings ? `Slopless — ${errors} / ${warnings}` : 'Slopless';

    if (read !== undefined && read >= SCAN_LIMIT) {
        view.message = `Stopped at ${SCAN_LIMIT} files. What is below is complete; `
            + 'what is beyond it was not read.';
        return;
    }
    if (!errors && !warnings) {
        view.message = read === undefined
            ? 'Nothing found.'
            : `Nothing found in ${plural(read, 'file')}.`;
        return;
    }
    const where = read === undefined
        ? `${plural(files, 'file')}`
        : `${plural(files, 'file')}, out of ${read} read`;
    view.message = `${plural(errors, 'error')} and ${plural(warnings, 'warning')} in ${where}.`;
}

let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext) {
    const provider = new FindingsProvider();
    const view = vscode.window.createTreeView('sloplessFindings', { treeDataProvider: provider });
    context.subscriptions.push(view);

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
                const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                const candidates = await vscode.workspace.findFiles(
                    SCANNED, CHEAP_EXCLUDE, SCAN_LIMIT,
                );
                // The same decision the CLI makes, made by the same code: the
                // engine's list plus .gitignore and .sloplessignore.
                const keep = new Set(
                    root
                        ? applyIgnoreRules(candidates.map(uri => uri.fsPath), undefined, root)
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
                        )) as unknown as Finding[];
                        if (findings.length) withFindings.push(new FileNode(uri, findings));
                    } catch (error) {
                        output.appendLine(`${uri.fsPath}: ${(error as Error).message}`);
                    }
                }
                provider.read = files.length;
                provider.replace(withFindings);
                describe(view, provider, files.length);
            },
        );
    };

    context.subscriptions.push(vscode.commands.registerCommand('slopless.scan', scan));

    const version = context.extension.packageJSON.version as string;

    context.subscriptions.push(
        vscode.commands.registerCommand('slopless.copyReport', async () => {
            const { errors, warnings } = provider.counts();
            await vscode.env.clipboard.writeText(report(
                provider.all().map(file => ({
                    path: vscode.workspace.asRelativePath(file.uri, false),
                    findings: file.findings,
                })),
                provider.read,
                version,
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
            if (!node || node.kind !== 'finding') return;
            await vscode.env.openExternal(vscode.Uri.parse(
                `https://fabriziosalmi.github.io/slopless/rules/${node.finding.ruleId}`,
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
                )) as unknown as Finding[];
                provider.update(document.uri, findings);
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
