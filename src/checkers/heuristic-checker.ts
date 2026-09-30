import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';
import { isExcludedFile } from '../engine/file-scope';
import { LinkVerifier, linkVerifier } from '../engine/link-verifier';

export class HeuristicChecker {
    static async check(file: string, rules: Rule[], rawContent?: string,
        links: LinkVerifier = linkVerifier): Promise<Violation[]> {
        const violations: Violation[] = [];
        const content = rawContent !== undefined ? rawContent : fs.readFileSync(file, 'utf8');

        for (const rule of rules) {
            if (isExcludedFile(file, rule)) continue;
            if (rule.match.heuristic_check === 'link-checker' && file.endsWith('.md')) {
                violations.push(...await this.findBrokenLinks(file, content, rule, links));
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

    private static async findBrokenLinks(file: string, content: string, rule: Rule,
        links: LinkVerifier): Promise<Violation[]> {
        const found = this.extractLinks(content);
        // Each URL is asked about once however often it appears; each appearance
        // is still reported on its own line, which it was not before — every
        // repeat of a broken link used to be pinned to the first one.
        const outcomes = await links.verify(found.map(link => link.url));

        const violations: Violation[] = [];
        for (const { url, offset } of found) {
            if (outcomes.get(url) !== 'broken') continue;
            const line = content.slice(0, offset).split('\n').length;
            violations.push({
                ruleId: rule.id,
                name: rule.name,
                severity: rule.severity,
                message: this.formatMessage(rule.message, { url, match: url, line }),
                file,
                line,
            });
        }
        return violations;
    }

    private static extractLinks(content: string): { url: string; offset: number }[] {
        const regex = /\[.*?\]\((https?:\/\/.*?)\)/g;
        const links: { url: string; offset: number }[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            links.push({ url: match[1], offset: match.index });
        }
        return links;
    }

    private static formatMessage(message: string, context: Record<string, unknown>): string {
        let fmt = message;
        for (const [key, value] of Object.entries(context)) {
            fmt = fmt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
        }
        return fmt;
    }
}
