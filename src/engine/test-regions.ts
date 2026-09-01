import { ProtectedRange } from './ast-utils';
import { protectedRangesFor } from './tokenize';
import { extractProtectedRanges, supportsProtectedRanges } from './ast-utils';

// Some languages keep their tests inside the file they test. Rust is the reason
// this exists: 154 files in the corpus I measured carry a `#[cfg(test)] mod
// tests`, and `exclude_files` cannot see any of them, because there is no
// separate file to exclude. A magic boolean in an assertion is how you write an
// assertion, and reporting it is how a rule teaches people to switch it off.

interface RegionSyntax {
    /** What opens a test region. Matched outside strings and comments. */
    starts: RegExp;
}

const SYNTAX: Record<string, RegionSyntax> = {
    // The attribute applies to whatever item follows it, usually `mod tests`.
    rs: { starts: /#\[cfg\(test\)\]/g },
    // A test file is excluded by path; this catches a suite left in a source file.
    ts: { starts: /\b(?:describe|suite)\s*\(/g },
};

const ALIASES: Record<string, string> = { tsx: 'ts', js: 'ts', jsx: 'ts', mjs: 'ts', cjs: 'ts' };

export function supportsTestRegions(ext: string): boolean {
    const key = ext.toLowerCase();
    return (ALIASES[key] ?? key) in SYNTAX;
}

/** The spans of a file that hold test code rather than the code under test. */
export function testRegionsFor(ext: string, source: string): ProtectedRange[] {
    const key = ext.toLowerCase();
    const syntax = SYNTAX[ALIASES[key] ?? key];
    if (!syntax) return [];

    const protectedRanges = supportsProtectedRanges(ext)
        ? extractProtectedRanges(source, true)
        : protectedRangesFor(ext, source);
    const inProtected = (offset: number) =>
        protectedRanges.some(r => offset >= r.start && offset < r.end);

    const regions: ProtectedRange[] = [];
    const starts = new RegExp(syntax.starts.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = starts.exec(source)) !== null) {
        if (inProtected(match.index)) continue;
        const end = endOfItem(source, match.index + match[0].length, inProtected);
        // A region already inside one adds nothing: nested describes, or an
        // attribute on an item inside a test module.
        if (regions.some(r => match!.index >= r.start && end <= r.end)) continue;
        regions.push({ start: match.index, end, type: 'comment' });
        starts.lastIndex = end;
    }
    return regions;
}

/**
 * The end of the item an attribute or call introduces: the close of its block,
 * or the end of the statement when it has none (`#[cfg(test)] use super::*;`).
 */
function endOfItem(source: string, from: number, inProtected: (offset: number) => boolean): number {
    let depth = 0;
    let seenBrace = false;
    for (let i = from; i < source.length; i++) {
        if (inProtected(i)) continue;
        const char = source[i];
        if (char === '{') {
            depth++;
            seenBrace = true;
        } else if (char === '}') {
            depth--;
            if (depth === 0) return i + 1;
        } else if (char === ';' && !seenBrace && depth === 0) {
            return i + 1;
        }
    }
    return source.length;
}

export function isInTestRegion(regions: ProtectedRange[], offset: number): boolean {
    return regions.some(region => offset >= region.start && offset < region.end);
}
