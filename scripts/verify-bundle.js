// Two claims this project makes, both of which are easy to break by accident:
//
//   1. The GitHub Action runs dist/index.js with no npm install.
//   2. Installing the package pulls no dependencies at all.
//
// Both hold only while every runtime dependency is bundled. Running the bundle
// from a directory with no node_modules on the resolution path is the only way
// to prove the first; reading package.json is enough for the second.
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');
const failures = [];

function checkNoDeclaredDependencies() {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const declared = Object.keys(pkg.dependencies ?? {});
    if (declared.length > 0) {
        failures.push(
            `package.json declares runtime dependencies: ${declared.join(', ')}.\n`
            + '  The bundle inlines everything, so these are install surface with no benefit.\n'
            + '  Move them to devDependencies, or delete this check if the design changed.');
    }
}

function checkRunsStandalone() {
    const bundle = path.join(root, 'dist', 'index.js');
    if (!fs.existsSync(bundle)) {
        failures.push('dist/index.js is missing — run npm run build first.');
        return;
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
        failures.push('The CLI bundle needs a module it did not bundle:\n' + output);
    } else if (!output.includes('VBC-005')) {
        failures.push('The CLI bundle ran but did not report the expected violation:\n' + output);
    }
}

function checkApiLoadsStandalone() {
    // The VS Code extension imports this entry point, so it has to stand alone too.
    const api = path.join(root, 'dist', 'engine', 'api.js');
    if (!fs.existsSync(api)) {
        failures.push('dist/engine/api.js is missing — run npm run build first.');
        return;
    }
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-api-'));
    const probe = path.join(sandbox, 'probe.js');
    fs.writeFileSync(probe, `
        const api = require(${JSON.stringify(api)});
        api.lintText('var x = 1;\\n', 'sample.ts')
           .then(v => { console.log(v.map(x => x.ruleId).join(',')); })
           .catch(e => { console.error(String(e)); process.exit(1); });
    `);
    const result = cp.spawnSync(process.execPath, [probe], { cwd: sandbox, encoding: 'utf8' });
    fs.rmSync(sandbox, { recursive: true, force: true });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (/Cannot find module/.test(output)) {
        failures.push('The API bundle needs a module it did not bundle:\n' + output);
    } else if (!output.includes('VBC-005')) {
        failures.push('The API bundle ran but did not report the expected violation:\n' + output);
    }
}

/**
 * Node writes to a pipe asynchronously, so calling process.exit() after printing
 * cuts the output off at the buffer. That truncated JSON and SARIF at 64KB, which
 * only showed up on a project big enough to fill it: the report parsed fine
 * everywhere small and was unusable everywhere large.
 */
function checkLargeOutputIsNotTruncated() {
    const bundle = path.join(root, 'dist', 'index.js');
    if (!fs.existsSync(bundle)) return;

    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-output-'));
    // Enough violations to push the report well past the pipe buffer.
    const line = 'el.innerHTML = untrusted; var x = 1; eval(payload);\n';
    for (let i = 0; i < 40; i++) {
        fs.writeFileSync(path.join(sandbox, `noisy${i}.ts`), line.repeat(60));
    }

    const result = cp.spawnSync(process.execPath, [bundle, '*.ts', '--no-cache', '--format', 'json'], {
        cwd: sandbox,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    fs.rmSync(sandbox, { recursive: true, force: true });

    const output = result.stdout ?? '';
    if (output.length <= 65536) {
        failures.push(`The output fixture only produced ${output.length} bytes, `
            + 'which is under the pipe buffer and proves nothing. Make it noisier.');
        return;
    }
    try {
        const parsed = JSON.parse(output);
        if (!Array.isArray(parsed)) failures.push('JSON output is not an array.');
    } catch {
        failures.push(`JSON output is truncated at ${output.length} bytes and does not parse.\n`
            + '  Something is calling process.exit() before stdout drains. Set process.exitCode instead.');
    }
    if (result.status !== 1) {
        failures.push(`Expected exit code 1 with errors present, got ${result.status}.`);
    }
}

checkNoDeclaredDependencies();
checkRunsStandalone();
checkApiLoadsStandalone();
checkLargeOutputIsNotTruncated();

if (failures.length > 0) {
    for (const failure of failures) console.error('✗ ' + failure);
    process.exit(1);
}
console.log('dist runs standalone, declares no dependencies, and does not truncate a large report ✓');
