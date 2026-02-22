import * as fs from 'fs';
import { Rule } from '../engine/schema';

export interface Violation {
    ruleId: string;
    name: string;
    severity: 'error' | 'warning';
    message: string;
    file: string;
    line: number;
    fix?: {
        pattern: string;
        replacement: string;
    };
}

export class RegexChecker {
    static check(file: string, rules: Rule[], rawContent?: string): Violation[] {
        const violations: Violation[] = [];
        const content = rawContent !== undefined ? rawContent : fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');

        const ext = file.split('.').pop() || '';
        const isTsOrJs = ['ts', 'tsx', 'js', 'jsx'].includes(ext);
        const protectedRanges = isTsOrJs ? import('../engine/ast-utils').then(m => m.getProtectedRanges(content, true)) : null;

        // Load protected ranges synchronously since our scanner is synchronous
        // To avoid async rewrite of this whole method, we just require it
        const { getProtectedRanges } = require('../engine/ast-utils');
        const ranges = getProtectedRanges(content, isTsOrJs);

        for (const rule of rules) {
            if (!rule.match.regex) continue;

            if (rule.match.file_types) {
                if (!rule.match.file_types.includes(ext)) {
                    continue;
                }
            }

            const flags = (rule.match.flags || '') + (rule.match.flags?.includes('g') ? '' : 'g');
            const regex = new RegExp(rule.match.regex, flags);

            let absoluteOffset = 0;
            lines.forEach((lineText, index) => {
                let match;
                while ((match = regex.exec(lineText)) !== null) {
                    const matchStartAbsolute = absoluteOffset + match.index;
                    const matchEndAbsolute = matchStartAbsolute + match[0].length;

                    // Check if match falls within a protected range (string or comment)
                    let isProtected = false;
                    for (const r of ranges) {
                        if (matchStartAbsolute >= r.start && matchEndAbsolute <= r.end) {
                            isProtected = true;
                            break;
                        }
                    }

                    if (!isProtected) {
                        violations.push({
                            ruleId: rule.id,
                            name: rule.name,
                            severity: rule.severity,
                            message: this.formatMessage(rule.message, {
                                line: index + 1,
                                match: match[0],
                                count: lineText.length
                            }),
                            file,
                            line: index + 1,
                            fix: rule.fix?.regex_replace ? {
                                pattern: rule.fix.regex_replace.pattern,
                                replacement: rule.fix.regex_replace.replacement
                            } : undefined
                        });
                    }

                    if (!regex.global) break; // Prevent infinite loop if flag lacks 'g'
                }
                regex.lastIndex = 0; // Reset regex index for the next line
                absoluteOffset += lineText.length + 1; // +1 for the newline character
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
