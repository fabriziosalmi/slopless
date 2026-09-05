import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as cp from 'child_process';
import { GitChecker } from '../checkers/git-checker';
import * as path from 'path';
import { RuleLoader } from '../engine/loader';

const RULES_DIR = path.resolve(__dirname, '../../rules');
const rules = RuleLoader.loadRules([RULES_DIR]);

function gitCheck(files: string[]) {
    return GitChecker.checkFiles(files, rules);
}

describe('GitChecker — committed_env', () => {
    it('flags .env file in staged list', () => {
        const violations = gitCheck(['.env']);
        const match = violations.filter(v => v.ruleId === 'VBC-002');
        expect(match.length).toBeGreaterThan(0);
    });

    it('does not flag .env.example', () => {
        const violations = gitCheck(['.env.example']);
        const match = violations.filter(v => v.ruleId === 'VBC-002');
        expect(match).toHaveLength(0);
    });
});

describe('GitChecker — VBC-949 committed-private-key', () => {
    let sandbox: string;
    const original = process.cwd();

    beforeEach(() => {
        sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-keys-')));
        process.chdir(sandbox);
    });
    afterEach(() => {
        process.chdir(original);
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const write = (name: string, body: string) => {
        fs.mkdirSync(path.dirname(path.join(sandbox, name)), { recursive: true });
        fs.writeFileSync(path.join(sandbox, name), body);
        return name;
    };
    const found = (files: string[]) => gitCheck(files).filter(v => v.ruleId === 'VBC-949');

    it('flags a .pem holding a private key', () => {
        const f = write('backend/key.pem', '-----BEGIN PRIVATE KEY-----\nMIIJQwIBADANBg\n');
        expect(found([f])).toHaveLength(1);
    });

    it('flags the labelled headers too', () => {
        for (const label of ['RSA ', 'EC ', 'OPENSSH ', 'ENCRYPTED ']) {
            const f = write(`k-${label.trim()}.pem`, `-----BEGIN ${label}PRIVATE KEY-----\nx\n`);
            expect(found([f]), label).toHaveLength(1);
        }
    });

    it('says nothing about a certificate, which is public', () => {
        const f = write('backend/cert.pem', '-----BEGIN CERTIFICATE-----\nMIIFhzCCA2\n');
        expect(found([f])).toHaveLength(0);
    });

    it('flags a container that holds nothing else, without reading it', () => {
        for (const name of ['store.p12', 'bundle.pfx', 'keys.jks', 'a.keystore']) {
            expect(found([name]), name).toHaveLength(1);
        }
    });

    it('says nothing about a file that is not key-shaped', () => {
        const f = write('notes.md', 'A key file starts with -----BEGIN PRIVATE KEY----- and then base64.\n');
        expect(found([f])).toHaveLength(0);
        expect(found(['src/keyboard.ts', 'monkey.png'])).toHaveLength(0);
    });

    it('is asked over tracked files, not only staged ones', () => {
        // Every other git check runs only when no patterns were given, which is
        // the pre-commit path. A key committed two years ago is not staged, and
        // that is the case this rule is for — so this uses a real repository
        // with a real commit rather than a list handed in.
        write('key.pem', '-----BEGIN PRIVATE KEY-----\nx\n');
        write('safe.ts', 'export const x = 1;\n');
        const git = (args: string) => cp.execSync(`git ${args}`, { cwd: sandbox, stdio: 'pipe' });
        git('init -q');
        git('config user.email t@example.org');
        git('config user.name Test');
        git('add -A');
        git('commit -qm committed');

        const staged = cp.execSync('git diff --cached --name-only', { cwd: sandbox, encoding: 'utf8' });
        expect(staged.trim()).toBe('');   // nothing is staged any more

        const seen = GitChecker.checkTracked(rules).filter(v => v.ruleId === 'VBC-949');
        expect(seen).toHaveLength(1);
        expect(seen[0].file).toBe('key.pem');
    });
});

describe('GitChecker — node_modules', () => {
    it('flags file inside node_modules/', () => {
        const violations = gitCheck(['node_modules/lodash/index.js']);
        const match = violations.filter(v => v.ruleId === 'VBC-006');
        expect(match.length).toBeGreaterThan(0);
    });

    it('does not flag regular src file', () => {
        const violations = gitCheck(['src/index.ts']);
        const match = violations.filter(v => v.ruleId === 'VBC-006');
        expect(match).toHaveLength(0);
    });
});

describe('GitChecker — too_many_staged_files', () => {
    it('flags when staged files exceed threshold', () => {
        const manyFiles = Array.from({ length: 35 }, (_, i) => `src/file${i}.ts`);
        const violations = gitCheck(manyFiles);
        const match = violations.filter(v => v.ruleId === 'VBC-922');
        expect(match.length).toBeGreaterThan(0);
    });

    it('does not flag under threshold', () => {
        const fewFiles = Array.from({ length: 5 }, (_, i) => `src/file${i}.ts`);
        const violations = gitCheck(fewFiles);
        const match = violations.filter(v => v.ruleId === 'VBC-922');
        expect(match).toHaveLength(0);
    });
});

describe('GitChecker — spaces_in_filenames', () => {
    it('flags file with spaces in name', () => {
        const violations = gitCheck(['src/my file.ts']);
        const match = violations.filter(v => v.ruleId === 'VBC-106');
        expect(match.length).toBeGreaterThan(0);
    });

    it('does not flag clean filename', () => {
        const violations = gitCheck(['src/myFile.ts']);
        const match = violations.filter(v => v.ruleId === 'VBC-106');
        expect(match).toHaveLength(0);
    });
});

describe('GitChecker — binary_file', () => {
    it('flags .png file', () => {
        const violations = gitCheck(['assets/logo.png']);
        const match = violations.filter(v => v.ruleId === 'VBC-046');
        expect(match.length).toBeGreaterThan(0);
    });

    it('does not flag .ts file', () => {
        const violations = gitCheck(['src/index.ts']);
        const match = violations.filter(v => v.ruleId === 'VBC-046');
        expect(match).toHaveLength(0);
    });
});

describe('GitChecker — committed_ide_settings', () => {
    it('flags .vscode/ path', () => {
        const violations = gitCheck(['.vscode/settings.json']);
        const match = violations.filter(v => v.ruleId === 'VBC-014');
        expect(match.length).toBeGreaterThan(0);
    });

    it('flags .idea/ path', () => {
        const violations = gitCheck(['.idea/workspace.xml']);
        const match = violations.filter(v => v.ruleId === 'VBC-014');
        expect(match.length).toBeGreaterThan(0);
    });

    it('does not flag src/ path', () => {
        const violations = gitCheck(['src/settings.ts']);
        const match = violations.filter(v => v.ruleId === 'VBC-014');
        expect(match).toHaveLength(0);
    });
});

describe('GitChecker — filename_too_long', () => {
    it('flags file with very long name', () => {
        const longName = 'src/' + 'a'.repeat(60) + '.ts';
        const violations = gitCheck([longName]);
        const match = violations.filter(v => v.ruleId === 'VBC-923');
        expect(match.length).toBeGreaterThan(0);
    });

    it('does not flag short filename', () => {
        const violations = gitCheck(['src/index.ts']);
        const match = violations.filter(v => v.ruleId === 'VBC-923');
        expect(match).toHaveLength(0);
    });
});

// The "missing X" rules read the working directory, so they need a real one.
describe('GitChecker — repository hygiene files', () => {
    const originalCwd = process.cwd();
    let sandbox: string;

    beforeEach(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-git-'));
        process.chdir(sandbox);
    });

    afterEach(() => {
        process.chdir(originalCwd);
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const cases: { ruleId: string; filename: string }[] = [
        { ruleId: 'VBC-025', filename: '.gitignore' },
        { ruleId: 'VBC-045', filename: 'LICENSE' },
        { ruleId: 'VBC-924', filename: 'README.md' },
        { ruleId: 'VBC-930', filename: 'CONTRIBUTING.md' },
        { ruleId: 'VBC-931', filename: 'SECURITY.md' },
        { ruleId: 'VBC-932', filename: 'CHANGELOG.md' },
    ];

    for (const { ruleId, filename } of cases) {
        it(`${ruleId} flags a project with no ${filename}`, () => {
            const found = gitCheck([]).filter(v => v.ruleId === ruleId);
            expect(found.length).toBeGreaterThan(0);
        });

        it(`${ruleId} is quiet once ${filename} exists`, () => {
            fs.writeFileSync(path.join(sandbox, filename), 'placeholder\n');
            const found = gitCheck([]).filter(v => v.ruleId === ruleId);
            expect(found).toHaveLength(0);
        });
    }

    it('VBC-925 flags a staged file over the size threshold', () => {
        const big = path.join(sandbox, 'blob.bin');
        fs.writeFileSync(big, Buffer.alloc(2 * 1024 * 1024));
        const found = gitCheck(['blob.bin']).filter(v => v.ruleId === 'VBC-925');
        expect(found.length).toBeGreaterThan(0);
    });

    it('VBC-925 is quiet for a small staged file', () => {
        fs.writeFileSync(path.join(sandbox, 'small.txt'), 'hello');
        const found = gitCheck(['small.txt']).filter(v => v.ruleId === 'VBC-925');
        expect(found).toHaveLength(0);
    });

    it('VBC-926 flags a commit message below the threshold', () => {
        fs.mkdirSync(path.join(sandbox, '.git'));
        fs.writeFileSync(path.join(sandbox, '.git', 'COMMIT_EDITMSG'), 'wip\n');
        const found = gitCheck([]).filter(v => v.ruleId === 'VBC-926');
        expect(found.length).toBeGreaterThan(0);
    });

    it('VBC-926 is quiet for a descriptive commit message', () => {
        fs.mkdirSync(path.join(sandbox, '.git'));
        fs.writeFileSync(path.join(sandbox, '.git', 'COMMIT_EDITMSG'),
            'fix: reset the scanner state between template spans\n');
        const found = gitCheck([]).filter(v => v.ruleId === 'VBC-926');
        expect(found).toHaveLength(0);
    });
});
