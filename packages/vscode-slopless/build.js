// The extension is bundled rather than shipped with node_modules, because the
// dependency on the engine is a `file:` link and a .vsix cannot carry one.
//
// The engine looks for its rules at `__dirname/../../rules`. Bundled into
// `client/out/extension.js` that resolves to the extension root, so the rules
// are copied there and the path the engine already uses keeps working.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');

async function main() {
    for (const [entry, outfile] of [
        ['client/src/extension.ts', 'client/out/extension.js'],
        ['server/src/server.ts', 'server/out/server.js'],
    ]) {
        await esbuild.build({
            entryPoints: [path.join(__dirname, entry)],
            outfile: path.join(__dirname, outfile),
            bundle: true,
            platform: 'node',
            target: 'node18',
            format: 'cjs',
            sourcemap: true,
            // Provided by the editor, never by us.
            external: ['vscode'],
            logLevel: 'warning',
        });
    }

    const rules = path.join(__dirname, 'rules');
    fs.rmSync(rules, { recursive: true, force: true });
    fs.mkdirSync(rules, { recursive: true });
    let copied = 0;
    for (const file of fs.readdirSync(path.join(root, 'rules'))) {
        fs.copyFileSync(path.join(root, 'rules', file), path.join(rules, file));
        copied++;
    }
    console.log(`bundled, and copied ${copied} rules`);
}

main().catch(error => { console.error(error); process.exit(1); });
