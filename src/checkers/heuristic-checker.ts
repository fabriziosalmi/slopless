import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';

export class HeuristicChecker {
    static async check(file: string, rules: Rule[], rawContent?: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        const content = rawContent !== undefined ? rawContent : fs.readFileSync(file, 'utf8');

        for (const rule of rules) {
            if (!rule.match.heuristic_check) continue;

            if (rule.match.heuristic_check === 'link-checker') {
                if (file.endsWith('.md')) {
                    const links = this.extractLinks(content);
                    for (const link of links) {
                        const isOk = await this.checkLink(link);
                        if (!isOk) {
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: this.formatMessage(rule.message, { url: link, match: link, line: this.getLineNumber(content, link) }),
                                file,
                                line: this.getLineNumber(content, link),
                            });
                        }
                    }
                }
            }
        }

        return violations;
    }

    private static extractLinks(content: string): string[] {
        const regex = /\[.*?\]\((https?:\/\/.*?)\)/g;
        const links: string[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            links.push(match[1]);
        }
        return links;
    }

    private static async checkLink(url: string): Promise<boolean> {
        try {
            const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3000) });
            return response.ok;
        } catch (e) {
            // If HEAD fails, try GET (some servers block HEAD)
            try {
                const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
                return response.ok;
            } catch (e2) {
                return false;
            }
        }
    }

    private static getLineNumber(content: string, substring: string): number {
        const index = content.indexOf(substring);
        if (index === -1) return 0;
        return content.substring(0, index).split('\n').length;
    }

    private static formatMessage(message: string, context: { [key: string]: any }): string {
        let fmt = message;
        for (const [key, value] of Object.entries(context)) {
            fmt = fmt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
        return fmt;
    }
}
