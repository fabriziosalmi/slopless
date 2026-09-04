import { describe, it, expect } from 'vitest';
import { problemWith, fixWouldBreak } from '../engine/fix-guard';

describe('problemWith', () => {
    it('accepts programs that are fine', () => {
        expect(problemWith('a.ts', 'const x: number = 1;\nexport function f(): number { return x; }\n')).toBeNull();
        expect(problemWith('a.tsx', 'export const C = () => <div className="x">{1 + 1}</div>;\n')).toBeNull();
        expect(problemWith('a.js', 'let a = 1;\nif (a) { let a = 2; console.log(a); }\n')).toBeNull();
        expect(problemWith('a.jsx', 'export default () => <span>ok</span>;\n')).toBeNull();
    });

    it('reports syntax that stopped matching', () => {
        expect(problemWith('a.ts', 'const x = (1 + ;\n')).toContain('Expression expected');
    });

    it('reports an early error, which syntax checking does not see', () => {
        // `parseDiagnostics` is empty for this: redeclaration is not a parse
        // error. `node --check` refuses it, and so does V8 here.
        const redeclared = 'function f() { let a = 10; let a = 20; }\n';
        expect(problemWith('a.ts', redeclared)).toContain('already been declared');
        expect(problemWith('a.tsx', 'export const C = () => { let a = 1; let a = 2; return <b>{a}</b>; };\n'))
            .toContain('already been declared');
    });
});

describe('fixWouldBreak', () => {
    const hoisted = 'function f() {\n  console.log(a);\n  var a = 10;\n  var a = 20;\n}\n';

    it('refuses the fix that the var-to-let rewrite would produce here', () => {
        const fixed = hoisted.replace(/\bvar\b/g, 'let');
        expect(fixWouldBreak('a.js', hoisted, fixed)).toContain('already been declared');
    });

    it('allows the same rewrite where it is safe', () => {
        const one = 'function f() {\n  var a = 10;\n  return a;\n}\n';
        expect(fixWouldBreak('a.js', one, one.replace(/\bvar\b/g, 'let'))).toBeNull();
    });

    it('has no opinion about a file that was already broken', () => {
        // Otherwise every fix in a file with a pre-existing problem would be
        // blamed on the fix.
        expect(fixWouldBreak('a.ts', 'const x = (1 + ;\n', 'const y = (2 + ;\n')).toBeNull();
    });

    it('has no opinion about a file it cannot read as a program', () => {
        expect(fixWouldBreak('a.py', 'def f():\n    pass\n', 'def f(:\n')).toBeNull();
        expect(fixWouldBreak('a.md', '# title\n', '# title\n\n(((\n')).toBeNull();
    });

    it('leaves a module with top-level await alone rather than guessing', () => {
        // Transpiling to CommonJS puts that await where it is not allowed, so
        // the file fails the pipeline before and after. Nothing is claimed.
        const before = 'const r = await fetch("/x");\nvar n = 1;\nexport { r, n };\n';
        const after = before.replace(/\bvar\b/g, 'let');
        expect(fixWouldBreak('a.ts', before, after)).toBeNull();
    });
});
