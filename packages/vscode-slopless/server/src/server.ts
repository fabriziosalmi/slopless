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

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

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
        const violations = await lintText(text, fsPath);
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
