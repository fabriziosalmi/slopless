// The GitHub Action runs dist/index.js with no npm install, so the bundle must
// resolve every runtime dependency on its own. Running it from a directory with
// no node_modules on the resolution path is the only way to prove that.
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const bundle = path.resolve(__dirname, '..', 'dist', 'index.js');
if (!fs.existsSync(bundle)) {
    console.error('dist/index.js is missing — run npm run build first.');
    process.exit(1);
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-bundle-'));
fs.writeFileSync(path.join(sandbox, 'sample.ts'), 'var x = 1;\n');

const result = cp.spawnSync(process.execPath, [bundle, 'sample.ts', '--no-cache'], {
    cwd: sandbox,
    encoding: 'utf8',
});
fs.rmSync(sandbox, { recursive: true, force: true });

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
if (/Cannot find module/.test(output)) {
    console.error('The bundle depends on a module it did not bundle:\n' + output);
    console.error('Add it to noExternal in tsup.config.ts.');
    process.exit(1);
}
if (!output.includes('VBC-005')) {
    console.error('The bundle ran but did not report the expected violation:\n' + output);
    process.exit(1);
}
console.log('dist/index.js runs standalone, with no node_modules ✓');
