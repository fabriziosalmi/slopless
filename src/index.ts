#!/usr/bin/env node

import { Command } from 'commander';
import { globSync } from 'glob';
import ignore from 'ignore';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

import { RuleLoader } from './engine/loader';
import { loadConfig, SloplessConfig } from './engine/config';
import { RegexChecker, Violation } from './checkers/regex-checker';
import { GitChecker } from './checkers/git-checker';
import { AstChecker } from './checkers/ast-checker';
import { HeuristicChecker } from './checkers/heuristic-checker';
import { SemanticChecker } from './checkers/semantic-checker';
import { formatJson, formatSarif } from './engine/formatters';

const RULES_DIR = path.join(__dirname, '..', 'rules');

function getStagedFiles(): string[] {
    try {
        const output = cp.execSync('git diff --cached --name-only', { encoding: 'utf8' });
        return output.split('\n').filter(f => f.trim().length > 0);
    } catch (e) {
        return [];
    }
}

async function runLint(files: string[], config: SloplessConfig, format: string) {
    let rules = RuleLoader.loadRules(RULES_DIR);

    // Apply severity overrides
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
        if (format === 'default') console.log('No files to check.');
        return;
    }

    let allViolations: Violation[] = [];

    // Git Checks
    allViolations = allViolations.concat(GitChecker.checkFiles(files, rules));

    // File Content & AST Checks
    for (const file of files) {
        if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
            allViolations = allViolations.concat(RegexChecker.check(file, rules));
            allViolations = allViolations.concat(AstChecker.check(file, rules));
            allViolations = allViolations.concat(await HeuristicChecker.check(file, rules));
            allViolations = allViolations.concat(SemanticChecker.check(file, rules));
        }
    }

    const errors = allViolations.filter(v => v.severity === 'error');
    const warnings = allViolations.filter(v => v.severity === 'warning');

    if (format === 'json') {
        console.log(formatJson(allViolations));
    } else if (format === 'sarif') {
        console.log(formatSarif(allViolations, RULES_DIR));
    } else {
        if (allViolations.length > 0) {
            console.log('\n🚫 Anti-Vibecoding Linter found issues:\n');

            allViolations.forEach(v => {
                const icon = v.severity === 'error' ? '❌' : '⚠️';
                console.log(`${icon} [${v.ruleId}] ${v.file}:${v.line} - ${v.message}`);
            });

            console.log(`\nSummary: ${errors.length} errors, ${warnings.length} warnings.`);
        } else {
            console.log('✅ No static analysis issues detected. Clean architecture!');
        }
    }

    if (errors.length > 0) {
        if (format === 'default') console.log('\nCommit/Run blocked. Please fix the errors above.');
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
    .action(async (patterns: string[], options: { config?: string, format: string }) => {
        const config = loadConfig(options.config);

        let targetFiles: string[] = [];

        if (patterns.length > 0) {
            targetFiles = globSync(patterns, { ignore: ['node_modules/**'] });

            // Apply .sloplessignore
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

        await runLint(targetFiles, config, options.format);
    });

program.parseAsync();
