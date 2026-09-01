// Every audit so far has hit the same wall: a word that is slop in general and
// the domain everywhere in this particular repository. `blacklist` appears 617
// times in one WAF, where it names the data structure and half the JSON
// contract. `master` appears 486 times in an audio project, where it is the
// output bus. Switching the rule off loses every other use of it; renaming the
// domain to satisfy a linter is worse.
//
// The check runs against the matched text and nothing else. That text never
// leaves the process: a rule about hardcoded secrets matches a secret, and the
// report is uploaded to code scanning.

export interface VocabularyState {
    terms: RegExp[];
    excused: number;
}

export function compileVocabulary(terms?: string[]): VocabularyState | null {
    const patterns = (terms ?? [])
        .map(term => term.trim())
        .filter(Boolean)
        // Whole words only: `master` must not excuse a finding about `mastermind`.
        .map(word => new RegExp(`(?<![\\w-])${escapeRegex(word)}(?![\\w-])`, 'i'));
    return patterns.length > 0 ? { terms: patterns, excused: 0 } : null;
}

/** True when the project has claimed this word, and counts it as excused. */
export function excuses(state: VocabularyState | null, matched: string): boolean {
    if (!state) return false;
    if (!state.terms.some(pattern => pattern.test(matched))) return false;
    state.excused++;
    return true;
}

function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
