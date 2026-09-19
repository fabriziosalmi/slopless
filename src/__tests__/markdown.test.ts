import { describe, it, expect } from 'vitest';
import { isInSpans, isMarkdown, markdownCodeSpans } from '../engine/markdown';

/** The text each span covers, which is easier to read than offsets. */
const covered = (source: string) =>
    markdownCodeSpans(source).map(span => source.slice(span.start, span.end));

const inCode = (source: string, needle: string) =>
    isInSpans(markdownCodeSpans(source), source.indexOf(needle));

describe('markdownCodeSpans — code spans', () => {
    it('finds a single-backtick span', () => {
        expect(covered('see `[a](b.md)` here')).toEqual(['`[a](b.md)`']);
    });

    it('pairs a run only with a run of the same length', () => {
        // The single backtick inside is content, not a closer.
        expect(covered('x ``a ` b`` y')).toEqual(['``a ` b``']);
    });

    it('treats an unmatched run as literal text', () => {
        const source = 'one ` two [a](b.md) three';
        expect(covered(source)).toEqual([]);
        expect(inCode(source, '[a]')).toBe(false);
    });

    it('does not let a span cross a blank line', () => {
        // Pairing across paragraphs would swallow the real link between them.
        const source = 'first `open\n\nreal [a](b.md)\n\nclose` last';
        expect(inCode(source, '[a]')).toBe(false);
    });

    it('ignores an escaped backtick', () => {
        expect(covered('a \\`not [x](y.md) code` z')).toEqual([]);
    });
});

describe('markdownCodeSpans — fenced blocks', () => {
    it('covers a backtick fence and everything inside it', () => {
        const source = 'before\n```markdown\n[guide](guide.md)\n```\nafter [a](b.md)\n';
        expect(inCode(source, '[guide]')).toBe(true);
        expect(inCode(source, '[a]')).toBe(false);
    });

    it('covers a tilde fence', () => {
        expect(inCode('~~~\n[g](g.md)\n~~~\n', '[g]')).toBe(true);
    });

    it('closes only on the same character, at least as long', () => {
        const source = '````\n```\n[g](g.md)\n````\nout [a](b.md)\n';
        expect(inCode(source, '[g]')).toBe(true);
        expect(inCode(source, '[a]')).toBe(false);
    });

    it('runs an unclosed fence to the end, as CommonMark does', () => {
        expect(inCode('```\n[g](g.md)\nmore\n', '[g]')).toBe(true);
    });

    it('does not pair backticks inside a fence with prose outside it', () => {
        const source = '```\na ` b\n```\nreal `code` and [a](b.md)\n';
        expect(inCode(source, 'code')).toBe(true);
        expect(inCode(source, '[a]')).toBe(false);
    });

    it('accepts up to three spaces of indentation, not four', () => {
        expect(inCode('   ```\n[g](g.md)\n   ```\n', '[g]')).toBe(true);
        // Four spaces is an indented code block or a list continuation, which
        // this deliberately does not try to decide, so it is left as prose.
        expect(inCode('    ```\n[g](g.md)\n', '[g]')).toBe(false);
    });
});

describe('markdownCodeSpans — cost', () => {
    it('stays linear on a paragraph of unmatched backticks', () => {
        // Every run a different length, so nothing ever pairs: the input that
        // makes a search-ahead-from-each-opener version quadratic.
        const lengths = Array.from({ length: 2000 }, (_, i) => '`'.repeat((i % 50) + 1));
        const hostile = lengths.join(' x ');

        const started = process.hrtime.bigint();
        markdownCodeSpans(hostile);
        const ms = Number(process.hrtime.bigint() - started) / 1e6;

        // Generous: it runs in a few milliseconds. The point is the order of
        // magnitude, not the number.
        expect(ms).toBeLessThan(500);
    });
});

describe('isMarkdown', () => {
    it('knows the Markdown extensions and nothing else', () => {
        for (const ext of ['md', 'MD', 'markdown', 'mdx']) expect(isMarkdown(ext), ext).toBe(true);
        // A template literal in TypeScript is not a code span.
        for (const ext of ['ts', 'js', 'txt']) expect(isMarkdown(ext), ext).toBe(false);
    });
});
