import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { RuleLoader } from './engine/loader';
import { RegexChecker, Violation } from './checkers/regex-checker';
import { GitChecker } from './checkers/git-checker';
import { AstChecker } from './checkers/ast-checker';
import { HeuristicChecker } from './checkers/heuristic-checker';
import { SemanticChecker } from './checkers/semantic-checker';

const RULES_DIR = path.join(__dirname, '..', 'rules');

function getStagedFiles(): string[] {
    try {
        const output = cp.execSync('git diff --cached --name-only', { encoding: 'utf8' });
        return output.split('\n').filter(f => f.trim().length > 0);
    } catch (e) {
        console.error('Error getting staged files:', e);
        return [];
    }
}

async function run() {
    const rules = RuleLoader.loadRules(RULES_DIR);
    const stagedFiles = getStagedFiles();

    if (stagedFiles.length === 0) {
        console.log('No staged files to check.');
        return;
    }

    let allViolations: Violation[] = [];

    // Git Checks
    allViolations = allViolations.concat(GitChecker.checkFiles(stagedFiles, rules));

    // File Content & AST Checks
    for (const file of stagedFiles) {
        // Basic check to see if file exists (it should, but just in case of deletions)
        if (fs.existsSync(file) && fs.lstatSync(file).isFile()) {
            allViolations = allViolations.concat(RegexChecker.check(file, rules));
            allViolations = allViolations.concat(AstChecker.check(file, rules));
            allViolations = allViolations.concat(await HeuristicChecker.check(file, rules));
            allViolations = allViolations.concat(SemanticChecker.check(file, rules));
        }
    }

    if (allViolations.length > 0) {
        console.log('\n🚫 Anti-Vibecoding Linter found issues:\n');

        const errors = allViolations.filter(v => v.severity === 'error');
        const warnings = allViolations.filter(v => v.severity === 'warning');

        allViolations.forEach(v => {
            const icon = v.severity === 'error' ? '❌' : '⚠️';
            console.log(`${icon} [${v.ruleId}] ${v.file}:${v.line} - ${v.message}`);
        });

        console.log(`\nSummary: ${errors.length} errors, ${warnings.length} warnings.`);

        if (errors.length > 0) {
            console.log('\nCommit blocked. Please fix the errors above.');
            process.exit(1);
        }
    } else {
        console.log('✅ No vibecoding issues detected. Clean vibes!');
    }
}

run();
