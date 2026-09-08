import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    DidChangeConfigurationParams,
    TextDocumentSyncKind,
    InitializeResult,
    TextDocumentChangeEvent
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { lintText } from 'slopless/dist/engine/api';
import { URI } from 'vscode-uri';
import { join, sep } from 'path';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

/**
 * The workspace roots, kept from initialize so diagnostics can name the config.
 *
 * The engine looks for `slopless.config.json` next to `process.cwd()` when it is
 * not told otherwise, and this server's working directory is the extension
 * host's, not the workspace. Squiggles were therefore produced from the default
 * rule set no matter what the project had configured.
 */
let workspaceRoots: string[] = [];

function configFor(fsPath: string): string | undefined {
    const root = workspaceRoots.find(candidate => fsPath.startsWith(candidate + sep))
        ?? workspaceRoots[0];
    return root && join(root, 'slopless.config.json');
}

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    workspaceRoots = (params.workspaceFolders ?? [])
        .map(folder => URI.parse(folder.uri).fsPath);
    if (workspaceRoots.length === 0 && params.rootUri) {
        workspaceRoots = [URI.parse(params.rootUri).fsPath];
    }

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
        }
    };
    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
});

interface SloplessSettings {
    enable: boolean;
}

const defaultSettings: SloplessSettings = { enable: true };
let globalSettings: SloplessSettings = defaultSettings;

let documentSettings: Map<string, Promise<SloplessSettings>> = new Map();

connection.onDidChangeConfiguration((change: DidChangeConfigurationParams) => {
    if (hasConfigurationCapability) {
        documentSettings.clear();
    } else {
        globalSettings = <SloplessSettings>(
            (change.settings.slopless || defaultSettings)
        );
    }
    documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<SloplessSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'slopless'
        });
        documentSettings.set(resource, result);
    }
    return result;
}

documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri);

    if (!settings.enable) {
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
        return;
    }

    const text = textDocument.getText();
    const uri = URI.parse(textDocument.uri);
    const fsPath = uri.fsPath;

    try {
        const violations = await lintText(text, fsPath, configFor(fsPath));
        const diagnostics: Diagnostic[] = violations.map((v: any) => {
            const severity = v.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning;

            // Adjust line from 1-indexed to 0-indexed for VS Code
            const line = v.line > 0 ? v.line - 1 : 0;

            return {
                severity,
                range: {
                    start: { line: line, character: 0 },
                    end: { line: line, character: 1000 } // Give a generic range for now
                },
                message: v.message,
                source: 'slopless',
                code: v.ruleId
            };
        });

        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
    } catch (e: any) {
        connection.console.error(`Slopless linting error: ${e.message}`);
    }
}

documents.listen(connection);
connection.listen();
