import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { isExcludedFile } from '../engine/file-scope';
import { extractProtectedRanges, scopeAt, supportsProtectedRanges, ProtectedRange, isDocComment, markFileHeader } from '../engine/ast-utils';
import { protectedRangesFor, supportsTokenizing } from '../engine/tokenize';
import { testRegionsFor, isInTestRegion } from '../engine/test-regions';
import { VocabularyState, excuses } from '../engine/vocabulary';

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

const CSS_EXTENSIONS = new Set(['css', 'scss', 'less']);

interface LineIndex {
    /** Byte offset at which each line starts. */
    offsets: number[];
    lines: string[];
}

export class RegexChecker {
    static check(file: string, rules: Rule[], rawContent?: string,
        vocabulary: VocabularyState | null = null): Violation[] {
        const violations: Violation[] = [];
        const content = rawContent !== undefined ? rawContent : fs.readFileSync(file, 'utf8');
        const index = buildLineIndex(content);

        const ext = (file.split('.').pop() || '').toLowerCase();
        // The TypeScript scanner where it can read the file, a declarative
        // tokeniser everywhere else. Without one of the two, `scan:` is ignored
        // and every rule reads comments and string literals as if they were code.
        const hasScopes = supportsProtectedRanges(ext) || supportsTokenizing(ext);
        const ranges = markFileHeader(supportsProtectedRanges(ext)
            ? extractProtectedRanges(content, true)
            : protectedRangesFor(ext, content), content);
        const selectors = CSS_EXTENSIONS.has(ext) ? buildSelectorMap(index.lines) : null;

        // Only computed if a rule asks, since it means walking the file again.
        let cachedRegions: ProtectedRange[] | null = null;
        const testRegions = () => cachedRegions ??= testRegionsFor(ext, content);

        // Suppresses the same rule reporting twice for one line, which happens
        // whenever a global regex has several alternatives that all hit.
        const seen = new Set<string>();

        for (const baseRule of rules) {
            const rule = resolveVariant(baseRule, ext);
            if (!rule || !rule.match.regex) continue;
            if (rule.match.file_types && !rule.match.file_types.includes(ext)) continue;
            if (isExcludedFile(file, rule)) continue;

            const regex = compileRegex(rule);
            if (!regex) continue;

            for (const match of iterateMatches(regex, content, index, rule.match.multiline === true)) {
                if (hasScopes && !isInScope(ranges, match, rule.match.scan)) continue;

                const line = lineOfOffset(index, match.start);
                if (selectors && isExcludedSelector(selectors, line, rule.match.exclude_selectors)) continue;
                if (selectors && lacksRequiredSelector(selectors, line, rule.match.require_selectors)) continue;
                if (rule.match.exclude_doc_comments && isDocComment(ranges, match.start)) continue;
                if (rule.match.exclude_test_code && isInTestRegion(testRegions(), match.start)) continue;

                const key = `${rule.id}:${line}`;
                if (seen.has(key)) continue;
                // The line is spoken for either way. Excusing without marking it
                // counted two claimed words on one line as two findings.
                seen.add(key);
                if (excuses(vocabulary, match.text)) continue;

                violations.push({
                    ruleId: rule.id,
                    name: rule.name,
                    severity: rule.severity,
                    message: formatMessage(rule.message, {
                        line,
                        match: firstLineOf(match.text),
                        count: index.lines[line - 1]?.length ?? match.text.length,
                    }),
                    file,
                    line,
                    fix: rule.fix?.regex_replace ? {
                        pattern: rule.fix.regex_replace.pattern,
                        replacement: rule.fix.regex_replace.replacement
                    } : undefined
                });
            }
        }

        return violations;
    }
}

/**
 * The form of a rule that applies to this extension. A variant replaces the
 * pattern and what it says, and inherits everything else the rule declares:
 * one concept, one id, one documentation page, several spellings.
 */
export function resolveVariant(rule: Rule, ext: string): Rule | null {
    const variants = rule.match.variants;
    if (!variants || variants.length === 0) return rule;
    const variant = variants.find(v => v.file_types.includes(ext));
    if (!variant) {
        // The base pattern still applies where the rule declares it does.
        return rule.match.regex ? rule : null;
    }
    return {
        ...rule,
        message: variant.message ?? rule.message,
        match: {
            ...rule.match,
            regex: variant.regex,
            flags: variant.flags ?? rule.match.flags,
            scan: variant.scan ?? rule.match.scan,
            multiline: variant.multiline ?? rule.match.multiline,
            file_types: variant.file_types,
        },
    };
}

function compileRegex(rule: Rule): RegExp | null {
    const declared = rule.match.flags || '';
    const flags = declared.includes('g') ? declared : declared + 'g';
    try {
        return new RegExp(rule.match.regex as string, flags);
    } catch {
        console.warn(`Rule ${rule.id} has an invalid regex and was skipped.`);
        return null;
    }
}

interface RawMatch { start: number; text: string; }

function* iterateMatches(regex: RegExp, content: string, index: LineIndex, multiline: boolean): Generator<RawMatch> {
    if (multiline) {
        yield* execAll(regex, content, 0);
        return;
    }
    for (let i = 0; i < index.lines.length; i++) {
        yield* execAll(regex, index.lines[i], index.offsets[i]);
    }
}

function* execAll(regex: RegExp, text: string, baseOffset: number): Generator<RawMatch> {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        yield { start: baseOffset + match.index, text: match[0] };
        // A zero-length match would spin forever on a global regex.
        if (match[0].length === 0) regex.lastIndex++;
    }
    regex.lastIndex = 0;
}

function buildLineIndex(content: string): LineIndex {
    const lines = content.split('\n');
    const offsets: number[] = new Array(lines.length);
    let offset = 0;
    for (let i = 0; i < lines.length; i++) {
        offsets[i] = offset;
        offset += lines[i].length + 1; // +1 for the newline
    }
    return { offsets, lines };
}

function lineOfOffset(index: LineIndex, offset: number): number {
    let low = 0;
    let high = index.offsets.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (index.offsets[mid] <= offset) low = mid; else high = mid - 1;
    }
    return low + 1;
}

function isInScope(ranges: ProtectedRange[], match: RawMatch, scan: Rule['match']['scan']): boolean {
    if (scan === 'all') return true;
    const scope = scopeAt(ranges, match.start);
    // A match that starts inside a literal and runs out of it is not in it. One
    // that began at a regex and ended in the template beside it was reported as
    // a complex regular expression.
    if (scope !== 'code' && !endsInSameRange(ranges, match)) return false;
    if (scan === 'strings') return scope === 'string';
    if (scan === 'comments') return scope === 'comment';
    if (scan === 'regex') return scope === 'regex';
    return scope === 'code'; // default
}

/**
 * Maps every line of a stylesheet to the selector of the block that encloses it,
 * so a rule can say "cursor: pointer is fine, but not on a plain div".
 */
function buildSelectorMap(lines: string[]): string[] {
    const map: string[] = new Array(lines.length).fill('');
    const stack: string[] = [];
    let pending = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        map[i] = stack[stack.length - 1] || '';
        for (const char of line) {
            if (char === '{') {
                stack.push(pending.trim());
                pending = '';
                map[i] = stack[stack.length - 1];
            } else if (char === '}') {
                stack.pop();
                pending = '';
            } else {
                pending += char;
            }
        }
        if (stack.length === 0) pending = '';
    }
    return map;
}

function isExcludedSelector(selectors: string[], line: number, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) return false;
    return selectorMatches(selectors[line - 1], patterns);
}

// The mirror of exclude_selectors: a rule about focus has nothing to say inside a
// block that describes something which can never take focus. A line with no
// selector above it is not in a block at all, so it cannot satisfy a requirement.
function lacksRequiredSelector(selectors: string[], line: number, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) return false;
    return !selectorMatches(selectors[line - 1], patterns);
}

function selectorMatches(selector: string | undefined, patterns: string[]): boolean {
    const target = (selector || '').toLowerCase();
    if (!target) return false;
    const tokens = target.split(/[\s,>+~]+/).filter(Boolean);
    return patterns.some(pattern => {
        const needle = pattern.toLowerCase();
        // A qualifier is a fragment of a token, not a token: `:focus` has to find
        // `.editor:focus-visible`, which starts with neither a colon nor `.editor`.
        if (/^[:[]/.test(needle)) return tokens.some(token => token.includes(needle));
        // A bare tag name must match the whole token or the part before a
        // qualifier, so `a` matches `a:hover` but never `.accordion`.
        return tokens.some(token => token === needle
            || (token.startsWith(needle) && /[:.[#]/.test(token.charAt(needle.length))));
    });
}

function endsInSameRange(ranges: ProtectedRange[], match: RawMatch): boolean {
    const end = match.start + match.text.length;
    return ranges.some(r => match.start >= r.start && end <= r.end);
}

function firstLineOf(text: string): string {
    const newline = text.indexOf('\n');
    return newline === -1 ? text : text.slice(0, newline) + '…';
}

function formatMessage(message: string, context: Record<string, unknown>): string {
    let fmt = message;
    for (const [key, value] of Object.entries(context)) {
        fmt = fmt.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return fmt;
}
