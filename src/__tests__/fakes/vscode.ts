// Just enough of the editor API for the extension to activate and draw its tree
// in a test. It records what the extension asked for, in `host`, and does what a
// real editor does where that matters to the tree: a file search, a file read, a
// refusal of two items with one id.
import * as fs from 'fs';
import * as path from 'path';

/** What the tests read of a tree node, an item the editor would draw, and the view. */
export interface Row {
    kind: string;
    path: string;
    findings: unknown[];
    group: { ruleId: string };
    finding: { ruleId: string };
}
export interface Item { label: string; id?: string; description?: string; contextValue?: string }
export interface Provider {
    grouping: string;
    changed: Set<string> | null;
    getChildren(node?: Row): Row[];
    getTreeItem(node: Row): Item;
}
export interface View {
    options: { showCollapseAll?: boolean };
    badge?: { value: number; tooltip: string };
    message?: string;
}
type Command = (...args: unknown[]) => unknown;

/** A read that waits, so a test can change the world while a scan is part-way. */
export interface Gate {
    file: string;
    /** Settles when a read has reached the gate and is waiting at it. */
    arrived: Promise<void>;
    done: boolean;
    released: Promise<void>;
    release(): void;
}

export const host = {
    root: '',
    commands: new Map<string, Command>(),
    contexts: {} as Record<string, unknown>,
    saveHandlers: [] as Array<(document: unknown) => unknown>,
    messages: [] as string[],
    log: [] as string[],
    clipboard: '',
    opened: [] as string[],
    view: undefined as unknown as View,
    provider: undefined as unknown as Provider,
    state: {} as Record<string, unknown>,
    /** Work the extension started and did not hand back, such as the scan on activation. */
    pending: [] as Array<Promise<unknown>>,
    /** Files the search lists that are not on disk, so reading them fails. */
    phantoms: 0,
    /** Every file the extension asked to read, in order. */
    reads: [] as string[],
    gate: undefined as Gate | undefined,
    reset(root: string) {
        this.root = root;
        this.commands.clear();
        this.contexts = {};
        this.saveHandlers = [];
        this.messages = [];
        this.log = [];
        this.clipboard = '';
        this.opened = [];
        this.view = undefined as unknown as View;
        this.provider = undefined as unknown as Provider;
        this.state = {};
        this.pending = [];
        this.phantoms = 0;
        this.reads = [];
        this.gate = undefined;
    },
    /** The next read of a file ending in `file` does not finish until `release()`. */
    holdRead(file: string): Gate {
        let release!: () => void;
        let arrive!: () => void;
        const released = new Promise<void>(resolve => { release = resolve; });
        const arrived = new Promise<void>(resolve => { arrive = resolve; });
        this.gate = Object.assign({ file, arrived, done: false, released, release }, { arrive });
        return this.gate;
    },
};

export class Uri {
    private constructor(readonly fsPath: string) {}
    static file(p: string) { return new Uri(p); }
    static parse(value: string) { return new Uri(value); }
    toString() { return `file://${this.fsPath}`; }
}

export class EventEmitter<T> {
    private listeners: Array<(event: T) => void> = [];
    event = (listener: (event: T) => void) => {
        this.listeners.push(listener);
        return { dispose() {} };
    };
    fire(event: T) { this.listeners.forEach(listener => listener(event)); }
}

export enum TreeItemCollapsibleState { None = 0, Collapsed = 1, Expanded = 2 }

export class TreeItem {
    id?: string;
    resourceUri?: Uri;
    description?: string;
    tooltip?: unknown;
    iconPath?: unknown;
    contextValue?: string;
    command?: unknown;
    constructor(public label: string, public collapsibleState?: TreeItemCollapsibleState) {}
}

export class ThemeIcon {
    static File = new ThemeIcon('file');
    constructor(public id: string, public color?: ThemeColor) {}
}
export class ThemeColor { constructor(public id: string) {} }
export class MarkdownString { constructor(public value: string) {} }
export class Position { constructor(public line: number, public character: number) {} }
export class Range { constructor(public start: Position, public end: Position) {} }
export class Selection { constructor(public anchor: Position, public active: Position) {} }
export const TextEditorRevealType = { InCenter: 2 };

// The extensions the extension's own file search asks for, cut down to the ones
// the tests write.
const SCANNED = /\.(ts|tsx|js|jsx|md|json|py|go|rs|sh|css|html|ya?ml)$/;

function walk(dir: string, found: string[] = []): string[] {
    // Sorted, because the order a directory lists in is the file system's to choose
    // and a test that holds one read needs to know which ones came before it.
    const entries = fs.readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, found);
        else if (SCANNED.test(entry.name)) found.push(full);
    }
    return found;
}

export const window = {
    createTreeView(_id: string, options: { treeDataProvider: Provider; showCollapseAll?: boolean }) {
        host.provider = options.treeDataProvider;
        host.view = Object.assign({ options, dispose() {} }, { badge: undefined, message: undefined });
        return host.view;
    },
    createOutputChannel: () => ({ appendLine: (line: string) => host.log.push(line), dispose() {} }),
    withProgress: (_options: unknown, task: () => Promise<unknown>) => {
        const running = task();
        host.pending.push(running);
        return running;
    },
    showInformationMessage: (message: string) => Promise.resolve(host.messages.push(message)),
    showWarningMessage: (message: string) => Promise.resolve(host.messages.push(message)),
    showTextDocument: () => Promise.resolve({}),
};

export const workspace = {
    get workspaceFolders() { return [{ uri: Uri.file(host.root) }]; },
    getWorkspaceFolder: (uri: Uri) =>
        uri.fsPath.startsWith(host.root + path.sep) ? { uri: Uri.file(host.root) } : undefined,
    asRelativePath: (uri: Uri) => path.relative(host.root, uri.fsPath).split(path.sep).join('/'),
    findFiles: (_include: string, _exclude: string, limit: number) => {
        const phantoms = Array.from({ length: host.phantoms }, (_, n) => path.join(host.root, `phantom-${n}.ts`));
        return Promise.resolve([...walk(host.root), ...phantoms].slice(0, limit).map(file => Uri.file(file)));
    },
    fs: {
        readFile: async (uri: Uri) => {
            host.reads.push(uri.fsPath);
            const { gate } = host;
            if (gate && !gate.done && uri.fsPath.endsWith(gate.file)) {
                gate.done = true;
                (gate as Gate & { arrive(): void }).arrive();
                await gate.released;
            }
            return fs.readFileSync(uri.fsPath);
        },
    },
    onDidSaveTextDocument: (handler: (document: unknown) => unknown) => {
        host.saveHandlers.push(handler);
        return { dispose() {} };
    },
    createFileSystemWatcher: () => ({ dispose() {} }),
    openTextDocument: (uri: Uri) => {
        const lines = fs.readFileSync(uri.fsPath, 'utf8').split('\n');
        return Promise.resolve({ lineCount: lines.length, lineAt: (n: number) => ({ text: lines[n] }) });
    },
};

export const commands = {
    registerCommand(id: string, handler: Command) {
        host.commands.set(id, handler);
        return { dispose() {} };
    },
    executeCommand(id: string, ...args: unknown[]) {
        if (id === 'setContext') {
            host.contexts[String(args[0])] = args[1];
            return Promise.resolve();
        }
        return Promise.resolve(host.commands.get(id)?.(...args));
    },
};

export const env = {
    clipboard: {
        writeText: (text: string) => {
            host.clipboard = text;
            return Promise.resolve();
        },
    },
    openExternal: (uri: Uri) => {
        host.opened.push(uri.fsPath);
        return Promise.resolve(true);
    },
};
