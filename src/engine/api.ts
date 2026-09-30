import { loadConfig, configLocation, SloplessConfig } from './config';
import { RuleLoader } from './loader';
import { RegexChecker, Violation } from '../checkers/regex-checker';
import { AstChecker } from '../checkers/ast-checker';
import { HeuristicChecker } from '../checkers/heuristic-checker';
import { SemanticChecker } from '../checkers/semantic-checker';
import { TypeCheckerEngine } from '../checkers/type-checker';
import { applyPrecedence } from './precedence';
import { applySuppressions } from './suppressions';
import { compileVocabulary } from './vocabulary';
import { isGeneratedFile } from './generated';
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
    return rulesFrom(loadConfig(configPath), configPath);
}

/** The same, for a caller that has already read the config and needs it for more. */
function rulesFrom(config: SloplessConfig, configPath?: string) {
    // Relative to the config that named them, not to wherever this happens to be
    // running: the editor and the MCP server do not run in the workspace.
    const configDir = path.dirname(configLocation(configPath));
    const ruleDirs = [RULES_DIR];
    if (config.customRulesPaths) {
        for (const customPath of config.customRulesPaths) {
            ruleDirs.push(path.resolve(configDir, customPath));
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

/**
 * What the CLI would say about this text, for a caller that has a buffer rather
 * than a file: the editor, and the MCP server.
 *
 * It has to say the same thing. It did not: the CLI honoured `vocabulary` and
 * `slopless-disable` directives and this did not, so the editor panel showed an
 * error the author had suppressed and thirteen findings the project had claimed
 * as its own words, and the "copy a disable marker" command produced a marker
 * that changed nothing. The test that keeps the two together runs both.
 *
 * What it cannot do is the repository-level work: the git checks read the index,
 * and the type check needs a whole program, which an unsaved buffer is not part of.
 */
export async function lintText(content: string, filePath: string, configPath?: string): Promise<Violation[]> {
    // A minified bundle sets off every rule and none of it is actionable; the CLI
    // leaves it alone, judged by shape from the text it was given.
    if (isGeneratedFile(filePath, content)) return [];

    const config = loadConfig(configPath);
    const rules = rulesFrom(config, configPath);
    // Counted per call. The CLI reports how many findings a word excused; a
    // buffer has nowhere to say it, so the count is simply not read.
    const vocabulary = compileVocabulary(config.vocabulary);

    let violations: Violation[] = [];

    violations = violations.concat(RegexChecker.check(filePath, rules, content, vocabulary));
    violations = violations.concat(AstChecker.check(filePath, rules, content));
    violations = violations.concat(SemanticChecker.check(filePath, rules, content));
    violations = violations.concat(await HeuristicChecker.check(filePath, rules, content));

    // After every tier, as in the CLI, and against the buffer rather than the
    // file: what is on disk is the last save, and the marker was typed a moment ago.
    return applySuppressions(applyPrecedence(violations, rules), () => content);
}

/**
 * The files worth reading, out of a list of candidates. Exported because an
 * editor listing files has to leave out the same ones the CLI does, and a second
 * list written by hand had already drifted: the panel reported 853 errors from a
 * VitePress dependency cache the CLI has skipped since 1.12.4.
 *
 * From `./ignore` rather than from the CLI module, because importing that one
 * runs it.
 */
export { applyIgnoreRules, NEVER_YOURS } from './ignore';

/**
 * The config a run would use. Exported for the same reason as `resolveRules`:
 * an editor that filters its own file list has to filter it by what the config
 * says, and the config is only found where the caller points at it.
 */
export { loadConfig, configLocation, type SloplessConfig } from './config';
