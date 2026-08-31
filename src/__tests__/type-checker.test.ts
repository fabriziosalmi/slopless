import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ts from 'typescript';
import { TypeCheckerEngine } from '../checkers/type-checker';
import { RuleLoader } from '../engine/loader';

const RULES_DIR = path.resolve(__dirname, '../../rules');
const rules = RuleLoader.loadRules([RULES_DIR]).filter(rule => rule.id === 'VBC-800');

/** VBC-800 resolves types, so it needs a real Program rather than a snippet. */
function checkSource(source: string) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-types-'));
    const file = path.join(dir, 'subject.ts');
    fs.writeFileSync(file, source);
    try {
        const program = ts.createProgram([file], {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            strict: true,
            noEmit: true,
        });
        return TypeCheckerEngine.check(file, rules, program, program.getTypeChecker());
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('TypeCheckerEngine — VBC-800 floating-promise', () => {
    it('flags an async call whose promise is dropped', () => {
        const violations = checkSource(`
async function save(): Promise<void> {}
function run(): void {
    save();
}
`);
        expect(violations.map(v => v.ruleId)).toContain('VBC-800');
    });

    it('is quiet when the promise is awaited', () => {
        const violations = checkSource(`
async function save(): Promise<void> {}
async function run(): Promise<void> {
    await save();
}
`);
        expect(violations).toHaveLength(0);
    });

    it('is quiet when the promise is handled with .catch()', () => {
        const violations = checkSource(`
async function save(): Promise<void> {}
function run(): void {
    save().catch(() => {});
}
`);
        expect(violations).toHaveLength(0);
    });

    it('is quiet for a synchronous call', () => {
        const violations = checkSource(`
function save(): void {}
function run(): void {
    save();
}
`);
        expect(violations).toHaveLength(0);
    });
});
