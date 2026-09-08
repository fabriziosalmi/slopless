import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AnalysisCache } from '../engine/cache';
import { Violation } from '../checkers/regex-checker';

const violation = (over: Partial<Violation> = {}): Violation => ({
    ruleId: 'VBC-005',
    name: 'use-var',
    severity: 'error',
    message: "Use of 'var' detected at line 1.",
    file: 'a.ts',
    line: 1,
    ...over,
});

describe('AnalysisCache', () => {
    let sandbox: string;
    const original = process.cwd();

    beforeEach(() => {
        sandbox = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'slopless-cache-')));
        process.chdir(sandbox);
    });
    afterEach(() => {
        process.chdir(original);
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    const source = (name: string, body: string) => {
        fs.writeFileSync(path.join(sandbox, name), body);
        return path.join(sandbox, name);
    };

    it('survives a round trip through the file', () => {
        const file = source('a.ts', 'var x = 1;\n');
        const writer = new AnalysisCache(true);
        const hash = writer.calculateHash(file)!;
        writer.setCachedViolations(file, hash, [violation()]);
        writer.saveCache();

        const reader = new AnalysisCache(true);
        expect(reader.getCachedViolations(file, hash)).toEqual([violation()]);
    });

    it('misses when the file has changed under the same path', () => {
        const file = source('a.ts', 'var x = 1;\n');
        const cache = new AnalysisCache(true);
        cache.setCachedViolations(file, cache.calculateHash(file)!, [violation()]);

        fs.writeFileSync(file, 'let x = 1;\n');
        expect(cache.getCachedViolations(file, cache.calculateHash(file)!)).toBeNull();
    });

    it('hashes contents rather than paths, so two identical files agree', () => {
        const one = source('one.ts', 'var x = 1;\n');
        const two = source('two.ts', 'var x = 1;\n');
        const cache = new AnalysisCache(true);
        expect(cache.calculateHash(one)).toBe(cache.calculateHash(two));
    });

    it('returns null for a file it cannot read rather than throwing', () => {
        expect(new AnalysisCache(true).calculateHash(path.join(sandbox, 'absent.ts'))).toBeNull();
    });

    it('starts empty when the cache file is corrupt, instead of carrying it', () => {
        const file = source('a.ts', 'var x = 1;\n');
        fs.writeFileSync(path.join(sandbox, '.sloplesscache'), '{ this is not json');

        const cache = new AnalysisCache(true);
        expect(cache.getCachedViolations(file, cache.calculateHash(file)!)).toBeNull();
    });

    it('reads and writes nothing at all when disabled', () => {
        const file = source('a.ts', 'var x = 1;\n');
        const cache = new AnalysisCache(false);
        const hash = cache.calculateHash(file)!;

        cache.setCachedViolations(file, hash, [violation()]);
        cache.saveCache();

        expect(cache.getCachedViolations(file, hash)).toBeNull();
        expect(fs.existsSync(path.join(sandbox, '.sloplesscache'))).toBe(false);
    });
});
