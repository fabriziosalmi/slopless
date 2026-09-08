import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { formatJson, formatSarif, toolVersion } from '../engine/formatters';
import { Violation } from '../checkers/regex-checker';

const RULES_DIR = path.join(__dirname, '..', '..', 'rules');

const violation = (over: Partial<Violation> = {}): Violation => ({
    ruleId: 'VBC-005',
    name: 'use-var',
    severity: 'error',
    message: "Use of 'var' detected at line 2. Use 'let' or 'const' instead.",
    file: 'src/a.ts',
    line: 2,
    ...over,
});

describe('formatJson', () => {
    it('is an array a consumer can parse, with the fields it reports on', () => {
        const parsed = JSON.parse(formatJson([violation()]));
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed[0]).toMatchObject({
            ruleId: 'VBC-005', name: 'use-var', severity: 'error', file: 'src/a.ts', line: 2,
        });
    });

    it('is an empty array, not empty output, when nothing was found', () => {
        expect(JSON.parse(formatJson([]))).toEqual([]);
    });

    it('carries no source text, so a secret finding cannot travel in the report', () => {
        expect(Object.keys(violation())).not.toContain('snippet');
        expect(formatJson([violation()])).not.toContain('var x');
    });
});

describe('formatSarif', () => {
    const parse = (violations: Violation[]) => JSON.parse(formatSarif(violations, [RULES_DIR]));

    it('produces one run against the 2.1.0 schema', () => {
        const sarif = parse([violation()]);
        expect(sarif.version).toBe('2.1.0');
        expect(sarif.runs).toHaveLength(1);
    });

    it('names the version that produced it rather than a literal', () => {
        // It read 1.0.0 for sixteen releases, so a report in a security tab
        // could not be traced to the rules that made it.
        expect(parse([]).runs[0].tool.driver.version).toBe(toolVersion());
        expect(toolVersion()).toBe(require('../../package.json').version);
    });

    it('maps severity onto SARIF levels', () => {
        const results = parse([
            violation(),
            violation({ ruleId: 'VBC-018', severity: 'warning', line: 7 }),
        ]).runs[0].results;
        expect(results.map((r: { level: string }) => r.level)).toEqual(['error', 'warning']);
    });

    it('reports a location code scanning can anchor to', () => {
        const region = parse([violation()]).runs[0].results[0]
            .locations[0].physicalLocation;
        expect(region.artifactLocation.uri).toBe('src/a.ts');
        expect(region.region.startLine).toBe(2);
    });

    it('never emits line 0, which SARIF rejects', () => {
        const region = parse([violation({ line: 0 })]).runs[0].results[0]
            .locations[0].physicalLocation.region;
        expect(region.startLine).toBe(1);
    });

    it('declares every rule that could have fired, not only the ones that did', () => {
        const rules = parse([]).runs[0].tool.driver.rules;
        expect(rules.length).toBeGreaterThan(100);
        expect(rules.find((r: { id: string }) => r.id === 'VBC-005')).toMatchObject({
            name: 'use-var',
        });
    });
});
