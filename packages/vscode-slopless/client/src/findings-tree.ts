/**
 * The panel's tree: what it lists, how each row reads, and what git says changed.
 * Apart from the extension's activation because that is where the commands and
 * the scan live, and this is what they act on.
 */
import { execFile } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

import {
    countOf, countsText, fileDescription, findingDescription, groupByRule, locationLabel, orderFiles,
    parseStatus, shortDir, summaryMessage, type Grouping, type RuleGroup, type Summary,
} from './panel';
import { plural, type Finding } from './report';

/** The most files a scan will look for, in a workspace that has more. */
export const SCAN_LIMIT = 2000;

export type Node = FileNode | RuleNode | FindingNode;

export class FileNode {
    readonly kind = 'file';
    /** Relative to the workspace, which is what `orderFiles` and the tooltip read. */
    readonly path: string;
    constructor(readonly uri: vscode.Uri, readonly findings: Finding[]) {
        this.path = vscode.workspace.asRelativePath(uri, false);
    }
}

export class RuleNode {
    readonly kind = 'rule';
    constructor(readonly group: RuleGroup<FileNode>) {}
}

export class FindingNode {
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

export class FindingsProvider implements vscode.TreeDataProvider<Node> {
    private files: FileNode[] = [];
    /** How many files the last scan read, so a report can say what it covered. */
    read = 0;
    /** Files it tried to read and could not, which are not among those it read. */
    unreadable = 0;
    /** Whether the search stopped at the limit, leaving files it never listed. */
    truncated = false;
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

    summary(): Summary {
        const { errors, warnings, files } = this.counts();
        return {
            errors, warnings, files, read: this.read, limit: SCAN_LIMIT,
            truncated: this.truncated, unreadable: this.unreadable, scope: this.scope(),
        };
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
export function describe(view: vscode.TreeView<Node>, provider: FindingsProvider) {
    const { errors, warnings, files } = provider.counts();
    view.badge = errors || warnings
        ? { value: errors + warnings, tooltip: countsText(errors, warnings) }
        : undefined;
    view.message = summaryMessage(provider.summary());
}

/** Files git says differ from the last commit, or null where git cannot say. */
export async function changedFiles(root: string): Promise<Set<string> | null> {
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
