import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';
import { Rule } from '../engine/schema';
import { Violation } from './regex-checker';

function pushViolation(violations: Violation[], rule: Rule, file: string, extra: Partial<Violation> = {}) {
    violations.push({
        ruleId: rule.id,
        name: rule.name,
        severity: rule.severity,
        message: extra.message ?? rule.message,
        file,
        line: 0,
        ...extra,
    });
}

/**
 * A container that holds nothing but a private key is one by its extension. A
 * `.pem` or `.key` is not: half of them are certificates, which are public and
 * exist to be handed out, so those are read before anything is claimed.
 */
const KEY_CONTAINERS = ['.p12', '.pfx', '.jks', '.keystore'];
const KEY_TEXT = ['.pem', '.key'];
const PRIVATE_KEY_HEADER = /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/;

function isPrivateKeyFile(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    if (KEY_CONTAINERS.includes(ext)) return true;
    if (!KEY_TEXT.includes(ext)) return false;
    try {
        // The header is in the first line of a PEM file, so a slice is enough
        // and a 4 GB file cannot be read into memory by accident.
        const head = fs.readFileSync(file, 'utf8').slice(0, 4096);
        return PRIVATE_KEY_HEADER.test(head);
    } catch {
        return false;
    }
}

/**
 * Every other git check reads the staged files, which is the pre-commit path and
 * the only one where they run: `gitMode` is on when no patterns were given. That
 * is right for "you are about to commit .env" and wrong for a key that was
 * committed two years ago and is still sitting in the tree, so this one is also
 * asked on every run, over what git is tracking.
 */
const ALWAYS_ASKED = new Set(['private_key']);

function trackedFiles(): string[] {
    try {
        return cp.execSync('git ls-files -z', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            .split('\0')
            .filter(f => f.length > 0);
    } catch {
        return [];
    }
}

function rootFiles(): string[] {
    try { return fs.readdirSync('.'); } catch { return []; }
}

export class GitChecker {
    /** The checks that do not depend on something being staged. */
    static checkTracked(rules: Rule[]): Violation[] {
        const asked = rules.filter(r => r.match.git_check && ALWAYS_ASKED.has(r.match.git_check));
        return asked.length ? this.checkFiles(trackedFiles(), asked) : [];
    }

    static checkFiles(stagedFiles: string[], rules: Rule[]): Violation[] {
        const violations: Violation[] = [];

        for (const rule of rules) {
            if (!rule.match.git_check) continue;

            switch (rule.match.git_check) {
                case 'private_key': {
                    stagedFiles
                        .filter(isPrivateKeyFile)
                        .forEach(f => pushViolation(violations, rule, f));
                    break;
                }

                case 'committed_env': {
                    stagedFiles
                        .filter(f => path.basename(f) === '.env')
                        .forEach(f => pushViolation(violations, rule, f));
                    break;
                }

                case 'node_modules': {
                    if (stagedFiles.some(f => f.includes('node_modules/'))) {
                        pushViolation(violations, rule, 'node_modules/');
                    }
                    break;
                }

                case 'binary_file': {
                    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.exe', '.dll', '.so', '.dylib'];
                    stagedFiles
                        .filter(f => binaryExts.includes(path.extname(f).toLowerCase()))
                        .forEach(f => pushViolation(violations, rule, f));
                    break;
                }

                case 'missing_gitignore': {
                    const hasIt = stagedFiles.some(f => f.includes('.gitignore')) || fs.existsSync('.gitignore');
                    if (!hasIt) pushViolation(violations, rule, 'project-root');
                    break;
                }

                case 'missing_license': {
                    const hasLicense = rootFiles().some(f => f.toLowerCase().includes('license')) ||
                        stagedFiles.some(f => f.toLowerCase().includes('license'));
                    if (!hasLicense) pushViolation(violations, rule, 'project-root');
                    break;
                }

                case 'spaces_in_filenames': {
                    stagedFiles
                        .filter(f => path.basename(f).includes(' '))
                        .forEach(f => pushViolation(violations, rule, f));
                    break;
                }

                case 'too_many_staged_files': {
                    const threshold = rule.match.threshold ?? 30;
                    if (stagedFiles.length > threshold) {
                        const msg = rule.message
                            .replace('{threshold}', threshold.toString())
                            .replace('{count}', stagedFiles.length.toString());
                        pushViolation(violations, rule, 'git-index', { message: msg });
                    }
                    break;
                }

                case 'filename_too_long': {
                    const threshold = rule.match.threshold ?? 50;
                    for (const file of stagedFiles) {
                        const basename = path.basename(file);
                        if (basename.length > threshold) {
                            const msg = rule.message
                                .replace('{threshold}', threshold.toString())
                                .replace('{length}', basename.length.toString());
                            pushViolation(violations, rule, file, { message: msg });
                        }
                    }
                    break;
                }

                case 'large_file_size': {
                    const threshold = rule.match.threshold ?? 1048576;
                    for (const file of stagedFiles) {
                        if (!fs.existsSync(file)) continue;
                        const size = fs.statSync(file).size;
                        if (size > threshold) {
                            const msg = rule.message
                                .replace('{threshold}', threshold.toString())
                                .replace('{size}', size.toString());
                            pushViolation(violations, rule, file, { message: msg });
                        }
                    }
                    break;
                }

                case 'missing_readme': {
                    const hasReadme = rootFiles().some(f => f.toLowerCase().startsWith('readme')) ||
                        stagedFiles.some(f => path.basename(f).toLowerCase().startsWith('readme'));
                    if (!hasReadme) pushViolation(violations, rule, 'project-root');
                    break;
                }

                case 'committed_ide_settings': {
                    stagedFiles
                        .filter(f => f.includes('.vscode/') || f.includes('.idea/') || f.includes('.vs/'))
                        .forEach(f => {
                            const msg = rule.message.replace('{file}', f);
                            pushViolation(violations, rule, f, { message: msg });
                        });
                    break;
                }

                case 'missing_contributing': {
                    const prefix = 'contributing';
                    const hasIt = rootFiles().some(f => f.toLowerCase().startsWith(prefix)) ||
                        stagedFiles.some(f => path.basename(f).toLowerCase().startsWith(prefix));
                    if (!hasIt) pushViolation(violations, rule, 'project-root');
                    break;
                }

                case 'missing_security': {
                    const hasIt = rootFiles().some(f => f.toLowerCase().startsWith('security')) ||
                        stagedFiles.some(f => path.basename(f).toLowerCase().startsWith('security'));
                    if (!hasIt) pushViolation(violations, rule, 'project-root');
                    break;
                }

                case 'missing_changelog': {
                    const isChangelogFile = (name: string) =>
                        name.startsWith('changelog') || name.startsWith('history');
                    const hasIt = rootFiles().some(f => isChangelogFile(f.toLowerCase())) ||
                        stagedFiles.some(f => isChangelogFile(path.basename(f).toLowerCase()));
                    if (!hasIt) pushViolation(violations, rule, 'project-root');
                    break;
                }

                case 'commit_message_too_short': {
                    const threshold = rule.match.threshold ?? 10;
                    const commitMsg = GitChecker.readCommitMessage();
                    if (commitMsg && commitMsg.length < threshold) {
                        const msg = rule.message
                            .replace('{threshold}', threshold.toString())
                            .replace('{count}', commitMsg.length.toString());
                        pushViolation(violations, rule, 'git-commit', { message: msg });
                    }
                    break;
                }
            }
        }

        return violations;
    }

    private static readCommitMessage(): string {
        // Prefer COMMIT_EDITMSG (available in commit-msg hook context)
        const commitMsgPath = path.join(process.cwd(), '.git', 'COMMIT_EDITMSG');
        if (fs.existsSync(commitMsgPath)) {
            return fs.readFileSync(commitMsgPath, 'utf8').trim();
        }
        // Fallback to last commit (pre-commit context or manual run)
        try {
            return cp.execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
        } catch (_e: unknown) {
            // Not in a git repo, no commits yet, or git not available — skip
            return '';
        }
    }
}
