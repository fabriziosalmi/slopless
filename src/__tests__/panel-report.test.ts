import { describe, it, expect } from 'vitest';
import {
    commentSyntax, findingBlock, plural, report, suppression, REPORT_LIMIT,
    type Finding,
} from '../../packages/vscode-slopless/client/src/report';

const finding = (over: Partial<Finding> = {}): Finding => ({
    ruleId: 'VBC-005',
    name: 'use-var',
    severity: 'error',
    message: "Use of 'var' detected at line 2. Use 'let' or 'const' instead.",
    line: 2,
    ...over,
});

describe('commentSyntax', () => {
    it('knows the line comment for the languages that have one', () => {
        for (const file of ['a.ts', 'a.tsx', 'a.js', 'a.go', 'a.rs', 'a.swift', 'a.scss']) {
            expect(commentSyntax(file), file).toBe('//');
        }
        for (const file of ['a.py', 'a.sh', 'a.rb', 'a.yaml', 'a.yml']) {
            expect(commentSyntax(file), file).toBe('#');
        }
    });

    it('refuses to guess where a file has more than one', () => {
        // An `.astro` file is TypeScript between --- fences and then markup, and
        // a marker in the wrong syntax silences nothing while looking as if it does.
        expect(commentSyntax('page.astro')).toBeNull();
        expect(commentSyntax('README.md')).toBeNull();
        expect(commentSyntax('index.html')).toBeNull();
    });
});

describe('suppression', () => {
    it('matches the indentation of the line it will sit above', () => {
        expect(suppression('//', 'VBC-005', '        var x = 1;'))
            .toBe('        // slopless-disable-next-line VBC-005 -- ');
    });

    it('ends in the reason marker rather than a finished sentence', () => {
        // A suppression with no reason is the thing this tool complains about,
        // so the copied line stops where the reason starts.
        expect(suppression('#', 'VBC-001', 'x = 1')).toMatch(/ -- $/);
    });
});

describe('findingBlock', () => {
    const lines = ['one', 'var x = 1;', 'three', 'four', 'five'];

    it('marks the line and numbers the ones around it', () => {
        const block = findingBlock('src/a.ts', finding(), lines, 1);
        expect(block).toContain('src/a.ts:2');
        expect(block).toContain('> 2 | var x = 1;');
        expect(block).toContain('  1 | one');
        expect(block).toContain('  3 | three');
        expect(block).not.toContain('four');
    });

    it('does not run off either end of the file', () => {
        expect(() => findingBlock('a.ts', finding({ line: 1 }), lines, 5)).not.toThrow();
        expect(findingBlock('a.ts', finding({ line: 5 }), lines, 5)).toContain('> 5 | five');
    });
});

describe('report', () => {
    const files = [
        { path: 'src/a.ts', findings: [finding(), finding({ ruleId: 'VBC-018', name: 'console-logs-detected', severity: 'warning', line: 7 })] },
        { path: 'src/b.ts', findings: [finding({ ruleId: 'VBC-018', name: 'console-logs-detected', severity: 'warning', line: 3 })] },
    ];

    it('opens with the counts and says what they mean', () => {
        const text = report(files, 42, '1.16.0');
        expect(text.split('\n')[0]).toBe('# slopless 1.16.0: 1 error, 2 warnings');
        expect(text).toContain('out of 42 read');
        expect(text).toContain('Errors fail a build; warnings are reported and do not.');
    });

    it('counts by rule, commonest first', () => {
        const text = report(files, 42, '1.16.0');
        const byRule = text.slice(text.indexOf('## By rule'));
        expect(byRule).toContain('- 2 × VBC-018 console-logs-detected (warning)');
        expect(byRule.indexOf('VBC-018')).toBeLessThan(byRule.indexOf('VBC-005'));
    });

    it('lists each file with its findings in line order', () => {
        const text = report(files, 42, '1.16.0');
        expect(text).toContain('### src/a.ts');
        expect(text.indexOf('line 2 · VBC-005')).toBeLessThan(text.indexOf('line 7 · VBC-018'));
    });

    it('says what it left out rather than ending as though that was all', () => {
        const many = [{
            path: 'src/big.ts',
            findings: Array.from({ length: REPORT_LIMIT + 25 }, (_, i) => finding({ line: i + 1 })),
        }];
        const text = report(many, 1, '1.16.0');
        expect(text).toContain(`Stopped after ${REPORT_LIMIT} findings`);
        expect(text).toContain('25 more');
    });
});

describe('plural', () => {
    it('does not say 1 errors', () => {
        expect(plural(1, 'error')).toBe('1 error');
        expect(plural(0, 'error')).toBe('0 errors');
        expect(plural(2, 'warning')).toBe('2 warnings');
    });
});
