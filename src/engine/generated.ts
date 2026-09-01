import * as fs from 'fs';

/** Files above this average line length were written by a tool, not a person. */
const BYTES_PER_LINE_LIMIT = 500;
/** A single line this long is machine output whatever the average says. */
const LONGEST_LINE_LIMIT = 2000;
/** Reading the whole of a large bundle to classify it is wasted work. */
const SAMPLE_BYTES = 64 * 1024;

/**
 * Whether a file is machine output rather than something someone wrote.
 *
 * Detected by shape, not by name: `bundle.min.js` is obvious, `bundle.js` is not,
 * and every rule fires on both. Hand-written source runs 25 to 50 bytes per line;
 * minified output runs into the thousands, so the two do not overlap.
 */
export function isGeneratedFile(filePath: string, content?: string): boolean {
    let sample = content;
    if (sample === undefined) {
        try {
            const handle = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(SAMPLE_BYTES);
            const read = fs.readSync(handle, buffer, 0, SAMPLE_BYTES, 0);
            fs.closeSync(handle);
            sample = buffer.subarray(0, read).toString('utf8');
        } catch {
            return false;
        }
    }
    if (sample.length === 0) return false;

    const lines = sample.split('\n');
    // Drop the final fragment: a truncated sample always ends mid-line.
    if (content === undefined && lines.length > 1) lines.pop();
    if (lines.length === 0) return false;

    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const average = sample.length / lines.length;
    return average > BYTES_PER_LINE_LIMIT || longest > LONGEST_LINE_LIMIT;
}
