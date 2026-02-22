import * as ts from 'typescript';

export interface ProtectedRange {
    start: number;
    end: number;
}

/**
 * Scans a TypeScript/JavaScript file and returns absolute character ranges
 * for all strings and comments. This prevents regex-based false positives.
 */
export function extractProtectedRanges(content: string, isTsOrJs: boolean): ProtectedRange[] {
    if (!isTsOrJs) return [];

    const ranges: ProtectedRange[] = [];
    // Set skipTrivia to false so comments are detected
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false);
    scanner.setText(content);

    let token = scanner.scan();
    while (token !== ts.SyntaxKind.EndOfFileToken) {
        if (
            token === ts.SyntaxKind.SingleLineCommentTrivia ||
            token === ts.SyntaxKind.MultiLineCommentTrivia ||
            token === ts.SyntaxKind.StringLiteral ||
            token === ts.SyntaxKind.NoSubstitutionTemplateLiteral ||
            token === ts.SyntaxKind.TemplateHead ||
            token === ts.SyntaxKind.TemplateMiddle ||
            token === ts.SyntaxKind.TemplateTail ||
            token === ts.SyntaxKind.RegularExpressionLiteral
        ) {
            ranges.push({
                start: scanner.getTokenPos(),
                end: scanner.getTextPos()
            });
        }
        token = scanner.scan();
    }

    return ranges;
}
