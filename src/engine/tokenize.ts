import { ProtectedRange } from './ast-utils';

// Where a rule is allowed to look, for languages the TypeScript scanner cannot
// read. This is deliberately a table rather than a parser per language: knowing
// which characters open a comment and which open a string is enough to answer
// "is this offset inside one", and that is the only question `scan:` asks.
//
// It will be wrong at the edges — a shell heredoc, an f-string with a brace
// expression inside it. That is worth saying plainly, and it is still a long way
// ahead of the alternative, which until now was no scope at all: every rule on
// these files read comments and string literals as if they were code.

interface StringForm {
    open: string;
    close: string;
    /** Absent means the form takes no escapes, so a backslash is just a byte. */
    escape?: string;
    /** A form that may not span lines ends at the newline, unterminated. */
    singleLine?: boolean;
}

interface BlockComment {
    open: string;
    close: string;
    nestable?: boolean;
}

interface Syntax {
    lineComments: string[];
    /** Line-comment markers that document the item below: `///`, `//!`. */
    docLineComments?: string[];
    /** Block-comment openers that document: `/**`, and Ruby's `=begin`. */
    docBlockComments?: string[];
    /**
     * Go documents by position rather than by marker: a plain `//` block sitting
     * immediately above a declaration is that declaration's documentation, and
     * the language requires one on everything exported.
     */
    docByPosition?: RegExp;
    blockComments: BlockComment[];
    strings: StringForm[];
    /** Rust `&'a str` opens no char literal. Checked before `'` is believed. */
    lifetimes?: boolean;
    /** `#` is only a comment at a word boundary: `${#a}` and `$#` are not. */
    hashNeedsBoundary?: boolean;
    /** A triple-quoted string alone on its line is a docstring, so documentation. */
    docstrings?: boolean;
}

const C_LIKE_STRINGS: StringForm[] = [
    { open: '"', close: '"', escape: '\\', singleLine: true },
    { open: "'", close: "'", escape: '\\', singleLine: true },
];

const SYNTAX: Record<string, Syntax> = {
    py: {
        lineComments: ['#'],
        blockComments: [],
        hashNeedsBoundary: false,
        docstrings: true,
        // Triple quotes are listed first so `"""` is never read as `""` then `"`.
        strings: [
            { open: '"""', close: '"""', escape: '\\' },
            { open: "'''", close: "'''", escape: '\\' },
            { open: '"', close: '"', escape: '\\', singleLine: true },
            { open: "'", close: "'", escape: '\\', singleLine: true },
        ],
    },
    go: {
        lineComments: ['//'],
        docByPosition: /^\s*(?:package|func|type|var|const)\b/,
        blockComments: [{ open: '/*', close: '*/' }],
        strings: [
            { open: '`', close: '`' },              // raw: spans lines, no escapes
            { open: '"', close: '"', escape: '\\', singleLine: true },
            { open: "'", close: "'", escape: '\\', singleLine: true },
        ],
    },
    rs: {
        lineComments: ['//'],
        docLineComments: ['///', '//!'],
        // Rust block comments nest, and a rule that stopped at the first `*/`
        // would call the rest of the file code.
        blockComments: [{ open: '/*', close: '*/', nestable: true }],
        lifetimes: true,
        strings: [
            { open: '"', close: '"', escape: '\\' },
            { open: "'", close: "'", escape: '\\', singleLine: true },
        ],
    },
    sh: {
        lineComments: ['#'],
        blockComments: [],
        hashNeedsBoundary: true,
        strings: [
            { open: "'", close: "'" },              // no escapes at all in shell
            { open: '"', close: '"', escape: '\\' },
        ],
    },
    // An .astro file is TypeScript frontmatter between --- fences and then HTML.
    // One table cannot switch modes halfway, but it does not need to: both halves
    // are covered by accepting each other's comment and string forms.
    astro: {
        lineComments: ['//'],
        blockComments: [{ open: '/*', close: '*/' }, { open: '<!--', close: '-->' }],
        docBlockComments: ['/**'],
        strings: [
            { open: '`', close: '`', escape: '\\' },
            { open: '"', close: '"', escape: '\\', singleLine: true },
            { open: "'", close: "'", escape: '\\', singleLine: true },
        ],
    },
    java: { lineComments: ['//'], docBlockComments: ['/**'], blockComments: [{ open: '/*', close: '*/' }], strings: C_LIKE_STRINGS },
    c: { lineComments: ['//'], docBlockComments: ['/**'], blockComments: [{ open: '/*', close: '*/' }], strings: C_LIKE_STRINGS },
    cs: { lineComments: ['//'], docBlockComments: ['/**'], blockComments: [{ open: '/*', close: '*/' }], strings: C_LIKE_STRINGS },
    kt: { lineComments: ['//'], docBlockComments: ['/**'], blockComments: [{ open: '/*', close: '*/', nestable: true }], strings: C_LIKE_STRINGS },
    swift: { lineComments: ['//'], docBlockComments: ['/**'], blockComments: [{ open: '/*', close: '*/', nestable: true }], strings: C_LIKE_STRINGS },
    rb: {
        lineComments: ['#'],
        blockComments: [{ open: '=begin', close: '=end' }],
        hashNeedsBoundary: true,
        strings: C_LIKE_STRINGS,
    },
};

const ALIASES: Record<string, string> = {
    bash: 'sh', zsh: 'sh', h: 'c', hpp: 'c', cpp: 'c', cc: 'c', cxx: 'c',
    pyi: 'py', kts: 'kt', rake: 'rb',
};

export function supportsTokenizing(ext: string): boolean {
    const key = ext.toLowerCase();
    return (ALIASES[key] ?? key) in SYNTAX;
}

export function tokenizedLanguages(): string[] {
    return [...Object.keys(SYNTAX), ...Object.keys(ALIASES)].sort();
}

export function protectedRangesFor(ext: string, source: string): ProtectedRange[] {
    const key = ext.toLowerCase();
    const syntax = SYNTAX[ALIASES[key] ?? key];
    if (!syntax) return [];

    const ranges: ProtectedRange[] = [];
    let i = 0;

    while (i < source.length) {
        const rust = syntax.lifetimes ? rawStringAt(source, i) : -1;
        if (rust >= 0) {
            ranges.push({ start: i, end: rust, type: 'string' });
            i = rust;
            continue;
        }

        const line = syntax.lineComments.find(marker => startsWith(source, i, marker)
            && (marker !== '#' || !syntax.hashNeedsBoundary || atWordBoundary(source, i)));
        if (line) {
            const end = indexOrEnd(source, '\n', i);
            const marked = syntax.docLineComments?.some(m => startsWith(source, i, m));
            // Go has no doc marker: the block above a declaration is its
            // documentation, so the run of comment lines is looked at as one.
            const positional = syntax.docByPosition
                && syntax.docByPosition.test(lineAfterCommentRun(source, end, line));
            ranges.push({ start: i, end, type: 'comment', doc: marked || positional ? true : undefined });
            i = end;
            continue;
        }

        const block = syntax.blockComments.find(b => startsWith(source, i, b.open));
        if (block) {
            const end = endOfBlock(source, i, block);
            const isDoc = syntax.docBlockComments?.some(m => startsWith(source, i, m));
            ranges.push({ start: i, end, type: 'comment', doc: isDoc ? true : undefined });
            i = end;
            continue;
        }

        const form = syntax.strings.find(s => startsWith(source, i, s.open));
        if (form && !(syntax.lifetimes && form.open === "'" && isLifetime(source, i))) {
            const end = endOfString(source, i, form);
            // A docstring is prose that happens to be a string value. Reading it
            // as a string means a rule about strings fires on documentation —
            // which is how a docstring explaining an SSRF defence got reported as
            // an insecure URL.
            const isDoc = syntax.docstrings && form.open.length === 3 && aloneOnItsLine(source, i);
            ranges.push({ start: i, end, type: isDoc ? 'comment' : 'string', doc: isDoc ? true : undefined });
            i = end;
            continue;
        }

        i++;
    }
    return ranges;
}

// Nothing but whitespace between the start of the line and this offset.
function aloneOnItsLine(source: string, at: number): boolean {
    let i = at - 1;
    while (i >= 0 && source[i] !== '\n') {
        if (!/\s/.test(source[i])) return false;
        i--;
    }
    return true;
}

/** The first line after an unbroken run of line comments starting at `from`. */
function lineAfterCommentRun(source: string, from: number, marker: string): string {
    let i = from;
    while (i < source.length) {
        const end = indexOrEnd(source, '\n', i + 1);
        const line = source.slice(i + 1, end);
        if (!line.trimStart().startsWith(marker)) return line;
        i = end;
    }
    return '';
}

function startsWith(source: string, at: number, text: string): boolean {
    return source.startsWith(text, at);
}

function indexOrEnd(source: string, needle: string, from: number): number {
    const found = source.indexOf(needle, from);
    return found === -1 ? source.length : found;
}

// `#` opens a comment at the start of a word, so `$#` and `${#name}` do not.
function atWordBoundary(source: string, at: number): boolean {
    if (at === 0) return true;
    return /[\s;&|(]/.test(source[at - 1]);
}

function endOfBlock(source: string, at: number, block: BlockComment): number {
    let depth = 0;
    let i = at;
    while (i < source.length) {
        if (block.nestable && startsWith(source, i, block.open)) {
            depth++;
            i += block.open.length;
            continue;
        }
        if (startsWith(source, i, block.close)) {
            if (!block.nestable) return i + block.close.length;
            depth--;
            i += block.close.length;
            if (depth <= 0) return i;
            continue;
        }
        if (!block.nestable && startsWith(source, i, block.open)) i += block.open.length;
        else i++;
    }
    return source.length;
}

function endOfString(source: string, at: number, form: StringForm): number {
    let i = at + form.open.length;
    while (i < source.length) {
        if (form.escape && startsWith(source, i, form.escape)) {
            i += form.escape.length + 1;
            continue;
        }
        // An unterminated single-line string ends at the newline rather than
        // swallowing the rest of the file, which is what a typo would do.
        if (form.singleLine && source[i] === '\n') return i;
        if (startsWith(source, i, form.close)) return i + form.close.length;
        i++;
    }
    return source.length;
}

// `&'a str` and `'static` are lifetimes. A char literal closes within a few
// characters; a lifetime is an identifier with no closing quote on the line.
function isLifetime(source: string, at: number): boolean {
    const rest = source.slice(at + 1, at + 32);
    if (/^\\/.test(rest)) return false;                 // '\n' is a char literal
    return /^[A-Za-z_][A-Za-z0-9_]*(?!')/.test(rest) && !/^[A-Za-z_]'/.test(rest);
}

// Rust raw strings carry their own delimiter length: r"...", r#"..."#, r##"..."##.
function rawStringAt(source: string, at: number): number {
    const match = /^r(#*)"/.exec(source.slice(at, at + 40));
    if (!match) return -1;
    const close = '"' + match[1];
    const from = at + match[0].length;
    const found = source.indexOf(close, from);
    return found === -1 ? source.length : found + close.length;
}
