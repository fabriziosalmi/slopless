import { describe, it, expect } from 'vitest';
import { protectedRangesFor, supportsTokenizing } from '../engine/tokenize';
import { scopeAt } from '../engine/ast-utils';

/** The scope of the first occurrence of `needle`. */
function scopeOf(ext: string, source: string, needle: string) {
    const at = source.indexOf(needle);
    expect(at, `"${needle}" should appear in the sample`).toBeGreaterThan(-1);
    return scopeAt(protectedRangesFor(ext, source), at);
}

describe('which languages are tokenized', () => {
    it('covers the ones the TypeScript scanner cannot read', () => {
        for (const ext of ['py', 'go', 'rs', 'sh', 'bash', 'java', 'c', 'cpp', 'rb', 'kt', 'swift']) {
            expect(supportsTokenizing(ext), ext).toBe(true);
        }
    });

    it('claims nothing about a language with no table', () => {
        expect(supportsTokenizing('zig')).toBe(false);
        expect(protectedRangesFor('zig', '// not really a comment')).toEqual([]);
    });
});

describe('python', () => {
    it('reads a # comment as a comment', () => {
        expect(scopeOf('py', '# see http://x/y\nu = 1\n', 'http')).toBe('comment');
    });

    it('reads a docstring as documentation, not as a string value', () => {
        // A docstring explaining an SSRF defence was reported as an insecure URL.
        const src = 'def f():\n    """We refuse http://169.254.169.254 here."""\n    return 1\n';
        expect(scopeOf('py', src, 'http')).toBe('comment');
    });

    it('still reads an assigned triple-quoted string as a string', () => {
        const src = 'doc = """http://legacy/v1"""\n';
        expect(scopeOf('py', src, 'http')).toBe('string');
    });

    it('does not let a quote inside a docstring end it early', () => {
        const src = 'def f():\n    """It\'s fine. http://x/y"""\n';
        expect(scopeOf('py', src, 'http')).toBe('comment');
    });

    it('leaves code as code', () => {
        expect(scopeOf('py', 'url = "a"\nconnect(url)\n', 'connect')).toBe('code');
    });
});

describe('go', () => {
    it('reads // and /* */', () => {
        expect(scopeOf('go', '// http://x\n', 'http')).toBe('comment');
        expect(scopeOf('go', '/* http://x */\n', 'http')).toBe('comment');
    });

    it('reads a backtick raw string across lines', () => {
        expect(scopeOf('go', 'const q = `\nhttp://x\n`\n', 'http')).toBe('string');
    });

    it('does not treat an apostrophe in a comment as a char literal', () => {
        // `it's` opening a string would swallow the code after it.
        expect(scopeOf('go', "// it's fine\nDoThing()\n", 'DoThing')).toBe('code');
    });
});

describe('rust', () => {
    it('nests block comments, so the file does not end at the first close', () => {
        const src = '/* outer /* inner */ still comment */\nfn main() {}\n';
        expect(scopeOf('rs', src, 'still')).toBe('comment');
        expect(scopeOf('rs', src, 'fn main')).toBe('code');
    });

    it('reads a raw string with hashes', () => {
        expect(scopeOf('rs', 'let s = r#"http://x "quoted" y"#;\nnext();\n', 'http')).toBe('string');
        expect(scopeOf('rs', 'let s = r#"http://x "quoted" y"#;\nnext();\n', 'next')).toBe('code');
    });

    it('does not read a lifetime as a char literal', () => {
        // &'a str opening a string would mark the rest of the function as one.
        const src = "fn f<'a>(s: &'a str) -> &'a str { danger(s) }\n";
        expect(scopeOf('rs', src, 'danger')).toBe('code');
    });

    it('still reads a real char literal', () => {
        expect(scopeOf('rs', "let c = 'x';\n", "'x'")).toBe('string');
        expect(scopeOf('rs', "let c = '\\n';\n", "'\\n'")).toBe('string');
    });
});

describe('shell', () => {
    it('reads # as a comment only at a word boundary', () => {
        expect(scopeOf('sh', '# http://x\n', 'http')).toBe('comment');
        // ${#name} is a length, not the start of a comment.
        expect(scopeOf('sh', 'n=${#items}\nrun_it\n', 'run_it')).toBe('code');
    });

    it('takes no escapes inside single quotes', () => {
        expect(scopeOf('sh', "s='a\\'\nafter\n", 'after')).toBe('code');
    });
});

describe('unterminated forms do not swallow the file', () => {
    it('ends a single-line string at the newline', () => {
        // A stray quote used to mark everything after it as a string.
        expect(scopeOf('go', 'a := "oops\nDoThing()\n', 'DoThing')).toBe('code');
        expect(scopeOf('py', "s = 'oops\nconnect()\n", 'connect')).toBe('code');
    });
});
