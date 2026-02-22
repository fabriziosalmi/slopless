import { loadConfig, SloplessConfig } from './config';
import { RuleLoader } from './loader';
import { RegexChecker, Violation } from '../checkers/regex-checker';
import { AstChecker } from '../checkers/ast-checker';
import { HeuristicChecker } from '../checkers/heuristic-checker';
import { SemanticChecker } from '../checkers/semantic-checker';
import { TypeCheckerEngine } from '../checkers/type-checker';
import * as path from 'path';
import * as ts from 'typescript';

const RULES_DIR = path.join(__dirname, '..', '..', 'rules');

export async function lintText(content: string, filePath: string, configPath?: string): Promise<Violation[]> {
    const config = loadConfig(configPath);

    const ruleDirs = [RULES_DIR];
    if (config.customRulesPaths) {
        for (const p of config.customRulesPaths) {
            ruleDirs.push(path.resolve(process.cwd(), p));
        }
    }

    let rules = RuleLoader.loadRules(ruleDirs);

    if (config.rules) {
        rules = rules.map(rule => {
            const override = config.rules![rule.id];
            if (override) {
                return { ...rule, severity: override as any };
            }
            return rule;
        }).filter(rule => (rule as any).severity !== 'off');
    }

    let violations: Violation[] = [];

    violations = violations.concat(RegexChecker.check(filePath, rules, content));
    violations = violations.concat(AstChecker.check(filePath, rules, content));
    violations = violations.concat(SemanticChecker.check(filePath, rules, content));
    violations = violations.concat(await HeuristicChecker.check(filePath, rules, content));

    // TypeCheck on unsaved buffers would require a massive LanguageService abstraction.
    // For now, we skip deep typechecking on unsaved purely text-based lintText calls.
    // Typecheck can be done on the whole project via the CLI.

    return violations;
}
