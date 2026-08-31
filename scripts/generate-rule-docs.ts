import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const RULES_DIR = path.join(__dirname, '../rules');
const DOCS_DIR = path.join(__dirname, '../docs/rules');

if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
}

interface Rule {
    id: string;
    name: string;
    category: string;
    severity: string;
    tags: string[];
    message: string;
    match?: any;
}

function generateRuleDoc(rule: Rule) {
    const content = `---
title: ${rule.id} - ${rule.name}
editLink: false
---

# ${rule.id}: ${rule.name}

<badge type="warning" text="${rule.severity}" />

**Category:** ${rule.category}  
**Tags:** ${rule.tags?.join(', ') || ''}

## Message
\`\`\`text
${rule.message}
\`\`\`

## Analysis Mode
${rule.match?.regex ? '`Regex`' : ''}
${rule.match?.ast_check ? '`AST`' : ''}
${rule.match?.git_check ? '`Git`' : ''}
${rule.match?.heuristic_check ? '`Heuristic`' : ''}
${rule.match?.semantic_check ? '`Semantic`' : ''}

## Description
This rule helps maintain code quality by detecting specific anti-patterns or vibecoding behaviors.

${rule.match?.regex ? `### Regex Pattern
\`\`\`regex
${rule.match.regex}
\`\`\`
` : ''}

${rule.match?.ast_check ? `### AST Check Configuration
- **Type:** \`${rule.match.ast_check.type}\`
${rule.match.ast_check.threshold ? `- **Threshold:** \`${rule.match.ast_check.threshold}\`` : ''}
` : ''}

## Tags
${rule.tags?.map(tag => `\`${tag}\``).join(' ') || ''}
`;

    fs.writeFileSync(path.join(DOCS_DIR, `${rule.id}.md`), content);
}

function main() {
    const yamlFiles = fs.readdirSync(RULES_DIR).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    const allRules: { id: string; name: string; category: string }[] = [];

    for (const file of yamlFiles) {
        const filePath = path.join(RULES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');

        try {
            const doc = yaml.load(content);

            const processRule = (rule: any) => {
                if (rule.id && rule.name && rule.category) {
                    generateRuleDoc(rule as Rule);
                    allRules.push({ id: rule.id, name: rule.name, category: rule.category });
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
    let indexContent = `# Rules Directory\n\nComplete reference of all static analysis rules.\n\n`;

    const categories = [...new Set(allRules.map(r => r.category))].sort();
    for (const cat of categories) {
        indexContent += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n`;
        const catRules = allRules.filter(r => r.category === cat).sort((a, b) => a.id.localeCompare(b.id));
        for (const rule of catRules) {
            indexContent += `- [${rule.id}: ${rule.name}](./${rule.id}.md)\n`;
        }
        indexContent += `\n`;
    }

    fs.writeFileSync(path.join(DOCS_DIR, 'index.md'), indexContent);
    console.log(`Generated ${allRules.length} rule documents.`);
}

main();
