#!/usr/bin/env node
// Run from the `version` script, after npm has written the new number and before
// it commits. The changelog is edited by hand and the docs are generated from
// it, so writing the entry after the bump leaves the published pages describing
// the previous release. That has now happened twice, each time caught in CI
// rather than here.
const fs = require('fs');
const path = require('path');

const version = require(path.join(__dirname, '..', 'package.json')).version;
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const heading = changelog.split('\n').find(line => line.startsWith('# '));

if (!heading || !heading.startsWith(`# ${version} `)) {
    console.error(`CHANGELOG.md does not open with an entry for ${version}.`);
    console.error(`Its first heading is: ${heading ?? '(none)'}`);
    console.error('Write the entry first, then bump: the docs are generated from it.');
    process.exit(1);
}
