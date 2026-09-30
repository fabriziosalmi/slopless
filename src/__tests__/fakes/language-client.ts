// Stands in for `vscode-languageclient/node`, which reaches for the real editor
// the moment it is imported. The panel tests never start a server.
export class LanguageClient {
    constructor(..._args: unknown[]) {}
    start() { return Promise.resolve(); }
    stop() { return Promise.resolve(); }
}
export const TransportKind = { ipc: 1 };
export type LanguageClientOptions = unknown;
export type ServerOptions = unknown;
