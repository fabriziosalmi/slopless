import * as path from 'path';
import { Violation } from '../checkers/regex-checker';
import { RuleLoader } from './loader';

export function formatJson(violations: Violation[]): string {
    return JSON.stringify(violations, null, 2);
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
                        version: "1.0.0",
                        rules: sarifRules
                    }
                },
                results: results
            }
        ]
    };

    return JSON.stringify(sarif, null, 2);
}
