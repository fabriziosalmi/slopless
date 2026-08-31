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

checkNoDeclaredDependencies();
checkRunsStandalone();
checkApiLoadsStandalone();

if (failures.length > 0) {
    for (const failure of failures) console.error('✗ ' + failure);
    process.exit(1);
}
console.log('dist runs standalone with no node_modules, and the package declares no dependencies ✓');
