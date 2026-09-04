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
        const notice =
            /(?:©|\(c\)|copyright)\s*((?:19|20)\d{2})(?:\s*[-–—]\s*((?:19|20)?\d{2}|present|\$?\{|<%))?/gi;

        content.split('\n').forEach((text, index) => {
            for (const match of text.matchAll(notice)) {
                const [, startYear, endYear] = match;
                // A range whose end is computed cannot go stale. `2025-{new Date().getFullYear()}`
                // is the thing the message asks for, so reporting it would be reporting the fix.
                if (endYear && (/present/i.test(endYear) || /^(?:\$?\{|<%)/.test(endYear))) continue;
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
            if (await this.checkLink(link) !== 'broken') continue;
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

    /**
     * Whether the link is definitely broken. A timeout is not evidence of that:
     * it says the server was slow, or the runner was, or a rate limit was hit.
     * Reporting it anyway made this rule non-deterministic — three identical runs
     * over one repository gave 1, 4 and 4 findings — and every one of those
     * findings claimed something the check had not established.
     */
    private static async checkLink(url: string): Promise<'broken' | 'ok' | 'unknown'> {
        for (const method of ['HEAD', 'GET'] as const) {
            try {
                const response = await fetch(url, { method, signal: AbortSignal.timeout(5000) });
                // Some servers refuse HEAD; a GET decides it.
                if (response.ok) return 'ok';
                // 404 and 410 are the only answers that mean the page is not there.
                // 403 and 429 mean the server declined to talk to a script, and 5xx
                // means it was having a bad minute; neither is a broken link.
                if (method === 'GET') {
                    return response.status === 404 || response.status === 410 ? 'broken' : 'unknown';
                }
            } catch (error) {
                // DNS answering "no such host" is a definite answer and worth
                // reporting; a timeout or a reset is the network being the
                // network, and says nothing about the link.
                if (this.isUnknownHost(error)) return 'broken';
                // Otherwise fall through to GET, then give up without claiming
                // anything.
            }
        }
        return 'unknown';
    }

    private static isUnknownHost(error: unknown): boolean {
        const code = (error as { cause?: { code?: string } })?.cause?.code;
        return code === 'ENOTFOUND' || code === 'EAI_AGAIN';
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
