/**
 * Where a Markdown file is showing code rather than being prose.
 *
 * A rule about links, or about "coming soon", fires hardest on the document
 * that explains it: a CHANGELOG line describing Jekyll's `[CLI](cli.html)`, a
 * fenced block showing link syntax. Those are examples of the thing, not
 * instances of it, and CommonMark renders neither as a link.
 *
 * Two forms are recognised, which between them are how Markdown quotes code:
 *
 * - fenced blocks, ``` or ~~~ (three or more), indented at most three spaces,
 *   closed by a fence of the same character at least as long, or by the end of
 *   the file when nothing closes them;
 * - code spans, a run of N backticks closed by the next run of exactly N,
 *   within one paragraph.
 *
 * Indented code blocks are left out on purpose: four spaces is also how a list
 * item continues, and telling the two apart needs the whole block structure.
 * HTML comments are not code, so they are not here either.
 */

export interface Span {
    start: number;
    end: number;
}

const MARKDOWN_EXTENSIONS = new Set(['md', 'markdown', 'mdx']);

export function isMarkdown(ext: string): boolean {
    return MARKDOWN_EXTENSIONS.has(ext.toLowerCase());
}

const FENCE = /^ {0,3}(`{3,}|~{3,})/;

export function markdownCodeSpans(source: string): Span[] {
    const spans: Span[] = [];
    const lines = lineStarts(source);

    // Paragraph text between fences, gathered so code spans are only looked for
    // outside them: a backtick inside a fenced block pairs with nothing.
    const prose: Span[] = [];
    let proseStart = 0;
    let fence: { char: string; length: number; start: number } | null = null;

    for (let n = 0; n < lines.length; n++) {
        const start = lines[n];
        const end = n + 1 < lines.length ? lines[n + 1] : source.length;
        const text = source.slice(start, end).replace(/\r?\n$/, '');
        const marker = FENCE.exec(text);

        if (fence) {
            // A closing fence is the same character, at least as long, with
            // nothing after it but whitespace.
            if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length
                && text.slice(marker[0].length).trim() === '') {
                spans.push({ start: fence.start, end });
                fence = null;
                proseStart = end;
            }
            continue;
        }

        // A backtick fence cannot have a backtick in its info string, or it would
        // be a code span instead.
        if (marker && !(marker[1][0] === '`' && text.slice(marker[0].length).includes('`'))) {
            if (start > proseStart) prose.push({ start: proseStart, end: start });
            fence = { char: marker[1][0], length: marker[1].length, start };
        }
    }

    if (fence) {
        // Unclosed: CommonMark runs it to the end of the document.
        spans.push({ start: fence.start, end: source.length });
    } else if (proseStart < source.length) {
        prose.push({ start: proseStart, end: source.length });
    }

    for (const region of prose) {
        for (const paragraph of paragraphsOf(source, region)) {
            spans.push(...codeSpansIn(source, paragraph));
        }
    }

    return spans.sort((a, b) => a.start - b.start);
}

export function isInSpans(spans: Span[], offset: number): boolean {
    // Sorted and non-overlapping, so a binary search rather than a walk: this is
    // asked once per match, and a linear scan per match is how a helper like this
    // becomes quadratic on a long file.
    let low = 0;
    let high = spans.length - 1;
    while (low <= high) {
        const mid = (low + high) >> 1;
        if (offset < spans[mid].start) high = mid - 1;
        else if (offset >= spans[mid].end) low = mid + 1;
        else return true;
    }
    return false;
}

function lineStarts(source: string): number[] {
    const starts = [0];
    for (let i = 0; i < source.length; i++) {
        if (source[i] === '\n' && i + 1 < source.length) starts.push(i + 1);
    }
    return starts;
}

/** A code span cannot cross a blank line, so each paragraph is paired alone. */
function paragraphsOf(source: string, region: Span): Span[] {
    const paragraphs: Span[] = [];
    const blank = /\n[ \t]*\r?\n/g;
    blank.lastIndex = region.start;
    let start = region.start;
    let found: RegExpExecArray | null;
    while ((found = blank.exec(source)) !== null && found.index < region.end) {
        paragraphs.push({ start, end: found.index });
        start = found.index + found[0].length;
    }
    if (start < region.end) paragraphs.push({ start, end: region.end });
    return paragraphs;
}

/**
 * Pairs each run of backticks with the next run of the same length.
 *
 * Linear in the number of runs: one queue of positions per run length, and a
 * pointer into each that only ever moves forward. The naive version — search
 * ahead from every opener for its closer — is quadratic on a paragraph full of
 * unmatched backticks, which is exactly the input nobody writes by accident.
 */
function codeSpansIn(source: string, paragraph: Span): Span[] {
    const runs: { at: number; length: number }[] = [];
    for (let i = paragraph.start; i < paragraph.end;) {
        if (source[i] !== '`' || source[i - 1] === '\\') {
            i++;
            continue;
        }
        let j = i;
        while (j < paragraph.end && source[j] === '`') j++;
        runs.push({ at: i, length: j - i });
        i = j;
    }

    const byLength = new Map<number, number[]>();
    runs.forEach((run, index) => {
        const queue = byLength.get(run.length) ?? [];
        queue.push(index);
        byLength.set(run.length, queue);
    });
    const next = new Map<number, number>();

    const spans: Span[] = [];
    for (let index = 0; index < runs.length;) {
        const { at, length } = runs[index];
        const queue = byLength.get(length)!;
        let pointer = next.get(length) ?? 0;
        while (pointer < queue.length && queue[pointer] <= index) pointer++;
        next.set(length, pointer);

        if (pointer === queue.length) {
            index++;            // no closer: the backticks are literal text
            continue;
        }
        const closer = queue[pointer];
        spans.push({ start: at, end: runs[closer].at + length });
        index = closer + 1;     // runs inside the span are its content
    }
    return spans;
}
