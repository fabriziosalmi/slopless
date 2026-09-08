import * as path from 'path';
import { Violation } from '../checkers/regex-checker';
import { RuleLoader } from './loader';

export function formatJson(violations: Violation[]): string {
    return JSON.stringify(violations, null, 2);
}

/** The running version, for a report that has to be traceable to what made it. */
export function toolVersion(): string {
    try {
        return require('../../package.json').version as string;
    } catch {
        // Bundled somewhere the manifest did not follow. A report is still worth
        // producing; saying nothing about the version is better than a wrong one.
        return '0.0.0';
    }
}

export function formatSarif(violations: Violation[], rulesDirs: string[]): string {
    const rules = RuleLoader.loadRules(rulesDirs);

    const sarifRules = rules.map(r => ({
        id: r.id,
        name: r.name,
        shortDescription: { text: r.name },
        fullDescription: { text: r.message },
        helpUri: r.docs_url || `https://github.com/fabriziosalmi/slopless/blob/main/docs/rules/${r.id}.md`,
        properties: {
            tags: r.tags || [],
            category: (r as any).category
        }
    }));

    const results = violations.map(v => ({
        ruleId: v.ruleId,
        level: v.severity === 'error' ? 'error' : 'warning',
        message: { text: v.message },
        locations: [
            {
                physicalLocation: {
                    artifactLocation: { uri: v.file },
                    region: {
                        startLine: v.line > 0 ? v.line : 1,
                        startColumn: 1
                    }
                }
            }
        ]
    }));

    const sarif = {
        version: "2.1.0",
        $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        runs: [
            {
                tool: {
                    driver: {
                        name: "Slopless",
                        informationUri: "https://github.com/fabriziosalmi/slopless",
                        // The version that produced the report, not a literal.
                        // It said 1.0.0 for sixteen releases, so a SARIF file in
                        // a security tab named no version anyone could act on.
                        version: toolVersion(),
                        rules: sarifRules
                    }
                },
                results: results
            }
        ]
    };

    return JSON.stringify(sarif, null, 2);
}
