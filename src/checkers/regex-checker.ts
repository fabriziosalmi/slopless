import * as fs from 'fs';
import { Rule } from '../engine/schema';

export interface Violation {
    ruleId: string;
    name: string;
    severity: 'error' | 'warning';
    message: string;
    file: string;
    line: number;
}

export class RegexChecker {
    static check(file: string, rules: Rule[]): Violation[] {
        const violations: Violation[] = [];
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        for (const rule of rules) {
            if (!rule.match.regex) continue;

            // Filter by file type
            if (rule.match.file_types) {
                const ext = file.split('.').pop();
                if (ext && !rule.match.file_types.includes(ext)) {
                    continue;
                }
            }

            const flags = (rule.match.flags || '') + (rule.match.flags?.includes('g') ? '' : 'g');
            const regex = new RegExp(rule.match.regex, flags);

            lines.forEach((lineText, index) => {
                const matches = lineText.match(regex);
                if (matches) {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: this.formatMessage(rule.message, {
                            line: index + 1,
                            match: matches[0],
                            count: lineText.length
                        }),
                        file,
                        line: index + 1,
                    });
                }
                regex.lastIndex = 0; // Reset regex index for each line
            });
        }

        return violations;
    }

    private static formatMessage(message: string, context: { [key: string]: any }): string {
        let fmt = message;
        for (const [key, value] of Object.entries(context)) {
            fmt = fmt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
        return fmt;
    }
}
