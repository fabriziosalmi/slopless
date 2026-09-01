import { describe, it, expect } from 'vitest';
import { testRegionsFor, isInTestRegion, supportsTestRegions } from '../engine/test-regions';

/** Whether the first occurrence of `needle` falls inside a test region. */
function inTest(ext: string, source: string, needle: string) {
    const at = source.indexOf(needle);
    expect(at, `"${needle}" should appear in the sample`).toBeGreaterThan(-1);
    return isInTestRegion(testRegionsFor(ext, source), at);
}

describe('which languages keep tests inside the source file', () => {
    it('covers Rust, which is why this exists', () => {
        expect(supportsTestRegions('rs')).toBe(true);
    });

    it('claims nothing about a language with no inline convention', () => {
        // Go keeps its tests in _test.go, which exclude_files already handles.
        expect(supportsTestRegions('go')).toBe(false);
        expect(testRegionsFor('go', 'func TestThing(t *testing.T) {}')).toEqual([]);
    });
});

describe('rust', () => {
    const file = `
fn connect() -> String {
    "http://api.internal".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_connects() {
        assert_eq!(connect(), "http://api.internal");
    }
}
`;

    it('covers the whole test module', () => {
        expect(inTest('rs', file, 'assert_eq!')).toBe(true);
    });

    it('leaves the code under test alone', () => {
        expect(inTest('rs', file, 'fn connect')).toBe(false);
        expect(inTest('rs', file, '"http://api.internal".to_string')).toBe(false);
    });

    it('ends the module at its own closing brace, not the first one', () => {
        const after = file + '\nfn after() { danger(); }\n';
        expect(inTest('rs', after, 'danger')).toBe(false);
    });

    it('handles an attribute with no block, which ends at the semicolon', () => {
        const src = '#[cfg(test)]\nuse super::helpers;\n\nfn real() { danger(); }\n';
        expect(inTest('rs', src, 'helpers')).toBe(true);
        expect(inTest('rs', src, 'danger')).toBe(false);
    });

    it('is not fooled by a brace inside a string or a comment', () => {
        const src = '#[cfg(test)]\nmod tests {\n    let s = "}";\n    // }\n    assert!(x);\n}\nfn real() { danger(); }\n';
        expect(inTest('rs', src, 'assert!')).toBe(true);
        expect(inTest('rs', src, 'danger')).toBe(false);
    });

    it('ignores the attribute when it is only mentioned in a comment', () => {
        const src = '// see the #[cfg(test)] block below\nfn real() { danger(); }\n';
        expect(inTest('rs', src, 'danger')).toBe(false);
    });

    it('does not open a second region for an attribute nested in the first', () => {
        const src = '#[cfg(test)]\nmod tests {\n    #[cfg(test)]\n    fn inner() { assert!(x); }\n}\nfn real() { danger(); }\n';
        expect(testRegionsFor('rs', src)).toHaveLength(1);
        expect(inTest('rs', src, 'danger')).toBe(false);
    });
});

describe('typescript', () => {
    const src = 'export const url = "http://a";\n\ndescribe("thing", () => {\n  it("works", () => {\n    expect(fetchFrom("http://b")).toBe(1);\n  });\n});\n\nconst after = "http://c";\n';

    it('covers a suite left in a source file', () => {
        expect(inTest('ts', src, '"http://b"')).toBe(true);
    });

    it('leaves everything outside it alone', () => {
        expect(inTest('ts', src, '"http://a"')).toBe(false);
        expect(inTest('ts', src, '"http://c"')).toBe(false);
    });
});

describe('the real spellings of a Rust test attribute', () => {
    const inTest = (source: string, needle: string) => {
        const at = source.indexOf(needle);
        expect(at, needle).toBeGreaterThan(-1);
        return isInTestRegion(testRegionsFor('rs', source), at);
    };

    it('covers cfg(all(test, ...)) and cfg(any(test, ...))', () => {
        // Only the bare form was matched, and 96 unwraps in test setup were
        // read as production code because of it.
        expect(inTest('#[cfg(all(test, unix))]\nmod t {\n  fn f() { danger(); }\n}\n', 'danger')).toBe(true);
        expect(inTest('#[cfg(any(test, feature = "x"))]\nmod t {\n  fn f() { danger(); }\n}\n', 'danger')).toBe(true);
    });

    it('covers a single function marked #[test] or #[tokio::test]', () => {
        expect(inTest('#[test]\nfn it_works() { danger(); }\n', 'danger')).toBe(true);
        expect(inTest('#[tokio::test]\nasync fn it_works() { danger(); }\n', 'danger')).toBe(true);
    });

    it('leaves an ordinary attribute alone', () => {
        expect(inTest('#[derive(Debug)]\nstruct S;\nfn f() { danger(); }\n', 'danger')).toBe(false);
        expect(inTest('#[cfg(unix)]\nfn f() { danger(); }\n', 'danger')).toBe(false);
        expect(inTest('#[allow(clippy::latest)]\nfn f() { danger(); }\n', 'danger')).toBe(false);
    });
});
