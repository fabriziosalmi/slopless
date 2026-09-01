#!/usr/bin/env node
//
// Prints the CHANGELOG section for one version, for use as release notes.
//
//   node scripts/changelog-notes.js 1.4.3
//
// Exists so the release workflow does not have to extract it with nested
// heredocs, and so the extraction can be tested rather than discovered broken
// during a release.
const fs = require('fs');
const path = require('path');

const version = (process.argv[2] || '').replace(/^v/, '');
if (!version) {
    console.error('usage: changelog-notes.js <version>');
    process.exit(1);
}

const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const heading = new RegExp(`^# ${version.replace(/\./g, '\\.')} - .*$`, 'm');
const match = heading.exec(changelog);

if (!match) {
    // A release with no entry still deserves notes rather than a failed job.
    console.log(`Release ${version}.`);
    process.exit(0);
}

const after = changelog.slice(match.index + match[0].length);
const next = after.search(/^# \d+\.\d+\.\d+ - /m);
console.log((next === -1 ? after : after.slice(0, next)).trim());
