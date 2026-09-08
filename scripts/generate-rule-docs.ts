import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { appliesTo } from '../src/engine/coverage';
import type { Rule as EngineRule } from '../src/engine/schema';
import { RuleLoader } from '../src/engine/loader';

const RULES_DIR = path.join(__dirname, '../rules');
const DOCS_DIR = path.join(__dirname, '../docs/rules');

if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
}

interface RuleTest {
    file?: string;
    code: string;
    repeat?: number;
}

interface Rule {
    id: string;
    name: string;
    category: string;
    severity: string;
    tags: string[];
    message: string;
    supersedes?: string[];
    opt_in?: boolean;
    match?: any;
    tests?: { fire?: (string | RuleTest)[]; quiet?: (string | RuleTest)[]; external?: string };
}

const SCAN_SCOPES: Record<string, string> = {
    code: 'source code only, ignoring anything inside strings and comments',
    strings: 'string and template literals only',
    comments: 'comments only',
    all: 'the whole file, with no scope filtering',
};

/**
 * VitePress runs every page through the Vue compiler, so a raw `<div>` in a rule
 * message is an unclosed element and fails the whole build.
 */
function escapeInline(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\{\{/g, '&#123;&#123;')
        .replace(/\|/g, '&#124;')
        // A message that shows an example link must not become a real one.
        .replace(/\[/g, '\\[');
}

/** First sentence of the message, with the report-line scaffolding removed. */
function summarise(message: string): string {
    const firstSentence = message.split(/(?<=\.)\s/)[0];
    return firstSentence
        .replace(/\s*(?:at|on)?\s*line \{line\}/g, '')
        .replace(/\s*\(\{\w+\}\)/g, '')          // "too deep ({count})"
        .replace(/\s*'\{\w+\}'/g, '')              // "name '{name}'"
        .replace(/\s*\{\w+\}/g, '')                // anything left over
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,:])/g, '$1')
        .replace(/[.,:]$/, '')
        .trim()
        .replace(/^(.{0,84})(\s.*)?$/s, (_, head, tail) => (tail ? head + '…' : head));
}

function analysisMode(rule: Rule): string {
    const match = rule.match ?? {};
    if (match.regex) return match.multiline ? '`Regex` (whole file)' : '`Regex` (line by line)';
    if (match.ast_check) return '`AST`';
    if (match.git_check) return '`Git`';
    if (match.heuristic_check) return '`Heuristic`';
    if (match.semantic_check) return '`Semantic`';
    if (match.type_check) return '`Type checker`';
    return '`Unknown`';
}

function snippet(testCase: string | RuleTest, rule: Rule): string {
    const isString = typeof testCase === 'string';
    const code = isString ? testCase : (testCase.repeat ? testCase.code.repeat(testCase.repeat) : testCase.code);
    const file = isString ? undefined : testCase.file;
    const lang = (file ?? `x.${rule.match?.file_types?.[0] ?? 'ts'}`).split('.').pop();
    return `\`\`\`${lang}\n${code.replace(/\n$/, '')}\n\`\`\`\n`;
}

function examplesSection(rule: Rule): string {
    if (rule.tests?.external) {
        return `## Examples\n\nExercised by \`${escapeInline(rule.tests.external)}\`.\n`;
    }
    let out = '';
    if (rule.tests?.fire?.length) {
        out += `## Flagged\n\n${rule.tests.fire.map(t => snippet(t, rule)).join('\n')}`;
    }
    if (rule.tests?.quiet?.length) {
        out += `\n## Not flagged\n\n${rule.tests.quiet.map(t => snippet(t, rule)).join('\n')}`;
    }
    return out;
}

function generateRuleDoc(rule: Rule) {
    const match = rule.match ?? {};
    const scope = SCAN_SCOPES[match.scan ?? 'code'];
    const details = [
        `**Category:** ${rule.category}`,
        `**Analysis:** ${analysisMode(rule)}`,
        match.file_types ? `**File types:** ${match.file_types.map((t: string) => `\`.${t}\``).join(', ')}` : '',
        match.regex ? `**Scope:** ${scope}` : '',
        match.exclude_files ? `**Excluded paths:** ${match.exclude_files.map((f: string) => `\`${f}\``).join(', ')}` : '',
        match.exclude_selectors ? `**Excluded selectors:** ${match.exclude_selectors.map((f: string) => `\`${f}\``).join(', ')}` : '',
        rule.supersedes ? `**Supersedes:** ${rule.supersedes.map(id => `[${id}](./${id}.md)`).join(', ')} on the same line` : '',
        rule.opt_in ? '**Off by default.** Name it in `slopless.config.json` to turn it on.' : '',
        rule.tags?.length ? `**Tags:** ${rule.tags.map(tag => `\`${tag}\``).join(' ')}` : '',
    ].filter(Boolean).join('  \n');

    const content = `---
title: ${rule.id} - ${rule.name}
editLink: false
---

# ${rule.id}: ${rule.name}

<badge type="${rule.severity === 'error' ? 'danger' : 'warning'}" text="${rule.severity}" />

${details}

## What it reports

${escapeInline(rule.message)}

${examplesSection(rule)}
${match.regex ? `## Pattern\n\n\`\`\`regex\n${match.regex}\n\`\`\`\n` : ''}${match.ast_check ? `## AST check\n\n- **Type:** \`${match.ast_check.type}\`\n${match.ast_check.threshold ? `- **Threshold:** \`${match.ast_check.threshold}\`\n` : ''}` : ''}${match.threshold !== undefined ? `\n- **Threshold:** \`${match.threshold}\`\n` : ''}`;

    fs.writeFileSync(path.join(DOCS_DIR, `${rule.id}.md`), content);
}

/** The site's changelog is the repository's, so it cannot drift out of date. */
function generateChangelog() {
    const source = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
    const releases = source.split('# Changelog\n')[0].trimEnd();
    const page = `---
title: Changelog
description: Release notes for slopless, and what changed in each version.
editLink: false
---

${releases}

Older entries are in [CHANGELOG.md](https://github.com/fabriziosalmi/slopless/blob/main/CHANGELOG.md).
`;
    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'changelog.md'), page);
}

/**
 * The rule count is quoted in prose in several files. Written by hand it goes
 * stale the moment a rule is added, which it did twice in one day, so it is
 * rewritten from the real count instead. CI fails if any of these drift.
 */
function syncRuleCounts(total: number) {
    const targets: { file: string; patterns: RegExp[] }[] = [
        { file: 'docs/index.md', patterns: [
            /\b\d+ deterministic rules\b/g, /\bThe \d+ rules\b/g,
            /\[ \d+ rules \]/g, /<b>\d+<\/b> rules/g,
        ] },
        { file: 'README.md', patterns: [/\b\d+ rigorous rules\b/g, /\ball \d+ rules\b/g] },
    ];

    for (const { file, patterns } of targets) {
        const full = path.join(__dirname, '..', file);
        const before = fs.readFileSync(full, 'utf8');
        let after = before;
        for (const pattern of patterns) {
            after = after.replace(pattern, match => match.replace(/\d+/, String(total)));
        }
        if (after !== before) {
            fs.writeFileSync(full, after);
            console.log(`Updated the rule count in ${file}.`);
        }
    }
}


/**
 * How much of the tool reaches each language, written from the rules rather than
 * from memory. The claim drifts the moment a rule declares a new file type, and
 * a tool whose whole argument is that silence should be legible cannot be vague
 * about where it is silent.
 */
/**
 * Display names only. Which languages appear is read off the rules, because a
 * hand-written list is the drift this whole function exists to prevent: the
 * counts were generated and the list was not, so Astro and HTML were missing
 * from the table for four releases after the rules started reaching them.
 */
const LANGUAGE_NAMES: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TypeScript (JSX)', js: 'JavaScript', jsx: 'JavaScript (JSX)',
    py: 'Python', css: 'CSS', md: 'Markdown', go: 'Go', sh: 'Shell', rs: 'Rust',
    java: 'Java', rb: 'Ruby', cs: 'C#', kt: 'Kotlin', swift: 'Swift',
    html: 'HTML', astro: 'Astro', yaml: 'YAML', yml: 'YAML', json: 'JSON',
    txt: 'Plain text', toml: 'TOML', vue: 'Vue', svelte: 'Svelte', php: 'PHP',
    scss: 'Sass (SCSS)', less: 'Less', env: 'Dotenv',
    // `.c` used to be labelled "C and C++", which the count could not support:
    // the row counts rules that apply to `.c`, and says nothing about `.cpp`.
    // They are separate declarations in the rules, so they are separate rows.
    c: 'C', cpp: 'C++',
};

function declaredFileTypes(rules: EngineRule[]): string[] {
    const seen = new Set<string>();
    for (const rule of rules) {
        for (const ext of rule.match.file_types ?? []) seen.add(ext);
        for (const variant of rule.match.variants ?? []) {
            for (const ext of variant.file_types) seen.add(ext);
        }
    }
    return [...seen];
}

function syncLanguageCoverage(rules: EngineRule[]) {
    const declared = declaredFileTypes(rules);
    const unnamed = declared.filter(ext => !LANGUAGE_NAMES[ext]).sort();
    if (unnamed.length) {
        // Dropping it silently is how the table came to understate the tool.
        throw new Error(
            `No display name for ${unnamed.join(', ')}. Add it to LANGUAGE_NAMES in ` +
            `scripts/generate-rule-docs.ts, or the coverage table will not mention it.`,
        );
    }
    const languages: [string, string][] = declared
        .map(ext => [ext, LANGUAGE_NAMES[ext]] as [string, string]);
    const rows = languages
        .map(([ext, name]) => ({ ext, name, n: rules.filter(r => appliesTo(r, ext)).length }))
        .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

    const table = [
        '| language | rules |',
        '| --- | --- |',
        ...rows.map(({ ext, name, n }) => `| ${name} (\`.${ext}\`) | ${n} of ${rules.length} |`),
    ].join('\n');

    const block = `<!-- coverage:start -->\n${table}\n<!-- coverage:end -->`;
    for (const file of ['README.md', 'docs/languages.md']) {
        const full = path.join(__dirname, '..', file);
        if (!fs.existsSync(full)) continue;
        const before = fs.readFileSync(full, 'utf8');
        const after = before.replace(/<!-- coverage:start -->[\s\S]*?<!-- coverage:end -->/, block);
        if (after !== before) {
            fs.writeFileSync(full, after);
            console.log(`Updated the language coverage table in ${file}.`);
        }
    }
}


/**
 * `llms.txt`, in the format llmstxt.org describes: a plain-Markdown summary of
 * what this is and where the rest lives, for the models that answer questions
 * about it rather than crawling it.
 *
 * Generated for the same reason the rule pages are. A hand-written file naming a
 * count goes stale the moment a rule is added, and this one names three.
 */
function generateLlmsTxt(rules: { id: string; severity: string }[], languages: number) {
    const errors = rules.filter(rule => rule.severity === 'error').length;
    const site = 'https://fabriziosalmi.github.io/slopless';

    /** The link list llmstxt.org asks for: `- [Title](URL): description`. */
    const section = (entries: [string, string, string][]) =>
        entries.map(([title, url, what]) => `- [${title}](${url}): ${what}.`).join('\n');

    const content = `# slopless

> Static analysis that finds the patterns AI-written code leaves behind: ${rules.length}
> deterministic rules across ${languages} languages, with regex, AST, semantic and type
> checkers, auto-fix, and SARIF output. ${errors} rules are errors and fail a run; the
> remaining ${rules.length - errors} report and do not. It runs as a CLI, a GitHub Action,
> a VS Code extension and an MCP server, all on the same engine and the same rules.

Every rule ships two executable examples — a snippet it must flag and one it must
ignore — which run on every commit, so a rule page cannot describe behaviour the
tests do not verify. The tool is clean on itself in CI, and reports what it read
and by how many rules on every run, because a file no rule covers looks exactly
like a file that passed.

## Documentation

${section([
        ['What slopless is', `${site}/`,
            'what it catches, what it costs to adopt, and the ten-second start'],
        [`All ${rules.length} rules`, `${site}/rules/`,
            'every rule by category, with what it catches and how it analyses'],
        ['What reaches which language', `${site}/languages.html`,
            `how many of the ${rules.length} rules apply to each of the ${languages} languages`],
        ['Configuration', `${site}/configuration.html`,
            'severities, opt-in rules, ignore lists and the project vocabulary'],
        ['In the editor, and while writing', `${site}/editor.html`,
            'the VS Code extension and the MCP server, for checking a buffer first'],
        ['Writing a rule', `${site}/writing-a-rule.html`,
            'the YAML schema, scan scopes, precedence, and the required examples'],
    ])}

## Background

${section([
        ['The bug that hid every bug', `${site}/story.html`,
            'why the protected-range engine exists'],
        ['Changelog', `${site}/changelog.html`,
            'every release, with the measurement behind each decision'],
    ])}

## Source

${section([
        ['Repository', 'https://github.com/fabriziosalmi/slopless',
            'MIT, zero runtime dependencies'],
        ['npm package', 'https://www.npmjs.com/package/@fabriziosalmi/slopless',
            'npx @fabriziosalmi/slopless'],
        ['Security policy', 'https://github.com/fabriziosalmi/slopless/blob/main/SECURITY.md',
            'how to report a vulnerability privately'],
    ])}
`;

    fs.writeFileSync(path.join(__dirname, '..', 'docs', 'public', 'llms.txt'), content);
}

function main() {
    const yamlFiles = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    const allRules: { id: string; name: string; category: string; severity: string;
                      catches: string; analysis: string }[] = [];

    for (const file of yamlFiles) {
        const filePath = path.join(RULES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');

        try {
            const doc = yaml.load(content);

            const processRule = (rule: any) => {
                if (rule.id && rule.name && rule.category) {
                    generateRuleDoc(rule as Rule);
                    allRules.push({
                        id: rule.id, name: rule.name, category: rule.category,
                        severity: rule.severity,
                        catches: escapeInline(summarise(rule.message)),
                        analysis: analysisMode(rule).replace(/`/g, '').replace(/ \(.*\)/, ''),
                    });
                }
            };

            if (Array.isArray(doc)) {
                doc.forEach(processRule);
            } else {
                processRule(doc);
            }
        } catch (e) {
            console.error(`Error parsing ${file}:`, e);
        }
    }

    // Generate index.md: a table you can scan, not 147 bullets you have to read.
    const severityRank = (s: string) => (s === 'error' ? 0 : 1);
    const errors = allRules.filter(r => r.severity === 'error').length;

    let indexContent = `# Rules\n\n`
        + `All ${allRules.length} rules. **${errors}** are errors and fail the run; `
        + `the remaining ${allRules.length - errors} are warnings and only report.\n\n`
        + `Every rule ships a snippet it must flag and one it must ignore, executed on `
        + `every commit. Open any rule to see both.\n\n`
        + `Use the search box above to find a rule by what it catches.\n\n`;

    const categories = [...new Set(allRules.map(r => r.category))].sort();
    for (const cat of categories) {
        const catRules = allRules
            .filter(r => r.category === cat)
            .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.id.localeCompare(b.id));

        indexContent += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n\n`;
        indexContent += `| Rule | Catches | Severity | Analysis |\n|---|---|---|---|\n`;
        for (const rule of catRules) {
            const badge = rule.severity === 'error' ? '**error**' : 'warning';
            indexContent += `| [${rule.id}](./${rule.id}.md)<br>\`${rule.name}\` `
                + `| ${rule.catches} | ${badge} | ${rule.analysis} |\n`;
        }
        indexContent += `\n`;
    }

    fs.writeFileSync(path.join(DOCS_DIR, 'index.md'), indexContent);

    generateChangelog();
    syncRuleCounts(allRules.length);
    // Through the loader the engine uses, so the table cannot describe a rule set
    // the tool does not have.
    const loaded = RuleLoader.loadRules([RULES_DIR]);
    syncLanguageCoverage(loaded);

    // Same source as the coverage table, so llms.txt cannot claim a language
    // count the table disagrees with.
    const languages = new Set(loaded.flatMap(rule => [
        ...(rule.match.file_types ?? []),
        ...(rule.match.variants ?? []).flatMap(variant => variant.file_types),
    ]));
    generateLlmsTxt(allRules, languages.size);

    console.log(`Generated ${allRules.length} rule documents.`);
}

main();
