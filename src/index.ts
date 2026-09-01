#!/usr/bin/env node

import { Command } from 'commander';
import { globSync } from 'glob';
import ignore from 'ignore';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as os from 'os';

import { RuleLoader } from './engine/loader';
import { Rule } from './engine/schema';
import { loadConfig, SloplessConfig } from './engine/config';
import { RegexChecker, Violation } from './checkers/regex-checker';
import { GitChecker } from './checkers/git-checker';
import { AstChecker } from './checkers/ast-checker';
import { HeuristicChecker } from './checkers/heuristic-checker';
import { SemanticChecker } from './checkers/semantic-checker';
import { TypeCheckerEngine } from './checkers/type-checker';
import { formatJson, formatSarif } from './engine/formatters';
import { AnalysisCache } from './engine/cache';
import { runWithConcurrencyLimit } from './engine/utils';
import { applyPrecedence } from './engine/precedence';
import { isGeneratedFile } from './engine/generated';
import * as ts from 'typescript';

const RULES_DIR = path.join(__dirname, '..', 'rules');

function getStagedFiles(): string[] {
    try {
        const output = cp.execSync('git diff --cached --name-only', { encoding: 'utf8' });
        return output.split('\n').filter(f => f.trim().length > 0);
    } catch (e) {
        return [];
    }
}

/** Rewrites one line in place. Returns true when the line actually changed. */
function applyFixToLine(lines: string[], viol: Violation, file: string): boolean {
    if (viol.line <= 0 || viol.line > lines.length) return false;
    const lineIndex = viol.line - 1;
    const originalLine = lines[lineIndex];
    try {
        const regex = new RegExp(viol.fix!.pattern, 'g');
        const newLine = originalLine.replace(regex, viol.fix!.replacement);
        if (originalLine === newLine) return false;
        lines[lineIndex] = newLine;
        return true;
    } catch (e) {
        console.error(`Failed to apply fix for ${viol.ruleId} on ${file}:${viol.line}`);
        return false;
    }
}

function applyFixesToFile(file: string, items: Violation[]): number {
    if (!fs.existsSync(file)) return 0;
    const lines = fs.readFileSync(file, 'utf8').split('\n');

    let fixCount = 0;
    for (const viol of items) {
        if (applyFixToLine(lines, viol, file)) fixCount++;
    }

    if (fixCount > 0) fs.writeFileSync(file, lines.join('\n'), 'utf8');
    return fixCount;
}

function applyFixes(violations: Violation[]): number {
    const fixableViolations = violations.filter(v => v.fix);
    if (fixableViolations.length === 0) return 0;

    const byFile: Record<string, Violation[]> = {};
    for (const viol of fixableViolations) {
        if (!byFile[viol.file]) byFile[viol.file] = [];
        byFile[viol.file].push(viol);
    }

    let fixCount = 0;
    for (const [file, items] of Object.entries(byFile)) {
        fixCount += applyFixesToFile(file, items);
    }

    return fixCount;
}

/**
 * `ignore` only accepts paths relative to the working directory and throws on
 * anything else, so an absolute path on the command line crashed the whole run.
 * Paths outside the project cannot be matched by a .sloplessignore rule at all,
 * so they pass through untouched.
 */
export function applyIgnoreRules(files: string[], configIgnore?: string[]): string[] {
    const patterns: string[] = [];
    const ignorePath = path.join(process.cwd(), '.sloplessignore');
    if (fs.existsSync(ignorePath)) {
        // `ignore` splits a bare multi-line string, but treats an array entry as one
        // literal pattern, so the file has to be split before it goes in.
        patterns.push(...fs.readFileSync(ignorePath, 'utf8').split(/\r?\n/));
    }
    if (configIgnore?.length) patterns.push(...configIgnore);
    if (patterns.length === 0) return files;

    const ig = ignore().add(patterns);
    const cwd = process.cwd();
    return files.filter(file => {
        const relative = path.relative(cwd, path.resolve(cwd, file));
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return true;
        return !ig.ignores(relative);
    });
}

/**
 * Narrows the rule set before anything runs.
 *
 * Across ten instrumented repositories the tool reported 4754 findings, of which
 * 9 were security and 101 were errors of any kind. Everything a person installs
 * this for was buried under style. Selecting up front is cheaper than reading
 * past it, and cheaper than running the rules at all.
 */
export function selectRules(rules: Rule[], options: { only?: string; minSeverity?: string }): Rule[] {
    let selected = rules;

    if (options.only) {
        const wanted = new Set(options.only.split(',').map(part => part.trim()).filter(Boolean));
        selected = selected.filter(rule => wanted.has(rule.category));
    }
    if (options.minSeverity === 'error') {
        selected = selected.filter(rule => rule.severity === 'error');
    }
    return selected;
}

interface LintOptions {
    only?: string;
    minSeverity?: string;
    format: string;
    shouldFix: boolean;
    useCache: boolean;
    typeCheck: boolean;
    gitMode: boolean;
}

async function runLint(files: string[], config: SloplessConfig, options: LintOptions) {
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

    // An opt-in rule runs only when the config names it, which the block above
    // has already applied, so its severity is whatever the user asked for.
    const named = new Set(Object.keys(config.rules ?? {}));
    rules = rules.filter(rule => !rule.opt_in || named.has(rule.id));

    rules = selectRules(rules, options);

    if (files.length === 0) {
        if (options.format === 'default') console.log('No files to check.');
        return;
    }

    let allViolations: Violation[] = [];
    const cacheManager = new AnalysisCache(options.useCache && !options.shouldFix); // Disable cache read if fixing

    let tsProgram: ts.Program | null = null;
    let checker: ts.TypeChecker | null = null;
    if (options.typeCheck) {
        if (options.format === 'default') console.log('⏳ Initializing TypeScript Program for Deep Semantic Typechecking...');
        const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
        if (tsFiles.length > 0) {
            tsProgram = ts.createProgram(tsFiles, {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.CommonJS,
                moduleResolution: ts.ModuleResolutionKind.NodeJs,
                lib: ['lib.es2022.d.ts', 'lib.dom.d.ts']
            });
            checker = tsProgram.getTypeChecker();
        }
    }

    if (options.gitMode) {
        allViolations = allViolations.concat(GitChecker.checkFiles(files, rules));
    }

    // Analyze files concurrently with a CPU core boundary
    let generatedCount = 0;
    const results = await runWithConcurrencyLimit(files, os.cpus().length, async (file) => {
        if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) {
            return [];
        }

        // A minified bundle sets off every rule and none of it is actionable.
        if (isGeneratedFile(file)) {
            generatedCount++;
            return [];
        }

        const currentHash = cacheManager.calculateHash(file);
        if (currentHash) {
            const cached = cacheManager.getCachedViolations(file, currentHash);
            if (cached) {
                return cached;
            }
        }

        let fileViolations: Violation[] = [];
        fileViolations = fileViolations.concat(RegexChecker.check(file, rules));
        fileViolations = fileViolations.concat(AstChecker.check(file, rules));
        fileViolations = fileViolations.concat(await HeuristicChecker.check(file, rules));
        fileViolations = fileViolations.concat(SemanticChecker.check(file, rules));

        if (tsProgram && checker) {
            fileViolations = fileViolations.concat(TypeCheckerEngine.check(file, rules, tsProgram, checker));
        }

        if (currentHash) {
            cacheManager.setCachedViolations(file, currentHash, fileViolations);
        }

        return fileViolations;
    });

    for (const fileResults of results) {
        allViolations = allViolations.concat(fileResults);
    }

    allViolations = applyPrecedence(allViolations, rules);

    cacheManager.saveCache();

    if (options.shouldFix) {
        const fixCount = applyFixes(allViolations);
        if (options.format === 'default' && fixCount > 0) {
            console.log(`\n🛠️  Applied ${fixCount} auto-fixes.`);
        }
        allViolations = allViolations.filter(v => !v.fix);
    }

    const errors = allViolations.filter(v => v.severity === 'error');
    const warnings = allViolations.filter(v => v.severity === 'warning');

    if (options.format === 'json') {
        console.log(formatJson(allViolations));
    } else if (options.format === 'sarif') {
        console.log(formatSarif(allViolations, ruleDirs));
    } else {
        if (allViolations.length > 0) {
            console.log(`\n🚫 Static Analysis found ${allViolations.length} issues:\n`);

            allViolations.forEach(v => {
                const icon = v.severity === 'error' ? '❌' : '⚠️';
                const fixIcon = v.fix ? ' 🔧 (fixable)' : '';
                console.log(`${icon} [${v.ruleId}] ${v.file}:${v.line} - ${v.message}${fixIcon}`);
            });

            console.log(`\nSummary: ${errors.length} errors, ${warnings.length} warnings.`);
        } else {
            console.log('✅ No static analysis issues detected. Clean architecture!');
        }
        if (generatedCount > 0) {
            console.log(`\nSkipped ${generatedCount} generated file${generatedCount === 1 ? '' : 's'} `
                + '(minified or bundled output).');
        }
    }

    if (errors.length > 0) {
        if (options.format === 'default') console.log('\nCommit/Run blocked. Please fix the errors above or run with --fix.');
        // Setting the code rather than calling process.exit lets Node drain stdout
        // first. Exiting here truncated JSON and SARIF at the 64KB pipe buffer, so
        // any project large enough to fill it got an unparseable report.
        process.exitCode = 1;
    }
}

const program = new Command();

program
    .name('slopless')
    .description('Static Analysis Tool to prevent unstructured coding patterns')
    .version(require('../package.json').version);

program
    .argument('[patterns...]', 'Glob patterns for files to lint. If empty, lints staged files.')
    .option('-c, --config <path>', 'Path to slopless.config.json')
    .option('-f, --format <default|json|sarif>', 'Output format', 'default')
    .option('--fix', 'Automatically fix issues where possible', false)
    .option('--no-cache', 'Disable file caching', false)
    .option('--type-check', 'Enable deep semantic type analysis via ts.createProgram (slower)', false)
    .option('--only <categories>', 'Comma-separated categories to run: security, core, clean-code, ux-dx, docs, git')
    .option('--min-severity <error|warning>', 'Lowest severity to report', 'warning')
    .option('--init', 'Initialize Slopless configuration files in the current directory')
    .action(async (patterns: string[], options: { config?: string, format: string, fix: boolean, cache: boolean, typeCheck: boolean, init: boolean, only?: string, minSeverity: string }) => {
        if (options.init) {
            const configPath = path.join(process.cwd(), 'slopless.config.json');
            const ignorePath = path.join(process.cwd(), '.sloplessignore');

            if (!fs.existsSync(configPath)) {
                fs.writeFileSync(configPath, JSON.stringify({ rules: {}, ignore: [], customRulesPaths: [] }, null, 2));
                console.log('✅ Created slopless.config.json');
            } else {
                console.log('⚠️ slopless.config.json already exists.');
            }

            if (!fs.existsSync(ignorePath)) {
                fs.writeFileSync(ignorePath,
                    // Generated output is not source. Coverage reports in particular
                    // are large, minified and full of patterns nobody wrote by hand.
                    'node_modules/\nvendor/\ndist/\nbuild/\ncoverage/\nout/\n.next/\n.git/\n*.min.js\n');
                console.log('✅ Created .sloplessignore');
            } else {
                console.log('⚠️ .sloplessignore already exists.');
            }
            return;
        }

        const config = loadConfig(options.config);

        let targetFiles: string[] = [];

        if (patterns.length > 0) {
            targetFiles = globSync(patterns, { ignore: ['node_modules/**'] });
            targetFiles = applyIgnoreRules(targetFiles, config.ignore);
        } else {
            if (options.format === 'default') console.log('No patterns provided. Falling back to git staged files...');
            targetFiles = getStagedFiles();
        }

        const shouldTypeCheck = options.typeCheck || config.typeCheck || false;
        await runLint(targetFiles, config, {
            only: options.only,
            minSeverity: options.minSeverity,
            format: options.format,
            shouldFix: options.fix,
            useCache: options.cache,
            typeCheck: shouldTypeCheck,
            gitMode: patterns.length === 0,
        });
    });

program.parseAsync();
