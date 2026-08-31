import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

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
        { file: 'action.yml', patterns: [/\b\d+ rules\b/g] },
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
    console.log(`Generated ${allRules.length} rule documents.`);
}

main();
