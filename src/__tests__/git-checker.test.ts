import { describe, it, expect } from 'vitest';
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
