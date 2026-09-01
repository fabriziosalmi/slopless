import { describe, it, expect } from 'vitest';
import { compileVocabulary, excuses } from '../engine/vocabulary';

describe('compileVocabulary', () => {
    it('is absent when the project claims nothing', () => {
        expect(compileVocabulary(undefined)).toBeNull();
        expect(compileVocabulary([])).toBeNull();
        expect(compileVocabulary(['  ', ''])).toBeNull();
    });
});

describe('excuses', () => {
    const vocab = () => compileVocabulary(['blacklist', 'master']);

    it('excuses a word the project has claimed', () => {
        expect(excuses(vocab(), 'blacklist')).toBe(true);
        expect(excuses(vocab(), 'Blacklist')).toBe(true);
    });

    it('leaves a word it has not', () => {
        expect(excuses(vocab(), 'whitelist')).toBe(false);
    });

    it('claims whole words only, so a longer word is still reported', () => {
        // Claiming the audio `master` bus must not excuse `mastermind`.
        expect(excuses(vocab(), 'mastermind')).toBe(false);
        expect(excuses(vocab(), 'blacklisted')).toBe(false);
        expect(excuses(vocab(), 'grandmaster')).toBe(false);
    });

    it('reads a claimed word out of a longer match', () => {
        expect(excuses(vocab(), 'the master bus gain')).toBe(true);
    });

    it('treats a hyphen as a word boundary the claim does not cross', () => {
        expect(excuses(vocab(), 'master-slave')).toBe(false);
    });

    it('counts what it excused, once per call', () => {
        const state = vocab()!;
        excuses(state, 'blacklist');
        excuses(state, 'master');
        excuses(state, 'whitelist');
        expect(state.excused).toBe(2);
    });

    it('excuses nothing when there is no vocabulary', () => {
        expect(excuses(null, 'blacklist')).toBe(false);
    });

    it('takes a term containing regex punctuation literally', () => {
        const state = compileVocabulary(['c++'])!;
        expect(excuses(state, 'c++')).toBe(true);
    });
});
