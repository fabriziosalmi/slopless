#!/usr/bin/env node
/**
 * The packages carry a version each, and they are the same version: the
 * extension and the MCP server are built from this engine, out of this commit.
 * Keeping them by hand meant they drifted the moment anything shipped — both
 * said 1.14.0 while the root had moved on twice.
 *
 * Run by `npm version`, so the bump reaches them. With `--check` it says whether
 * they agree instead of writing, which is what CI asks.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

const packages = ['packages/vscode-slopless/package.json', 'packages/mcp-slopless/package.json'];
const checking = process.argv.includes('--check');
const wrong = [];

for (const relative of packages) {
    const file = path.join(root, relative);
    const text = fs.readFileSync(file, 'utf8');
    const manifest = JSON.parse(text);
    if (manifest.version === version) continue;

    if (checking) {
        wrong.push(`${relative} says ${manifest.version}, the root says ${version}`);
        continue;
    }
    // Rewritten as text so the file keeps its own key order and formatting
    // rather than being reshaped by a round trip through JSON.parse.
    fs.writeFileSync(
        file,
        text.replace(/^(\s*"version":\s*")[^"]+(")/m, `$1${version}$2`),
        'utf8',
    );
    console.log(`${relative}: ${manifest.version} -> ${version}`);
}

if (wrong.length) {
    console.error('Versions have drifted apart:');
    for (const line of wrong) console.error(`  ${line}`);
    console.error('Run: node scripts/sync-versions.js');
    process.exit(1);
}
if (checking) console.log(`every package says ${version}`);
