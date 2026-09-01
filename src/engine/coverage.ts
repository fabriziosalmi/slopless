import { Rule } from './schema';

// The tiers that parse with the TypeScript compiler can only read what it can
// parse. This is not a policy, it is the parser, so it lives here rather than
// inside each checker: a rule count that disagrees with what actually ran is
// worse than no rule count at all.
export const PARSED_LANGUAGES = new Set(['js', 'ts', 'jsx', 'tsx']);
export const TYPED_LANGUAGES = new Set(['ts', 'tsx']);

export type Tier = 'regex' | 'ast' | 'semantic' | 'heuristic' | 'type' | 'git';

export function tierOf(rule: Rule): Tier {
    const match = rule.match;
    if (match.regex) return 'regex';
    if (match.ast_check) return 'ast';
    if (match.semantic_check) return 'semantic';
    if (match.heuristic_check) return 'heuristic';
    if (match.type_check) return 'type';
    return 'git';
}

export function extensionOf(file: string): string {
    const base = file.split(/[/\\]/).pop() ?? file;
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? '' : base.slice(dot + 1).toLowerCase();
}

// Whether this rule can produce a finding in a file with this extension. The
// checkers ask the same question, so a rule cannot be counted as covering a file
// it will be skipped for.
export function appliesTo(rule: Rule, ext: string): boolean {
    // A variant is the same rule written for another language, so it counts.
    if (rule.match.variants?.some(v => v.file_types.includes(ext))) return true;
    const declared = rule.match.file_types;
    if (declared && !declared.includes(ext)) return false;
    switch (tierOf(rule)) {
        case 'regex': return true;   // no file_types means every file, as the checker reads it
        case 'ast':
        case 'semantic': return PARSED_LANGUAGES.has(ext);
        case 'type': return TYPED_LANGUAGES.has(ext);
        // Not one tier but two checks with different reach: link-checker only
        // reads Markdown, stale-copyright-year reads any file it is declared for.
        case 'heuristic': return rule.match.heuristic_check !== 'link-checker' || ext === 'md';
        case 'git': return false;
    }
}

export interface Coverage {
    ext: string;
    files: number;
    rules: number;
}

export function coverageOf(files: string[], rules: Rule[]): Coverage[] {
    const counts = new Map<string, number>();
    for (const file of files) {
        const ext = extensionOf(file);
        counts.set(ext, (counts.get(ext) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([ext, count]) => ({
            ext,
            files: count,
            rules: rules.filter(rule => appliesTo(rule, ext)).length,
        }))
        .sort((a, b) => b.files - a.files || a.ext.localeCompare(b.ext));
}

// One line, always true: which languages were read, and by how many rules. A
// file whose extension no rule covers is read and reported on by nothing, and
// silence there is indistinguishable from a pass.
export function describeCoverage(coverage: Coverage[], total: number): string {
    const parts = coverage.map(c =>
        `.${c.ext || '(no extension)'} ${c.rules === 0 ? 'nothing applies' : `${c.rules} rule${c.rules === 1 ? '' : 's'}`}`);
    const files = coverage.reduce((sum, c) => sum + c.files, 0);
    return `Checked ${files} file${files === 1 ? '' : 's'} of ${total} rules: ${parts.join(', ')}.`;
}

export function uncovered(coverage: Coverage[]): Coverage[] {
    return coverage.filter(c => c.rules === 0);
}
