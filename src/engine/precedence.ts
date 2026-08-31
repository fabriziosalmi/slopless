import { Rule } from './schema';
import { Violation } from '../checkers/regex-checker';

/**
 * Several rules deliberately describe the same defect at different levels of
 * detail — "there is a debt marker here" and "this marker is an unfinished AI
 * stub" both fire on one comment. A rule listing another in `supersedes` wins
 * on that line, so the report carries the most specific finding and nothing else.
 */
export function applyPrecedence(violations: Violation[], rules: Rule[]): Violation[] {
    const supersededBy = new Map<string, string[]>();
    for (const rule of rules) {
        if (rule.supersedes?.length) supersededBy.set(rule.id, rule.supersedes);
    }
    if (supersededBy.size === 0) return violations;

    const losersByLocation = new Map<string, Set<string>>();
    for (const violation of violations) {
        const targets = supersededBy.get(violation.ruleId);
        if (!targets) continue;
        const location = `${violation.file}:${violation.line}`;
        let losers = losersByLocation.get(location);
        if (!losers) {
            losers = new Set<string>();
            losersByLocation.set(location, losers);
        }
        for (const target of targets) losers.add(target);
    }
    if (losersByLocation.size === 0) return violations;

    return violations.filter(violation =>
        !losersByLocation.get(`${violation.file}:${violation.line}`)?.has(violation.ruleId));
}
