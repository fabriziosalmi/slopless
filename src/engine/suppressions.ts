import * as fs from 'fs';
import { Violation } from '../checkers/regex-checker';

// `// slopless-disable-next-line VBC-001 -- fake token, this test asserts it is redacted`
//
// A rule can be right about the shape and wrong about this line, and until now the
// only way to say so was to turn the rule off for the whole repository: one
// justified exception cost every other file's coverage. A suppression names the
// rule it silences, so it stops applying the moment the line changes character.
const DIRECTIVE = /slopless-disable-(next-line|line)\b([^\n]*)/;

// Rule ids up to the `--`, which begins the human explanation.
const RULE_ID = /\b(VBC-\d+)\b/g;

export interface Suppression {
    line: number;
    ruleIds: string[] | null;   // null suppresses every rule on the line
}

export function parseSuppressions(content: string): Suppression[] {
    const out: Suppression[] = [];
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const match = DIRECTIVE.exec(lines[i]);
        if (!match) continue;
        // Everything after `--` is prose, and prose can mention a rule id without
        // silencing it. Only the ids before the dashes select rules.
        const argument = match[2].split(/\s--\s|\s--$/)[0];
        const ids = argument.match(RULE_ID);
        out.push({
            line: match[1] === 'next-line' ? i + 2 : i + 1,
            ruleIds: ids && ids.length > 0 ? ids : null,
        });
    }
    return out;
}

export function applySuppressions(violations: Violation[], readFile = defaultRead): Violation[] {
    const byFile = new Map<string, Suppression[]>();
    return violations.filter(violation => {
        if (!byFile.has(violation.file)) {
            const content = readFile(violation.file);
            byFile.set(violation.file, content === undefined ? [] : parseSuppressions(content));
        }
        return !byFile.get(violation.file)!.some(s =>
            s.line === violation.line && (s.ruleIds === null || s.ruleIds.includes(violation.ruleId)));
    });
}

function defaultRead(file: string): string | undefined {
    // A violation can name a file that has since moved; losing the suppression is
    // the safe direction, so a read failure reports rather than hides.
    try {
        return fs.readFileSync(file, 'utf8');
    } catch {
        return undefined;
    }
}
