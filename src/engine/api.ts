import { loadConfig, SloplessConfig } from './config';
import { RuleLoader } from './loader';
import { RegexChecker, Violation } from '../checkers/regex-checker';
import { AstChecker } from '../checkers/ast-checker';
import { HeuristicChecker } from '../checkers/heuristic-checker';
import { SemanticChecker } from '../checkers/semantic-checker';
import { TypeCheckerEngine } from '../checkers/type-checker';
import { applyPrecedence } from './precedence';
import * as path from 'path';
import * as ts from 'typescript';

const RULES_DIR = path.join(__dirname, '..', '..', 'rules');

/**
 * The rules a run would use: what is on disk, plus whatever the config adds,
 * with severities overridden, rules turned off removed, and opt-in rules kept
 * only when the config asked for them.
 *
 * Exported because anything that lists rules — an editor panel, an MCP tool —
 * has to list the same ones the linter runs, and rebuilding that set somewhere
 * else is how the two drift apart.
 */
export function resolveRules(configPath?: string) {
    const config = loadConfig(configPath);

    const ruleDirs = [RULES_DIR];
    if (config.customRulesPaths) {
        for (const customPath of config.customRulesPaths) {
            ruleDirs.push(path.resolve(process.cwd(), customPath));
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

    // An opt-in rule runs only when the config names it, which the block above
    // has already applied, so its severity is whatever the user asked for.
    const named = new Set(Object.keys(config.rules ?? {}));
    return rules.filter(rule => !rule.opt_in || named.has(rule.id));
}

export async function lintText(content: string, filePath: string, configPath?: string): Promise<Violation[]> {
    const rules = resolveRules(configPath);

    let violations: Violation[] = [];

    violations = violations.concat(RegexChecker.check(filePath, rules, content));
    violations = violations.concat(AstChecker.check(filePath, rules, content));
    violations = violations.concat(SemanticChecker.check(filePath, rules, content));
    violations = violations.concat(await HeuristicChecker.check(filePath, rules, content));

    // TypeCheck on unsaved buffers would require a massive LanguageService abstraction.
    // For now, we skip deep typechecking on unsaved purely text-based lintText calls.
    // Typecheck can be done on the whole project via the CLI.

    return applyPrecedence(violations, rules);
}
