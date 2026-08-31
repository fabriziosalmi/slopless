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
    code: 'source code only — matches inside strings and comments are ignored',
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
        // A message that shows an example link must not become a real one.
        .replace(/\[/g, '\\[');
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

function main() {
    const yamlFiles = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    const allRules: { id: string; name: string; category: string; severity: string }[] = [];

    for (const file of yamlFiles) {
        const filePath = path.join(RULES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');

        try {
            const doc = yaml.load(content);

            const processRule = (rule: any) => {
                if (rule.id && rule.name && rule.category) {
                    generateRuleDoc(rule as Rule);
                    allRules.push({ id: rule.id, name: rule.name, category: rule.category, severity: rule.severity });
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

    // Generate index.md
    let indexContent = `# Rules\n\nAll ${allRules.length} rules, grouped by category. `
        + `Every rule ships executable examples, run by \`rule-fixtures.test.ts\`.\n\n`;

    const categories = [...new Set(allRules.map(r => r.category))].sort();
    for (const cat of categories) {
        indexContent += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`;
        const catRules = allRules.filter(r => r.category === cat).sort((a, b) => a.id.localeCompare(b.id));
        for (const rule of catRules) {
            const badge = rule.severity === 'error' ? ' — **error**' : '';
            indexContent += `- [${rule.id}: ${rule.name}](./${rule.id}.md)${badge}\n`;
        }
        indexContent += `\n`;
    }

    fs.writeFileSync(path.join(DOCS_DIR, 'index.md'), indexContent);
    console.log(`Generated ${allRules.length} rule documents.`);
}

main();
