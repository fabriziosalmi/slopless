import { describe, it, expect } from 'vitest';
import * as cp from 'child_process';
import * as path from 'path';

const script = path.resolve(__dirname, '../../scripts/changelog-notes.js');
const run = (arg: string) =>
    cp.execFileSync(process.execPath, [script, arg], { encoding: 'utf8' });

describe('changelog-notes', () => {
    it('extracts one version and stops at the next heading', () => {
        const notes = run('1.4.1');
        expect(notes).toContain('Marketplace');
        // The section below it must not bleed in.
        expect(notes).not.toContain('# 1.4.0');
        expect(notes).not.toContain('declares its repository');
    });

    it('accepts the tag form as well as the bare version', () => {
        expect(run('v1.4.1')).toEqual(run('1.4.1'));
    });

    it('falls back rather than failing on a version with no entry', () => {
        // A release job should not die because someone forgot the changelog.
        expect(run('99.0.0').trim()).toBe('Release 99.0.0.');
    });

    it('refuses to run with no argument', () => {
        expect(() => cp.execFileSync(process.execPath, [script], { stdio: 'pipe' })).toThrow();
    });
});
