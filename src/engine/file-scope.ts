import { minimatch } from 'minimatch';
import { Rule } from './schema';

/**
 * Whether a rule should skip this file entirely.
 *
 * This lived inside the regex checker, so `exclude_files` silently did nothing
 * in the AST, semantic, heuristic and type tiers: a rule could declare an
 * exclusion and still fire from another checker.
 */
export function isExcludedFile(file: string, rule: Rule): boolean {
    const patterns = rule.match.exclude_files;
    if (!patterns || patterns.length === 0) return false;
    const normalised = file.replace(/\\/g, '/');
    return patterns.some(pattern => minimatch(normalised, pattern, { matchBase: true, dot: true }));
}
