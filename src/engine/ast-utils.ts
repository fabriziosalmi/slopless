import * as ts from 'typescript';

export interface ProtectedRange {
    start: number;
    end: number;
    type: 'comment' | 'string';
    /**
     * A comment that documents the thing below it, rather than a note beside it.
     * Go requires one on every exported symbol and on the package; Rust writes
     * them with `///`. A rule about comment density that counts those is asking
     * a language to stop following its own convention.
     */
    doc?: true;
    /**
     * A regular expression literal. It is not a string literal: `/^https?:\/\//`
     * is a pattern that recognises a URL, not a URL. A rule about the values a
     * program carries should not read it, and a rule about patterns should read
     * nothing else.
     */
    pattern?: true;
}

const TS_JS_EXTENSIONS = new Set(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs']);

export function supportsProtectedRanges(ext: string): boolean {
    return TS_JS_EXTENSIONS.has(ext.toLowerCase());
}

// A slash divides what came before it only when there is a value to divide.
// After anything else — an operator, a keyword, an opening bracket, the start of
// the file — it opens a regular expression.
function canStartRegex(previous: ts.SyntaxKind | undefined): boolean {
    if (previous === undefined) return true;
    if (previous === ts.SyntaxKind.Identifier) return false;
    const isKeyword = previous >= ts.SyntaxKind.FirstKeyword && previous <= ts.SyntaxKind.LastKeyword;
    if (isKeyword) {
        // `return /x/` and `typeof /x/` are regexes; `this` and `super` are values.
        return previous !== ts.SyntaxKind.ThisKeyword && previous !== ts.SyntaxKind.SuperKeyword;
    }
    return ![
        ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.BigIntLiteral, ts.SyntaxKind.StringLiteral,
        ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateTail,
        ts.SyntaxKind.RegularExpressionLiteral,
        ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.CloseBracketToken, ts.SyntaxKind.CloseBraceToken,
        ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken,
    ].includes(previous);
}

function isTrivia(token: ts.SyntaxKind): boolean {
    return token === ts.SyntaxKind.WhitespaceTrivia
        || token === ts.SyntaxKind.NewLineTrivia
        || token === ts.SyntaxKind.ShebangTrivia;
}

function isStringToken(token: ts.SyntaxKind): boolean {
    return token === ts.SyntaxKind.StringLiteral
        || token === ts.SyntaxKind.NoSubstitutionTemplateLiteral
        || token === ts.SyntaxKind.TemplateHead
        || token === ts.SyntaxKind.TemplateMiddle
        || token === ts.SyntaxKind.TemplateTail
        || token === ts.SyntaxKind.RegularExpressionLiteral;
}

function isCommentToken(token: ts.SyntaxKind): boolean {
    return token === ts.SyntaxKind.SingleLineCommentTrivia
        || token === ts.SyntaxKind.MultiLineCommentTrivia;
}

/**
 * Scans a TypeScript/JavaScript file and returns absolute character ranges
 * for all strings and comments, so checkers can decide which scope a match
 * belongs to instead of guessing from raw text.
 */
export function extractProtectedRanges(content: string, isTsOrJs: boolean): ProtectedRange[] {
    if (!isTsOrJs) return [];

    const ranges: ProtectedRange[] = [];
    // Set skipTrivia to false so comments are detected
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
    scanner.setText(content);

    // Brace depth recorded when each `${` span was opened. Without re-scanning the
    // closing brace as a template token, the scanner reads the terminating backtick
    // as the start of a fresh literal and marks the rest of the file as a string.
    const templateBraceDepths: number[] = [];
    let braceDepth = 0;

    // The scanner reads `/` as division unless asked to reconsider, so the body of
    // a regex literal was being handed to the rules as code: `/(?:var|const)/`
    // reported a `var` this project does not contain.
    let previous: ts.SyntaxKind | undefined;

    let token = scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
        token = advanceTemplateState(scanner, token, templateBraceDepths, () => braceDepth,
            (delta) => { braceDepth += delta; });

        if ((token === ts.SyntaxKind.SlashToken || token === ts.SyntaxKind.SlashEqualsToken)
            && canStartRegex(previous)) {
            token = scanner.reScanSlashToken();
        }

        if (isCommentToken(token) || isStringToken(token)) {
            const start = scanner.getTokenPos();
            ranges.push({
                doc: content.startsWith('/**', start) ? true : undefined,
                pattern: token === ts.SyntaxKind.RegularExpressionLiteral ? true : undefined,
                start,
                end: scanner.getTextPos(),
                type: isCommentToken(token) ? 'comment' : 'string',
            });
        }
        // The scanner is set to report trivia, so the token before a slash was
        // usually a space. `(a + b) / 1000` was read as a regular expression and
        // swallowed the rest of the file.
        if (!isCommentToken(token) && !isTrivia(token)) previous = token;
        token = scanner.scan();
    }

    return ranges;
}

function advanceTemplateState(
    scanner: ts.Scanner,
    token: ts.SyntaxKind,
    templateBraceDepths: number[],
    getDepth: () => number,
    addDepth: (delta: number) => void,
): ts.SyntaxKind {
    if (token === ts.SyntaxKind.OpenBraceToken) {
        addDepth(1);
    } else if (token === ts.SyntaxKind.CloseBraceToken) {
        if (templateBraceDepths[templateBraceDepths.length - 1] === getDepth()) {
            const rescanned = scanner.reScanTemplateToken(false);
            if (rescanned === ts.SyntaxKind.TemplateTail) templateBraceDepths.pop();
            return rescanned;
        }
        addDepth(-1);
    }
    if (token === ts.SyntaxKind.TemplateHead) {
        templateBraceDepths.push(getDepth());
    }
    return token;
}

/** Returns the scope a character offset falls into. */
export function scopeAt(ranges: ProtectedRange[], offset: number): 'code' | 'string' | 'comment' | 'regex' {
    for (const range of ranges) {
        if (offset >= range.start && offset < range.end) {
            return range.pattern ? 'regex' : range.type;
        }
    }
    return 'code';
}

/** Whether this offset falls inside a comment that documents a declaration. */
export function isDocComment(ranges: ProtectedRange[], offset: number): boolean {
    return ranges.some(r => r.doc === true && offset >= r.start && offset < r.end);
}

/**
 * Marks the comments at the top of a file as documentation. Everything above the
 * first line of code is a header: a licence, a module banner, a package comment.
 * A rule about how much commentary a file carries should not count the part that
 * explains what the file is.
 */
export function markFileHeader(ranges: ProtectedRange[], source: string): ProtectedRange[] {
    let cursor = 0;
    for (const range of ranges) {
        if (source.slice(cursor, range.start).trim() !== '') break;
        if (range.type !== 'comment') break;
        range.doc = true;
        cursor = range.end;
    }
    return ranges;
}
