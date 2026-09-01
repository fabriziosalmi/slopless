import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';
import { isExcludedFile } from '../engine/file-scope';

export class HeuristicChecker {
    static async check(file: string, rules: Rule[], rawContent?: string): Promise<Violation[]> {
        const violations: Violation[] = [];
        const content = rawContent !== undefined ? rawContent : fs.readFileSync(file, 'utf8');

        for (const rule of rules) {
            if (isExcludedFile(file, rule)) continue;
            if (rule.match.heuristic_check === 'link-checker' && file.endsWith('.md')) {
                violations.push(...await this.findBrokenLinks(file, content, rule));
            }
            if (rule.match.heuristic_check === 'stale-copyright-year') {
                violations.push(...this.findStaleCopyright(file, content, rule));
            }
        }

        return violations;
    }

    /**
     * A copyright year is only stale once the year turns, which a regex cannot know.
     * A notice carrying the current year, alone or as the end of a range, is correct.
     */
    private static findStaleCopyright(file: string, content: string, rule: Rule): Violation[] {
        const violations: Violation[] = [];
        const currentYear = new Date().getFullYear();
        const notice = /(?:©|\(c\)|copyright)\s*((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)?\d{2}|present))?/gi;

        content.split('\n').forEach((text, index) => {
            for (const match of text.matchAll(notice)) {
                const [, startYear, endYear] = match;
                if (endYear && /present/i.test(endYear)) continue;
                const latest = endYear
                    ? Number(endYear.length === 2 ? startYear.slice(0, 2) + endYear : endYear)
                    : Number(startYear);
                if (latest >= currentYear) continue;
                violations.push({
                    ruleId: rule.id,
                    name: rule.name,
                    severity: rule.severity,
                    message: rule.message
                        .replace('{line}', String(index + 1))
                        .replace('{match}', match[0])
                        .replace('{year}', String(currentYear)),
                    file,
                    line: index + 1,
                });
            }
        });
        return violations;
    }

    private static async findBrokenLinks(file: string, content: string, rule: Rule): Promise<Violation[]> {
        const violations: Violation[] = [];
        for (const link of this.extractLinks(content)) {
            if (await this.checkLink(link)) continue;
            const line = this.getLineNumber(content, link);
            violations.push({
                ruleId: rule.id,
                name: rule.name,
                severity: rule.severity,
                message: this.formatMessage(rule.message, { url: link, match: link, line }),
                file,
                line,
            });
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

    private static formatMessage(message: string, context: Record<string, unknown>): string {
        let fmt = message;
        for (const [key, value] of Object.entries(context)) {
            fmt = fmt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
        return fmt;
    }
}
