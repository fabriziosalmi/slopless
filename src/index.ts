#!/usr/bin/env node

import { Command } from 'commander';
import { globSync } from 'glob';
import ignore from 'ignore';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import * as os from 'os';

import { RuleLoader } from './engine/loader';
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

interface LintOptions {
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
    const results = await runWithConcurrencyLimit(files, os.cpus().length, async (file) => {
        if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) {
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
    }

    if (errors.length > 0) {
        if (options.format === 'default') console.log('\nCommit/Run blocked. Please fix the errors above or run with --fix.');
        process.exit(1);
    }
}

const program = new Command();

program
    .name('slopless')
    .description('Static Analysis Tool to prevent unstructured coding patterns')
    .version('1.0.0');

program
    .argument('[patterns...]', 'Glob patterns for files to lint. If empty, lints staged files.')
    .option('-c, --config <path>', 'Path to slopless.config.json')
    .option('-f, --format <default|json|sarif>', 'Output format', 'default')
    .option('--fix', 'Automatically fix issues where possible', false)
    .option('--no-cache', 'Disable file caching', false)
    .option('--type-check', 'Enable deep semantic type analysis via ts.createProgram (slower)', false)
    .option('--init', 'Initialize Slopless configuration files in the current directory')
    .action(async (patterns: string[], options: { config?: string, format: string, fix: boolean, cache: boolean, typeCheck: boolean, init: boolean }) => {
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
                fs.writeFileSync(ignorePath, 'node_modules/\ndist/\nbuild/\n.git/\n');
                console.log('✅ Created .sloplessignore');
            } else {
                console.log('⚠️ .sloplessignore already exists.');
            }
            process.exit(0);
        }

        const config = loadConfig(options.config);

        let targetFiles: string[] = [];

        if (patterns.length > 0) {
            targetFiles = globSync(patterns, { ignore: ['node_modules/**'] });

            const ignorePath = path.join(process.cwd(), '.sloplessignore');
            if (fs.existsSync(ignorePath)) {
                const ig = ignore().add(fs.readFileSync(ignorePath, 'utf8'));
                if (config.ignore) {
                    ig.add(config.ignore);
                }
                targetFiles = ig.filter(targetFiles);
            } else if (config.ignore) {
                const ig = ignore().add(config.ignore);
                targetFiles = ig.filter(targetFiles);
            }
        } else {
            if (options.format === 'default') console.log('No patterns provided. Falling back to git staged files...');
            targetFiles = getStagedFiles();
        }

        const shouldTypeCheck = options.typeCheck || config.typeCheck || false;
        await runLint(targetFiles, config, {
            format: options.format,
            shouldFix: options.fix,
            useCache: options.cache,
            typeCheck: shouldTypeCheck,
            gitMode: patterns.length === 0,
        });
    });

program.parseAsync();
