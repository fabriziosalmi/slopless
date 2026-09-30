import * as path from 'path';
import { defineConfig } from 'vitest/config';

const here = (...parts: string[]) => path.join(__dirname, ...parts);

export default defineConfig({
    // The VS Code extension is tested in place, against stand-ins for the editor.
    // `vscode` does not exist outside one, and the engine is imported from its
    // source: in CI the tests run before the build, so there is no `dist/engine`.
    resolve: {
        alias: [
            { find: /^vscode$/, replacement: here('src/__tests__/fakes/vscode.ts') },
            { find: /^vscode-languageclient\/node$/, replacement: here('src/__tests__/fakes/language-client.ts') },
            { find: /^slopless\/dist\/engine\/api$/, replacement: here('src/engine/api.ts') },
        ],
    },
    test: {
        globals: true,
        environment: 'node',
        include: ['src/__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/__tests__/**'],
        },
    },
});
