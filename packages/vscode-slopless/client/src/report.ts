/**
 * What the panel copies, built without touching the editor API so it can be
 * tested. The extension passes in what it knows; nothing in here reaches for
 * `vscode`.
 */

export interface Finding {
    ruleId: string;
    name: string;
    severity: string;
    message: string;
    line: number;
}

export interface FileFindings {
    path: string;          // relative to the workspace, for reading
    findings: Finding[];
}

/** A report meant to be pasted somewhere has to fit there. */
export const REPORT_LIMIT = 300;

export function plural(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The line-comment syntax for a file, or null when the answer is not one thing.
 *
 * `.astro` and `.md` have more than one depending on where in the file you are —
 * frontmatter or markup — and a marker written in the wrong one silences nothing
 * while looking as though it does.
 */
export function commentSyntax(file: string): string | null {
    const ext = (file.match(/\.[^.\\/]+$/)?.[0] ?? '').toLowerCase();
    const doubleSlash = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.java', '.go', '.rs',
        '.c', '.h', '.cpp', '.cs', '.kt', '.swift', '.php', '.scss', '.less'];
    const hash = ['.py', '.sh', '.rb', '.yaml', '.yml', '.toml'];
    if (doubleSlash.includes(ext)) return '//';
    if (hash.includes(ext)) return '#';
    return null;
}

/**
 * A disable marker, indented to sit above the line it silences and ending in
 * `-- ` on purpose: a suppression without a reason is the thing this tool exists
 * to complain about.
 */
export function suppression(comment: string, ruleId: string, targetLine: string): string {
    const indent = targetLine.match(/^\s*/)?.[0] ?? '';
    return `${indent}${comment} slopless-disable-next-line ${ruleId} -- `;
}

/** One finding with the lines around it, so the reader does not have to open the file. */
export function findingBlock(where: string, finding: Finding, lines: string[], around = 3): string {
    const first = Math.max(0, finding.line - 1 - around);
    const last = Math.min(lines.length - 1, finding.line - 1 + around);
    const width = String(last + 1).length;

    const rows: string[] = [];
    for (let n = first; n <= last; n++) {
        const marker = n === finding.line - 1 ? '>' : ' ';
        rows.push(`${marker} ${String(n + 1).padStart(width)} | ${lines[n]}`);
    }

    return [
        `slopless ${finding.ruleId} ${finding.name} (${finding.severity})`,
        `${where}:${finding.line}`,
        '',
        '```',
        ...rows,
        '```',
        '',
        finding.message,
    ].join('\n');
}

/** Everything the scan found, as something worth pasting somewhere else. */
export function report(files: FileFindings[], read: number, version: string): string {
    const all = files.flatMap(f => f.findings);
    const errors = all.filter(f => f.severity === 'error').length;
    const warnings = all.length - errors;

    const byRule = new Map<string, { n: number; severity: string; name: string }>();
    for (const finding of all) {
        const seen = byRule.get(finding.ruleId)
            ?? { n: 0, severity: finding.severity, name: finding.name };
        seen.n++;
        byRule.set(finding.ruleId, seen);
    }

    const lines = [
        `# slopless ${version}: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}`,
        '',
        `In ${plural(files.length, 'file')}, out of ${read} read. `
        + 'Errors fail a build; warnings are reported and do not.',
        '',
        '## By rule',
        ...[...byRule.entries()]
            .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
            .map(([id, rule]) => `- ${rule.n} × ${id} ${rule.name} (${rule.severity})`),
        '',
        '## Findings',
    ];

    let written = 0;
    for (const file of files) {
        if (written >= REPORT_LIMIT) break;
        lines.push('', `### ${file.path}`);
        for (const finding of [...file.findings].sort((a, b) => a.line - b.line)) {
            if (written >= REPORT_LIMIT) break;
            lines.push(
                `- line ${finding.line} · ${finding.ruleId} ${finding.name} `
                + `(${finding.severity}): ${finding.message}`,
            );
            written++;
        }
    }

    // Saying what was left out, rather than ending as though that was all of it.
    if (all.length > written) {
        lines.push('', `_Stopped after ${written} findings. ${all.length - written} more `
            + 'are in the panel and are not written here._');
    }
    return lines.join('\n');
}
