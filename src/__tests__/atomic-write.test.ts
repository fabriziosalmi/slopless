import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeAtomically } from '../engine/atomic-write';

describe('writeAtomically', () => {
    let sandbox: string;

    beforeEach(() => {
        sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-atomic-')));
    });
    afterEach(() => {
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const file = (name: string, body: string) => {
        const full = path.join(sandbox, name);
        fs.writeFileSync(full, body);
        return full;
    };

    it('replaces the contents', () => {
        const target = file('a.ts', 'var x = 1;\n');
        writeAtomically(target, 'let x = 1;\n');
        expect(fs.readFileSync(target, 'utf8')).toBe('let x = 1;\n');
    });

    it('creates a file that was not there', () => {
        const target = path.join(sandbox, 'new.ts');
        writeAtomically(target, 'contents\n');
        expect(fs.readFileSync(target, 'utf8')).toBe('contents\n');
    });

    it('keeps the executable bit, so fixing a #! script does not disarm it', () => {
        const target = file('run.sh', '#!/usr/bin/env bash\necho hi\n');
        fs.chmodSync(target, 0o755);
        writeAtomically(target, '#!/usr/bin/env bash\necho hello\n');
        // The mode a fresh file gets is 0644, so an unguarded rename would drop this.
        expect(fs.statSync(target).mode & 0o111).not.toBe(0);
    });

    it('leaves nothing behind', () => {
        const target = file('a.ts', 'before\n');
        writeAtomically(target, 'after\n');
        expect(fs.readdirSync(sandbox)).toEqual(['a.ts']);
    });

    it('leaves the original alone when the write cannot land', () => {
        // A directory where the file should be: the rename has nowhere to go.
        const target = path.join(sandbox, 'occupied');
        fs.mkdirSync(target);
        expect(() => writeAtomically(target, 'anything')).toThrow();
        expect(fs.statSync(target).isDirectory()).toBe(true);
        // And the half-written sibling is not still sitting there.
        expect(fs.readdirSync(sandbox)).toEqual(['occupied']);
    });
});
