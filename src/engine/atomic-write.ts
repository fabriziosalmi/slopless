import * as fs from 'fs';
import * as path from 'path';

/**
 * Replaces a file's contents without ever leaving it half-written.
 *
 * `fs.writeFileSync` opens with O_TRUNC, so between the truncate and the last
 * byte the file on disk is neither the old version nor the new one. For the
 * report that is survivable; for the user's source under `--fix` it is not,
 * because that is the one thing here nobody can regenerate. `action.yml` already
 * builds the report in a temp file and moves it into place only once it parses —
 * this is the same move, applied to the input rather than the output.
 *
 * The temporary file is a sibling so the rename stays on one filesystem, where
 * it is atomic. The mode is copied across first: a fresh file is 0644, and
 * renaming that over a `#!` script would take away its executable bit.
 */
export function writeAtomically(file: string, contents: string): void {
    const temporary = path.join(
        path.dirname(file),
        `.${path.basename(file)}.slopless-${process.pid}.tmp`,
    );

    try {
        fs.writeFileSync(temporary, contents, 'utf8');
        try {
            fs.chmodSync(temporary, fs.statSync(file).mode);
        } catch {
            // No original to copy from, or a filesystem with no modes to copy.
            // The contents matter more than the bits, so carry on.
        }
        fs.renameSync(temporary, file);
    } catch (error) {
        // A rename that failed leaves the original untouched, which is the point.
        // What it must not leave behind is the half-written sibling.
        try {
            fs.unlinkSync(temporary);
        } catch {
            // Already gone, which is the outcome we wanted anyway.
        }
        throw error;
    }
}
