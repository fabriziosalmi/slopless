#!/usr/bin/env node
/**
 * Measures what a change to a rule does to real code.
 *
 *   node scripts/corpus.js run    NAMES OUT [--root DIR] [--cli FILE] [--jobs N]
 *   node scripts/corpus.js diff   BEFORE AFTER [RULE,RULE...]
 *   node scripts/corpus.js sample OUT RULE [N]
 *
 * NAMES is a file with one repository directory name per line, resolved under
 * --root (default: the parent of this repository). OUT is a directory of JSON
 * reports, one per repository. Nothing is written into the repositories
 * themselves: the cache is off, --fix is never passed, and the working directory
 * is the repository only so its own .gitignore and config apply, as in CI.
 *
 * Why a script and not a one-off. Tuning the rules by reading a few findings
 * gets the easy ones right and the rest wrong, and three things only showed up
 * by measuring:
 *
 *  - Repositories are working copies, not commits, and they move while you work.
 *    A first comparison showed 79 findings "added" to a rule nobody had touched,
 *    because the repository had been edited between the two runs. So run the two
 *    sides back to back, and read the rules you did not change as a control group:
 *    every one of them must show a delta of exactly zero. `diff` prints that number.
 *
 *  - A removed finding is only good if it was a false positive. `diff` prints the
 *    removed ones with their source line so they can be read, and prints every
 *    ADDED one in full, because an added finding is a regression or a side effect.
 *
 *  - Sample across repositories. The noisiest repository is not the typical one:
 *    `sample` takes at most two findings from each, with a fixed seed so a sample
 *    can be read again.
 *
 * To compare two versions of the rules, put the old one in a worktree
 * (`git worktree add --detach /tmp/before main`) and run each with --cli.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const PATTERN = '**/*.{ts,tsx,js,jsx,mjs,cjs,astro,py,go,rs,java,rb,cs,c,h,cpp,kt,swift,php,sh,html,css,scss,less,md,json,yaml,yml}';
const [command, ...rest] = process.argv.slice(2);

function flag(name, fallback) {
    const at = rest.indexOf(`--${name}`);
    if (at < 0) return fallback;
    const value = rest[at + 1];
    rest.splice(at, 2);
    return value;
}

function die(message) {
    console.error(message);
    process.exit(2);
}

/** A tiny seeded generator, so the same sample comes back every time. */
function seeded(seed) {
    let state = seed >>> 0;
    return () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function load(dir) {
    const findings = new Map();
    let repositories = 0;
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json'))) {
        let list;
        try { list = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch { continue; }
        repositories++;
        const repo = file.slice(0, -5);
        for (const v of list) {
            // The link checker depends on the network and on a time budget, so it
            // would differ between two identical runs.
            if (v.ruleId === 'VBC-401') continue;
            findings.set(`${repo}|${v.file}|${v.line}|${v.ruleId}`, { repo, ...v });
        }
    }
    return { findings, repositories };
}

function sourceLine(root, v) {
    try {
        return (fs.readFileSync(path.join(root, v.repo, v.file), 'utf8').split('\n')[v.line - 1] || '').trim().slice(0, 110);
    } catch {
        return '(unreadable)';
    }
}

function run() {
    const root = flag('root', path.resolve(__dirname, '..', '..'));
    const cli = flag('cli', path.resolve(__dirname, '..', 'dist', 'index.js'));
    const jobs = Number(flag('jobs', Math.max(1, Math.min(4, os.cpus().length))));
    const [namesFile, out] = rest;
    if (!namesFile || !out) die('usage: corpus.js run NAMES OUT [--root DIR] [--cli FILE] [--jobs N]');

    const names = fs.readFileSync(namesFile, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
    fs.mkdirSync(out, { recursive: true });

    let next = 0;
    let running = 0;
    const started = Date.now();
    const slow = [];

    const launch = () => {
        while (running < jobs && next < names.length) {
            const name = names[next++];
            const cwd = path.join(root, name);
            if (!fs.existsSync(cwd)) { console.error(`skipped, not found: ${name}`); continue; }
            running++;
            const began = Date.now();
            // --link-budget 3: the link checker is the one rule that goes to the
            // network, and it is left out of every comparison anyway.
            const child = cp.spawn(process.execPath,
                [cli, PATTERN, '-f', 'json', '--no-cache', '--link-budget', '3'],
                { cwd, stdio: ['ignore', fs.openSync(path.join(out, `${name}.json`), 'w'), 'ignore'] });
            const timer = setTimeout(() => child.kill('SIGKILL'), 240_000);
            child.on('exit', code => {
                clearTimeout(timer);
                running--;
                const secs = (Date.now() - began) / 1000;
                if (secs > 30) slow.push(`${name} ${secs.toFixed(0)}s`);
                // Exit 1 means errors were found, which is a result and not a failure.
                if (code !== 0 && code !== 1) console.error(`${name}: exited ${code} after ${secs.toFixed(0)}s`);
                if (next >= names.length && running === 0) {
                    console.log(`${names.length} repositories in ${((Date.now() - started) / 1000).toFixed(0)}s`
                        + (slow.length ? `; slow: ${slow.join(', ')}` : ''));
                } else {
                    launch();
                }
            });
        }
    };
    launch();
}

function diff() {
    const [beforeDir, afterDir, only] = rest;
    if (!beforeDir || !afterDir) die('usage: corpus.js diff BEFORE AFTER [RULE,RULE...]');
    const root = flag('root', path.resolve(__dirname, '..', '..'));
    const focus = only ? new Set(only.split(',')) : null;
    const before = load(beforeDir);
    const after = load(afterDir);

    const per = {};
    const entry = id => (per[id] ??= { before: 0, after: 0, removed: [], added: [] });
    for (const [key, v] of before.findings) { entry(v.ruleId).before++; if (!after.findings.has(key)) per[v.ruleId].removed.push(v); }
    for (const [key, v] of after.findings) { entry(v.ruleId).after++; if (!before.findings.has(key)) per[v.ruleId].added.push(v); }

    const errors = map => [...map.values()].filter(v => v.severity === 'error').length;
    console.log(`repositories: ${before.repositories} before, ${after.repositories} after`);
    console.log(`findings: ${before.findings.size} -> ${after.findings.size}`
        + `   |   errors that fail a build: ${errors(before.findings)} -> ${errors(after.findings)}\n`);

    const changed = Object.entries(per).filter(([, r]) => r.removed.length || r.added.length)
        .sort((a, b) => (b[1].removed.length + b[1].added.length) - (a[1].removed.length + a[1].added.length));
    console.log('rule        before  after  removed  ADDED');
    for (const [id, r] of changed) {
        console.log(`${id.padEnd(11)} ${String(r.before).padStart(6)} ${String(r.after).padStart(6)} ${String(r.removed.length).padStart(8)} ${String(r.added.length).padStart(6)}`);
    }

    // The control group: a rule nobody touched that still changed means the
    // repositories moved between the two runs, and nothing above can be trusted.
    console.log(`\n${Object.keys(per).length - changed.length} rules unchanged: the control group. ` +
        'A rule listed above that you did not edit means the repositories moved between the two runs; ' +
        'run both sides again, back to back.');

    const show = Number(process.env.N || 6);
    const random = seeded(7);
    for (const [id, r] of changed) {
        if (focus && !focus.has(id)) continue;
        console.log(`\n===== ${id}: ${r.removed.length} removed, ${r.added.length} added =====`);
        [...r.removed].sort(() => random() - 0.5).slice(0, show)
            .forEach(v => console.log(`  - ${v.repo}/${v.file}:${v.line}  ${sourceLine(root, v)}`));
        r.added.slice(0, 10).forEach(v => console.log(`  + ADDED ${v.repo}/${v.file}:${v.line}  ${sourceLine(root, v)}`));
    }
}

function sample() {
    const [dir, rule, n = '8'] = rest;
    if (!dir || !rule) die('usage: corpus.js sample OUT RULE [N]');
    const root = flag('root', path.resolve(__dirname, '..', '..'));
    const random = seeded(20260930);
    const picks = [];
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.json'))) {
        let list;
        try { list = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch { continue; }
        const repo = file.slice(0, -5);
        list.filter(v => v.ruleId === rule).sort(() => random() - 0.5).slice(0, 2).forEach(v => picks.push({ repo, ...v }));
    }
    picks.sort(() => random() - 0.5).slice(0, Number(n)).forEach((v, i) =>
        console.log(`[${i + 1}] ${v.repo}/${v.file}:${v.line}\n      ${sourceLine(root, v)}`));
    console.log(`\n(${picks.length} repositories have ${rule})`);
}

({ run, diff, sample }[command] || (() => die('usage: corpus.js run|diff|sample ...')))();
