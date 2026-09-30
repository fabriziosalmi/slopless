import * as fs from 'fs';
import { Rule } from '../engine/schema';
import { isExcludedFile } from '../engine/file-scope';
import { extractProtectedRanges, scopeAt, supportsProtectedRanges, ProtectedRange, isDocComment, markFileHeader } from '../engine/ast-utils';
import { protectedRangesFor, supportsTokenizing } from '../engine/tokenize';
import { testRegionsFor, isInTestRegion } from '../engine/test-regions';
import { isMarkdown, markdownCodeSpans, isInSpans, Span } from '../engine/markdown';
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
        // The same, for the code a Markdown file quotes rather than contains.
        let cachedCode: Span[] | null = null;
        const markdownCode = () => cachedCode ??= markdownCodeSpans(content);
        const markdown = isMarkdown(ext);

        // Suppresses the same rule reporting twice for one line, which happens
        // whenever a global regex has several alternatives that all hit.
        const seen = new Set<string>();

        // A file that starts with a shebang is run directly, and what it
        // prints is its interface rather than a debugging leftover. The
        // advice to "use a logging library" is wrong for a program whose
        // output is a report.
        const isProgram = content.startsWith('#!');

        // A rule's own `tests:` block is examples, by construction: the `fire`
        // list exists because those lines must be reported. Reading them as code
        // means every rule finds the fixtures of every other one — VBC-001 read
        // its own four `fire` examples as four hardcoded credentials. This holds
        // for custom rule directories too, which is why it looks at the shape of
        // the file rather than at its path.
        const fixturesFrom = fixtureOffset(file, content);

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
                if (rule.match.exclude_programs && isProgram) continue;
                if (rule.match.exclude_commented && hasScopes && isCommented(ranges, index, match)) continue;
                if (rule.match.exclude_markdown_code && markdown
                    && isInSpans(markdownCode(), match.start)) continue;
                if (fixturesFrom >= 0 && match.start >= fixturesFrom) continue;

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

/**
 * Where a slopless rule file's examples begin, or -1 when the file is not one.
 *
 * A rule is recognised by its shape rather than by living in `rules/`, so a
 * project's own `customRulesPaths` get the same treatment.
 */
function fixtureOffset(file: string, content: string): number {
    if (!/\.ya?ml$/i.test(file)) return -1;
    const looksLikeARule = /^id:\s*\S/m.test(content)
        && /^name:\s*\S/m.test(content)
        && /^match:\s*$/m.test(content);
    if (!looksLikeARule) return -1;
    const tests = content.match(/^tests:\s*$/m);
    return tests?.index ?? -1;
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
    // From the first character that is not whitespace: a pattern anchored to the
    // line start begins on the indentation, which is outside the comment it is
    // about, and the whole match was then read as code.
    const lead = match.text.search(/\S/);
    const scope = scopeAt(ranges, match.start + (lead < 0 ? 0 : lead));
    // A match that starts inside a literal and runs out of it is not in it: one
    // that began at a regex and ended in the template beside it was reported as
    // a complex regular expression. Whitespace is allowed to fall outside,
    // because a run of comment lines is several ranges with newlines between.
    if (scope !== 'code' && !staysInScope(ranges, match, scope)) return false;
    if (scan === 'strings') return scope === 'string';
    if (scan === 'comments') return scope === 'comment';
    if (scan === 'regex') return scope === 'regex';
    return scope === 'code'; // default
}

/**
 * Maps every line of a stylesheet to the selector of the block that encloses it,
 * so a rule can say "cursor: pointer is fine, but not on a plain div".
 */
/**
 * For each line, the selector it sits under and the at-rules around that selector.
 *
 * The second is what lets a rule say where something is allowed: `!important` inside
 * `@media (prefers-reduced-motion: reduce)` is the accessibility pattern, because
 * the override has to beat every component's own animation, and the innermost
 * selector there is just `*`.
 */
interface CssContext { selectors: string[]; atRules: string[]; }

function buildSelectorMap(lines: string[]): CssContext {
    const map: string[] = new Array(lines.length).fill('');
    const atRules: string[] = new Array(lines.length).fill('');
    const stack: string[] = [];
    const chain = () => stack.filter(entry => entry.startsWith('@')).join(' ');
    let pending = '';
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        map[i] = stack[stack.length - 1] || '';
        atRules[i] = chain();
        for (const char of line) {
            if (char === '{') {
                stack.push(pending.trim());
                pending = '';
                map[i] = stack[stack.length - 1];
                atRules[i] = chain();
            } else if (char === '}') {
                stack.pop();
                pending = '';
            } else {
                pending += char;
            }
        }
        if (stack.length === 0) pending = '';
    }
    return { selectors: map, atRules };
}

/**
 * A pattern starting with `@` names an at-rule around the declaration and is
 * looked for, case-insensitively, in the chain of them: `@media print`,
 * `@media (prefers-reduced-motion`. Every other pattern is a selector, as before.
 * Nothing that existed started with `@`, so nothing that existed changes.
 */
function patternsMatch(context: CssContext, line: number, patterns: string[]): boolean {
    const atRules = (context.atRules[line - 1] || '').toLowerCase();
    const fromAtRule = patterns.filter(p => p.startsWith('@'))
        .some(p => atRules.includes(p.toLowerCase()));
    const selectorPatterns = patterns.filter(p => !p.startsWith('@'));
    const fromSelector = selectorPatterns.length > 0
        && selectorMatches(context.selectors[line - 1], selectorPatterns);
    return fromAtRule || fromSelector;
}

function isExcludedSelector(context: CssContext, line: number, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) return false;
    return patternsMatch(context, line, patterns);
}

// The mirror of exclude_selectors: a rule about focus has nothing to say inside a
// block that describes something which can never take focus. A line with no
// selector above it is not in a block at all, so it cannot satisfy a requirement.
function lacksRequiredSelector(context: CssContext, line: number, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) return false;
    return !patternsMatch(context, line, patterns);
}

/**
 * Whether the match has an explanation beside it: a comment at the end of its line,
 * or a comment line directly above, skipping blank ones.
 *
 * Only the line above is looked at. A comment three lines up belongs to whatever is
 * between, and calling it an explanation would excuse the rule it was written for.
 */
function isCommented(ranges: ProtectedRange[], index: LineIndex, match: RawMatch): boolean {
    const line = lineOfOffset(index, match.start) - 1;
    const lineEnd = index.offsets[line] + index.lines[line].length;
    const matchEnd = match.start + match.text.length;
    if (ranges.some(r => r.type === 'comment' && r.start >= matchEnd && r.start < lineEnd)) return true;

    for (let above = line - 1; above >= 0; above--) {
        const first = index.lines[above].search(/\S/);
        if (first < 0) continue;
        // The line above has to BE a comment: its first character, not its last.
        // `.replace(/<!--/g, '') // strips comments` ends in a comment and explains
        // itself, not the regex on the next line of the chain.
        return scopeAt(ranges, index.offsets[above] + first) === 'comment';
    }
    return false;
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

function staysInScope(ranges: ProtectedRange[], match: RawMatch,
    scope: ReturnType<typeof scopeAt>): boolean {
    const end = match.start + match.text.length;
    const covering = ranges.filter(r => r.start < end && r.end > match.start);
    for (let i = 0; i < match.text.length; i++) {
        if (/\s/.test(match.text[i])) continue;
        const at = match.start + i;
        const range = covering.find(r => at >= r.start && at < r.end);
        if (!range || (range.pattern ? 'regex' : range.type) !== scope) return false;
    }
    return true;
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
