import { describe, it, expect } from 'vitest';
import { isGeneratedFile } from '../engine/generated';

describe('isGeneratedFile', () => {
    // Measured on real files: hand-written source runs 25 to 50 bytes per line,
    // minified output runs into the thousands. Nothing sits between them.
    it('recognises a minified bundle by the length of its lines', () => {
        const minified = 'var a=1,b=2;'.repeat(400); // one line, ~4800 chars
        expect(isGeneratedFile('bundle.js', minified)).toBe(true);
    });

    it('recognises minified CSS with no filename hint', () => {
        const css = '.a{color:red}'.repeat(300);
        expect(isGeneratedFile('styles.css', css)).toBe(true);
    });

    it('leaves ordinary source alone', () => {
        const source = Array.from({ length: 200 },
            (_, i) => `const value${i} = compute(${i});`).join('\n');
        expect(isGeneratedFile('app.ts', source)).toBe(false);
    });

    it('leaves prose alone', () => {
        const markdown = Array.from({ length: 80 },
            () => 'A sentence of ordinary documentation prose that wraps at eighty.').join('\n');
        expect(isGeneratedFile('README.md', markdown)).toBe(false);
    });

    it('does not trip on one long line in an otherwise normal file', () => {
        const source = Array.from({ length: 300 }, () => 'const x = 1;').join('\n')
            + '\n// ' + 'a'.repeat(900);
        expect(isGeneratedFile('app.ts', source)).toBe(false);
    });

    it('handles an empty file', () => {
        expect(isGeneratedFile('empty.ts', '')).toBe(false);
    });
});
