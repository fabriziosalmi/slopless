/**
 * What the panel says and how it orders things, built without the editor API so
 * it can be tested. Like `report.ts`, nothing in here reaches for `vscode`.
 */
import * as path from 'path';
import { plural, type Finding } from './report';

export type Grouping = 'file' | 'rule';

const isError = (finding: Finding) => finding.severity === 'error';

export function countOf(findings: Finding[]): { errors: number; warnings: number } {
    const errors = findings.filter(isError).length;
    return { errors, warnings: findings.length - errors };
}

/** "1 error, 5 warnings", or "5 warnings" when nothing is an error. */
export function countsText(errors: number, warnings: number): string {
    return errors ? `${plural(errors, 'error')}, ${plural(warnings, 'warning')}` : plural(warnings, 'warning');
}

/**
 * The last two directories of a workspace-relative path, or nothing for a file at
 * the root.
 *
 * It is the end of the path that tells two files apart. The row used to show the
 * whole path after the counts, and a narrow sidebar cuts from the right: `report.ts`
 * and `server.ts` both read `packages/vscode-slopless…`, and two `index.ts` in
 * different packages would have read the same.
 */
export function shortDir(relativePath: string): string {
    const dir = path.posix.dirname(relativePath.replace(/\\/g, '/'));
    if (dir === '.' || dir === '') return '';
    return dir.split('/').slice(-2).join('/');
}

/** The grey text after a file's name: where it is, then how much is wrong with it. */
export function fileDescription(relativePath: string, findings: Finding[]): string {
    const { errors, warnings } = countOf(findings);
    const where = shortDir(relativePath);
    const counts = countsText(errors, warnings);
    return where ? `${where} · ${counts}` : counts;
}

/**
 * The line number comes first, because it is the one thing a reader needs to go
 * and look, and in a narrow sidebar it is the end of the text that is cut.
 */
export function findingDescription(finding: Finding): string {
    return `line ${finding.line} · ${finding.ruleId}`;
}

/** `report.ts:14`, for a finding listed under its rule rather than under its file. */
export function locationLabel(relativePath: string, line: number): string {
    return `${path.posix.basename(relativePath.replace(/\\/g, '/'))}:${line}`;
}

interface HasFindings {
    path: string;
    findings: Finding[];
}

/** Errors first, then by how much is wrong, so the top of the list is the top of the list. */
export function orderFiles<T extends HasFindings>(files: T[]): T[] {
    return [...files].sort((a, b) =>
        countOf(b.findings).errors - countOf(a.findings).errors
        || b.findings.length - a.findings.length
        || a.path.localeCompare(b.path));
}

export interface RuleGroup<T> {
    ruleId: string;
    name: string;
    severity: string;
    items: { file: T; finding: Finding }[];
}

/**
 * The same findings seen by rule instead of by file. Which rules produce most of
 * what is on screen is the question tuning asks, and the answer used to exist
 * only in the text the report copies: on this repository two rules were 40% of it.
 */
export function groupByRule<T extends HasFindings>(files: T[]): RuleGroup<T>[] {
    const groups = new Map<string, RuleGroup<T>>();
    for (const file of files) {
        for (const finding of file.findings) {
            let group = groups.get(finding.ruleId);
            if (!group) {
                group = { ruleId: finding.ruleId, name: finding.name, severity: finding.severity, items: [] };
                groups.set(finding.ruleId, group);
            }
            group.items.push({ file, finding });
        }
    }
    const weight = (group: RuleGroup<T>) => (group.severity === 'error' ? 1 : 0);
    return [...groups.values()]
        .map(group => ({
            ...group,
            items: group.items.sort((a, b) =>
                a.file.path.localeCompare(b.file.path) || a.finding.line - b.finding.line),
        }))
        .sort((a, b) =>
            weight(b) - weight(a) || b.items.length - a.items.length || a.ruleId.localeCompare(b.ruleId));
}

export interface Summary {
    errors: number;
    warnings: number;
    /** Files that have a finding. */
    files: number;
    /** Files the last scan read. */
    read: number;
    /** The most a scan will read; reaching it means some files were not. */
    limit: number;
    /** What the list is narrowed to, in words, or nothing when it is not. */
    scope?: string;
}

/**
 * The line under the panel's title. The counts live here and in the badge rather
 * than in the title: the view sits in a container that is itself called Slopless,
 * so a title of "Slopless — 1 / 119" read "Slopless: Slopless — 1 / 119" and never
 * said which number was which.
 */
export function summaryMessage(s: Summary): string {
    const scope = s.scope ? ` ${s.scope}` : '';
    const stopped = s.read >= s.limit
        ? ` Stopped at ${s.limit} files; what is beyond them was not read.`
        : '';
    if (!s.errors && !s.warnings) {
        return s.read
            ? `Nothing found in ${plural(s.read, 'file')}.${scope}${stopped}`
            : 'Nothing found.';
    }
    return `${plural(s.errors, 'error')} and ${plural(s.warnings, 'warning')} `
        + `in ${s.files} of ${plural(s.read, 'file')}.${scope}${stopped}`;
}

/**
 * The files `git status` names, as absolute paths under `root`, without the ones
 * that are gone or that lie outside it.
 *
 * `-z` output: `XY path` entries separated by NUL, and a rename or a copy is
 * followed by one more entry holding the path it came from, which is not a file
 * that exists any more and is skipped. Paths are relative to the top of the
 * repository whatever the directory git was run in, so a workspace that is a
 * subdirectory passes its `prefix` (what `git rev-parse --show-prefix` prints)
 * and gets the rest joined onto its own root. Going through the workspace's own
 * path rather than git's also keeps the answer right when the workspace was
 * opened through a symlink, where the two spellings of one directory differ.
 */
export function parseStatus(output: string, root: string, prefix = ''): string[] {
    const entries = output.split('\0');
    const files: string[] = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.length < 4) continue;
        const index = entry[0];
        const worktree = entry[1];
        if ('RC'.includes(index) || 'RC'.includes(worktree)) i++;
        if (index === 'D' || worktree === 'D') continue;
        const file = entry.slice(3);
        if (!file.startsWith(prefix)) continue;
        files.push(path.join(root, file.slice(prefix.length)));
    }
    return files;
}
