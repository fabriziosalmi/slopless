import * as path from 'path';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';

export class GitChecker {
    static checkFiles(stagedFiles: string[], rules: Rule[]): Violation[] {
        const violations: Violation[] = [];

        for (const rule of rules) {
            if (!rule.match.git_check) continue;

            if (rule.match.git_check === 'committed_env') {
                const envFiles = stagedFiles.filter(f => path.basename(f) === '.env');
                envFiles.forEach(f => {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: rule.message,
                        file: f,
                        line: 0,
                    });
                });
            }

            if (rule.match.git_check === 'node_modules') {
                const nodeModulesFiles = stagedFiles.filter(f => f.includes('node_modules/'));
                if (nodeModulesFiles.length > 0) {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: rule.message,
                        file: 'node_modules/',
                        line: 0,
                    });
                }
            }

            if (rule.match.git_check === 'binary_file') {
                const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.exe', '.dll', '.so', '.dylib'];
                const binaryFiles = stagedFiles.filter(f => binaryExtensions.includes(path.extname(f).toLowerCase()));
                binaryFiles.forEach(f => {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: rule.message,
                        file: f,
                        line: 0,
                    });
                });
            }

            if (rule.match.git_check === 'missing_gitignore') {
                const fs = require('fs');
                if (!stagedFiles.some(f => f.includes('.gitignore')) && !fs.existsSync('.gitignore')) {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: rule.message,
                        file: 'project-root',
                        line: 0,
                    });
                }
            }

            if (rule.match.git_check === 'missing_license') {
                const fs = require('fs');
                const files = fs.readdirSync('.');
                const hasLicense = files.some((f: string) => f.toLowerCase().includes('license'));
                if (!stagedFiles.some(f => f.toLowerCase().includes('license')) && !hasLicense) {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: rule.message,
                        file: 'project-root',
                        line: 0,
                    });
                }
            }

            if (rule.match.git_check === 'spaces_in_filenames') {
                const filesWithSpaces = stagedFiles.filter(f => path.basename(f).includes(' '));
                filesWithSpaces.forEach(f => {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: rule.message,
                        file: f,
                        line: 0,
                    });
                });
            }

            if (rule.match.git_check === 'too_many_staged_files' && rule.match.threshold) {
                if (stagedFiles.length > rule.match.threshold) {
                    violations.push({
                        ruleId: rule.id,
                        name: rule.name,
                        severity: rule.severity,
                        message: rule.message.replace('{threshold}', rule.match.threshold.toString()).replace('{count}', stagedFiles.length.toString()),
                        file: 'git-index',
                        line: 0,
                    });
                }
            }

            if (rule.match.git_check === 'filename_too_long' && rule.match.threshold) {
                for (const file of stagedFiles) {
                    const basename = path.basename(file);
                    if (basename.length > rule.match.threshold) {
                        violations.push({
                            ruleId: rule.id,
                            name: rule.name,
                            severity: rule.severity,
                            message: rule.message.replace('{threshold}', rule.match.threshold.toString()).replace('{length}', basename.length.toString()),
                            file,
                            line: 0,
                        });
                    }
                }
            }

            if (rule.match.git_check === 'large_file_size' && rule.match.threshold) {
                const fs = require('fs');
                for (const file of stagedFiles) {
                    if (fs.existsSync(file)) {
                        const stats = fs.statSync(file);
                        if (stats.size > rule.match.threshold) {
                            violations.push({
                                ruleId: rule.id,
                                name: rule.name,
                                severity: rule.severity,
                                message: rule.message.replace('{threshold}', rule.match.threshold.toString()).replace('{size}', stats.size.toString()),
                                file,
                                line: 0,
                            });
                        }
                    }
                }
            }
        }

        return violations;
    }
}
