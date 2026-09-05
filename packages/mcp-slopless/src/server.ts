#!/usr/bin/env node
/**
 * Slopless as an MCP server.
 *
 * The CLI and the Action both read files that already exist, which means they
 * answer after the code is written and usually after it is committed. This
 * answers about a buffer: text that is about to be written, with the path it is
 * going to have, so the rules that depend on the language and on the file's
 * place in the tree still apply.
 *
 * It is the same engine and the same rules as everything else — there is no
 * second implementation to keep in step.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as fs from 'fs';

import { lintText, resolveRules } from 'slopless/dist/engine/api';

interface Finding {
    ruleId: string;
    name: string;
    severity: string;
    message: string;
    line: number;
}

const server = new McpServer({ name: 'slopless', version: '1.14.0' });

function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function render(findings: Finding[], label: string): string {
    if (!findings.length) return `${label}: nothing found.`;

    const errors = findings.filter(f => f.severity === 'error').length;
    const lines = findings
        .slice()
        .sort((a, b) => a.line - b.line)
        .map(f => {
            const level = f.severity === 'error' ? 'error' : 'warning';
            return `${level} ${f.ruleId} ${f.name} line ${f.line}: ${f.message}`;
        });

    const summary = `${label}: ${plural(errors, 'error')}, `
        + `${plural(findings.length - errors, 'warning')}.`;
    return [summary, ...lines].join('\n');
}

server.tool(
    'lint_text',
    'Check code that has not been written to disk yet. Give it the text and the path it '
    + 'is going to have: the extension decides which rules apply, and the path decides '
    + 'whether it counts as test code.',
    {
        content: z.string().describe('The code to check.'),
        file_path: z.string().describe('The path this code will have. The extension selects the rules.'),
    },
    async ({ content, file_path: filePath }) => {
        const findings = (await lintText(content, filePath)) as unknown as Finding[];
        return { content: [{ type: 'text', text: render(findings, filePath) }] };
    },
);

server.tool(
    'lint_files',
    'Check files that are on disk. Paths are read as given, relative to the working directory.',
    {
        paths: z.array(z.string()).min(1).describe('The files to check.'),
    },
    async ({ paths }) => {
        const parts: string[] = [];
        for (const file of paths) {
            try {
                const text = fs.readFileSync(file, 'utf8');
                parts.push(render((await lintText(text, file)) as unknown as Finding[], file));
            } catch (error) {
                // Saying which file could not be read is the point; swallowing it
                // would report "nothing found" for a file nothing looked at.
                parts.push(`${file}: not read — ${(error as Error).message}`);
            }
        }
        return { content: [{ type: 'text', text: parts.join('\n\n') }] };
    },
);

server.tool(
    'describe_rule',
    'What a rule is about, by id (VBC-005) or by name (use-var). Without an argument, '
    + 'lists every rule.',
    {
        rule: z.string().optional().describe('A rule id or name. Omit to list all of them.'),
    },
    async ({ rule }) => {
        // The same set the linter would run, config overrides included, rather
        // than a second list that can drift away from it.
        const rules = resolveRules() as unknown as Array<{
            id: string; name: string; severity: string; category: string; message: string;
        }>;

        if (!rule) {
            const listed = rules
                .map(r => `${r.id} ${r.name} (${r.severity}, ${r.category})`)
                .sort()
                .join('\n');
            return { content: [{ type: 'text', text: `${rules.length} rules.\n${listed}` }] };
        }

        const wanted = rule.toLowerCase();
        const found = rules.filter(r => r.id.toLowerCase() === wanted || r.name.toLowerCase() === wanted);
        if (!found.length) {
            return { content: [{ type: 'text', text: `No rule called ${rule}.` }] };
        }
        return {
            content: [{
                type: 'text',
                text: found
                    .map(r => `${r.id} — ${r.name}\nseverity: ${r.severity}\ncategory: ${r.category}\n\n${r.message}`)
                    .join('\n\n'),
            }],
        };
    },
);

async function main() {
    await server.connect(new StdioServerTransport());
}

main().catch(error => {
    // stdout is the transport, so anything said here has to go to stderr.
    process.stderr.write(`slopless mcp failed to start: ${(error as Error).message}\n`);
    process.exit(1);
});
