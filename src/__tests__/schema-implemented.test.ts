import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { RuleLoader } from '../engine/loader';

// `circular-dependency` sat in the heuristic_check enum with no branch behind it.
// A rule naming it would load, validate, and quietly check nothing — the same
// shape as an unknown --only category, and just as invisible.
const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
const schema = read('engine/schema.ts');

const CHECKERS: Record<string, string> = {
    heuristic_check: 'checkers/heuristic-checker.ts',
    semantic_check: 'checkers/semantic-checker.ts',
    type_check: 'checkers/type-checker.ts',
    ast_check: 'checkers/ast-checker.ts',
    git_check: 'checkers/git-checker.ts',
};

/** The quoted names inside `<field>: z.enum([ ... ])`, comments and all. */
function valuesOf(field: string): string[] {
    const start = schema.indexOf(`${field}:`);
    expect(start, `${field} should be declared in schema.ts`).toBeGreaterThan(-1);
    const open = schema.indexOf('[', start);
    const close = schema.indexOf(']', open);
    expect(open, `${field} should enumerate its checks`).toBeGreaterThan(-1);
    return [...schema.slice(open, close).matchAll(/'([^']+)'/g)].map(m => m[1]);
}

describe('the schema only accepts checks that exist', () => {
    for (const [field, file] of Object.entries(CHECKERS)) {
        it(`has an implementation for every ${field}`, () => {
            const values = valuesOf(field);
            expect(values.length).toBeGreaterThan(0);
            const code = read(file);
            for (const value of values) {
                expect(code.includes(`'${value}'`),
                    `${field}: '${value}' is accepted by the schema but never handled in ${file}`).toBe(true);
            }
        });
    }
});

// A repeated key wins silently in YAML. A rule file with two `quiet:` blocks
// keeps the second, drops the first, and every test stays green.
describe('rule files are rejected when a key repeats', () => {
    const load = (text: string) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-rules-'));
        fs.writeFileSync(path.join(dir, 'probe.yaml'), text);
        const errors: string[] = [];
        const spy = vi.spyOn(console, 'error')
            .mockImplementation((...args) => { errors.push(args.map(a => String(a)).join(' ')); });
        const rules = RuleLoader.loadRules([dir]);
        spy.mockRestore();
        fs.rmSync(dir, { recursive: true, force: true });
        return { rules, errors };
    };

    const base = [
        'id: VBC-999', 'name: probe', 'severity: error', 'category: core',
        'match:', '  regex: xyzzy', '  file_types:', '    - ts',
        'message: probe', 'tests:', '  fire:', '    - xyzzy',
    ].join('\n');

    it('loads a rule whose keys are unique', () => {
        const { rules, errors } = load(`${base}\n  quiet:\n    - safe\n`);
        expect(errors).toHaveLength(0);
        expect(rules.map(r => r.id)).toContain('VBC-999');
    });

    it('refuses a rule that would silently lose half its examples', () => {
        const { rules, errors } = load(`${base}\n  quiet:\n    - safe\n  quiet:\n    - other\n`);
        expect(rules.map(r => r.id)).not.toContain('VBC-999');
        expect(errors.join('\n')).toContain("duplicate key 'quiet'");
    });

    it('lets two list items carry the same key, which is not a duplicate', () => {
        const { errors } = load(
            `${base}\n  quiet:\n    - file: a.ts\n      code: one\n    - file: b.ts\n      code: two\n`);
        expect(errors).toHaveLength(0);
    });

    it('reads a literal block as text, not as a mapping', () => {
        // A CSS fixture is full of `outline: none;` and is not YAML structure.
        const { errors } = load(
            `${base}\n  quiet:\n    - |\n      a { outline: none; }\n      b { outline: none; }\n`);
        expect(errors).toHaveLength(0);
    });
});
