import * as ts from 'typescript';

export interface ProtectedRange {
    start: number;
    end: number;
    type: 'comment' | 'string';
}

const TS_JS_EXTENSIONS = new Set(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs']);

export function supportsProtectedRanges(ext: string): boolean {
    return TS_JS_EXTENSIONS.has(ext.toLowerCase());
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

    let token = scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
        token = advanceTemplateState(scanner, token, templateBraceDepths, () => braceDepth,
            (delta) => { braceDepth += delta; });

        if (isCommentToken(token) || isStringToken(token)) {
            ranges.push({
                start: scanner.getTokenPos(),
                end: scanner.getTextPos(),
                type: isCommentToken(token) ? 'comment' : 'string',
            });
        }
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
export function scopeAt(ranges: ProtectedRange[], offset: number): 'code' | 'string' | 'comment' {
    for (const range of ranges) {
        if (offset >= range.start && offset < range.end) return range.type;
    }
    return 'code';
}
