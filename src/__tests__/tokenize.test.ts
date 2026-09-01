import { describe, it, expect } from 'vitest';
import { protectedRangesFor, supportsTokenizing } from '../engine/tokenize';
import { scopeAt, markFileHeader, extractProtectedRanges } from '../engine/ast-utils';

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

describe('documentation is not the same as a note beside the code', () => {
    const docAt = (ext: string, source: string, needle: string) => {
        const at = source.indexOf(needle);
        expect(at, needle).toBeGreaterThan(-1);
        return protectedRangesFor(ext, source).some(r => r.doc && at >= r.start && at < r.end);
    };

    it('reads Rust /// and //! as documentation', () => {
        expect(docAt('rs', '/// Connects to the bus.\nfn go() {}\n', 'Connects')).toBe(true);
        expect(docAt('rs', '//! Crate docs.\nfn go() {}\n', 'Crate')).toBe(true);
    });

    it('leaves an ordinary Rust comment ordinary', () => {
        expect(docAt('rs', '// tidy this up later\nfn go() {}\n', 'tidy')).toBe(false);
    });

    it('reads a Go comment above a declaration as documentation', () => {
        // Go has no marker: position is the convention, and it is mandatory.
        const src = '// Package waf implements a firewall.\npackage waf\n';
        expect(docAt('go', src, 'implements')).toBe(true);
    });

    it('reads a whole run of Go comment lines, not just the last', () => {
        const src = '// Serve handles a request.\n// It returns an error when the upstream is down.\nfunc Serve() {}\n';
        expect(docAt('go', src, 'Serve handles')).toBe(true);
        expect(docAt('go', src, 'upstream is down')).toBe(true);
    });

    it('leaves a Go comment inside a function alone', () => {
        const src = 'func Serve() {\n\t// skip the cache here\n\treturn nil\n}\n';
        expect(docAt('go', src, 'skip the cache')).toBe(false);
    });

    it('reads a Python docstring as documentation', () => {
        expect(docAt('py', 'def f():\n    """Does a thing."""\n', 'Does a thing')).toBe(true);
    });

    it('reads /** */ as documentation and /* */ as a comment', () => {
        expect(docAt('java', '/** Adds two numbers. */\nint add() {}\n', 'Adds two')).toBe(true);
        expect(docAt('java', '/* fix later */\nint add() {}\n', 'fix later')).toBe(false);
    });
});

describe('the comments at the top of a file are its header', () => {
    const header = (ext: string, source: string, needle: string) => {
        const at = source.indexOf(needle);
        expect(at, needle).toBeGreaterThan(-1);
        const ranges = markFileHeader(
            ext === 'ts' ? extractProtectedRanges(source, true) : protectedRangesFor(ext, source), source);
        return ranges.some(r => r.doc && at >= r.start && at < r.end);
    };

    it('marks a licence block and the banner under it', () => {
        // 79 findings in one project were file banners explaining the module.
        const src = '/*\n * Copyright 2026.\n */\n\n// Wasm Core Bridge\n// Lazy-loads the module.\n\nimport x from "y";\n';
        expect(header('ts', src, 'Copyright')).toBe(true);
        expect(header('ts', src, 'Lazy-loads')).toBe(true);
    });

    it('stops at the first line of code', () => {
        const src = '// header\nimport x from "y";\n\n// a note about the next line\nconst a = 1;\n';
        expect(header('ts', src, 'header')).toBe(true);
        expect(header('ts', src, 'a note about')).toBe(false);
    });

    it('works the same in a language the scanner cannot read', () => {
        const src = '# Copyright 2026.\n# Module notes.\n\nimport os\n\n# an ordinary note\nx = 1\n';
        expect(header('py', src, 'Copyright')).toBe(true);
        expect(header('py', src, 'ordinary note')).toBe(false);
    });

    it('marks nothing when the file opens with code', () => {
        expect(header('ts', 'const a = 1;\n// a note\n', 'a note')).toBe(false);
    });
});

describe('a regular expression literal is not code', () => {
    const scopeTs = (source: string, needle: string) => {
        const at = source.indexOf(needle);
        expect(at, needle).toBeGreaterThan(-1);
        return scopeAt(extractProtectedRanges(source, true), at);
    };

    it('gives a regex literal its own scope, which is neither code nor a string', () => {
        // /(?:package|func|var)/ reported a `var` the project does not contain.
        // Calling it a string then had a rule about URLs read /^https?:\\/\\//.
        expect(scopeTs('const re = /^(?:package|var|const)\\b/;\n', 'var')).toBe('regex');
    });

    it('still reads division as division', () => {
        // The scanner reports whitespace, so the token before the slash was a
        // space and every division opened a regex that ran to the next slash.
        expect(scopeTs('const half = total / 2;\nconst x = 1;\n', '2;')).toBe('code');
        expect(scopeTs('const yiq = ((r * 299) + (b * 114)) / 1000;\nconst x = 1;\n', '1000')).toBe('code');
        expect(scopeTs('const r = (a + b) / c / d;\nconst leftover = 1;\n', 'd;')).toBe('code');
        expect(scopeTs('const n = count/2;\nconst m = 3;\n', '2;')).toBe('code');
    });

    it('reads a regex after a keyword, and division after a value', () => {
        expect(scopeTs('return /var x/.test(s);\n', 'var x')).toBe('regex');
        expect(scopeTs('const q = items.length / 2;\nvar after = 1;\n', 'after')).toBe('code');
    });

    it('does not let a slash inside a regex end it early', () => {
        expect(scopeTs('const re = /a\\/b var/;\nconst after = 1;\n', 'after')).toBe('code');
    });

    it('reads a regex where a value cannot appear, even after a newline', () => {
        expect(scopeTs('const ok = [\n  /var x/,\n];\n', 'var x')).toBe('regex');
    });

    it('calls a slash after a closing paren division, which is the safe guess', () => {
        // `if (x) /re/.test(s)` is a regex and this reads it as division, so its
        // body is scanned as code. Telling the two apart means knowing whether
        // the paren closed a condition or an expression, which needs a parser.
        // The other guess is worse: it swallows real code up to the next slash,
        // which is how `(a + b) / 1000` hid the rest of a file.
        expect(scopeTs('if (x) /var y/.test(s);\n', 'var y')).toBe('code');
    });
});
