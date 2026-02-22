"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_1 = require("vscode-languageserver/node");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const api_1 = require("slopless/dist/engine/api");
const vscode_uri_1 = require("vscode-uri");
const connection = (0, node_1.createConnection)(node_1.ProposedFeatures.all);
const documents = new node_1.TextDocuments(vscode_languageserver_textdocument_1.TextDocument);
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
connection.onInitialize((params) => {
    const capabilities = params.capabilities;
    hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
    hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);
    const result = {
        capabilities: {
            textDocumentSync: node_1.TextDocumentSyncKind.Incremental,
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
        connection.client.register(node_1.DidChangeConfigurationNotification.type, undefined);
    }
});
const defaultSettings = { enable: true };
let globalSettings = defaultSettings;
let documentSettings = new Map();
connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
        documentSettings.clear();
    }
    else {
        globalSettings = ((change.settings.slopless || defaultSettings));
    }
    documents.all().forEach(validateTextDocument);
});
function getDocumentSettings(resource) {
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
async function validateTextDocument(textDocument) {
    const settings = await getDocumentSettings(textDocument.uri);
    if (!settings.enable) {
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
        return;
    }
    const text = textDocument.getText();
    const uri = vscode_uri_1.URI.parse(textDocument.uri);
    const fsPath = uri.fsPath;
    try {
        const violations = await (0, api_1.lintText)(text, fsPath);
        const diagnostics = violations.map((v) => {
            const severity = v.severity === 'error' ? node_1.DiagnosticSeverity.Error : node_1.DiagnosticSeverity.Warning;
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
    }
    catch (e) {
        connection.console.error(`Slopless linting error: ${e.message}`);
    }
}
documents.listen(connection);
connection.listen();
//# sourceMappingURL=server.js.map