import { describe, it, expect } from 'vitest';
import { parseSuppressions, applySuppressions } from '../engine/suppressions';
import { Violation } from '../checkers/regex-checker';

const violation = (line: number, ruleId: string): Violation => ({
    ruleId, name: 'n', severity: 'error', message: 'm', file: 'a.ts', line,
});

describe('parseSuppressions', () => {
    it('points next-line at the line below the comment', () => {
        const found = parseSuppressions('// slopless-disable-next-line VBC-001\nconst t = "x";\n');
        expect(found).toEqual([{ line: 2, ruleIds: ['VBC-001'] }]);
    });

    it('points a trailing directive at its own line', () => {
        const found = parseSuppressions('const t = "x"; // slopless-disable-line VBC-001\n');
        expect(found).toEqual([{ line: 1, ruleIds: ['VBC-001'] }]);
    });

    it('reads several ids from one directive', () => {
        expect(parseSuppressions('# slopless-disable-next-line VBC-001, VBC-034\n')[0].ruleIds)
            .toEqual(['VBC-001', 'VBC-034']);
    });

    it('treats a bare directive as covering every rule', () => {
        expect(parseSuppressions('/* slopless-disable-next-line */\n')[0].ruleIds).toBeNull();
    });

    it('does not read rule ids out of the explanation', () => {
        // The reason is where people write "unlike VBC-070, this one is real".
        const found = parseSuppressions('// slopless-disable-next-line VBC-001 -- not VBC-034\n');
        expect(found[0].ruleIds).toEqual(['VBC-001']);
    });

    it('works in every comment syntax, because it never looks for one', () => {
        for (const line of [
            '// slopless-disable-line VBC-010',
            '# slopless-disable-line VBC-010',
            '/* slopless-disable-line VBC-010 */',
            '<!-- slopless-disable-line VBC-010 -->',
        ]) {
            expect(parseSuppressions(line + '\n'), line).toHaveLength(1);
        }
    });
});

describe('applySuppressions', () => {
    const read = () => '// slopless-disable-next-line VBC-001\nconst t = "x";\nconst u = "y";\n';

    it('drops only the named rule on the named line', () => {
        const kept = applySuppressions(
            [violation(2, 'VBC-001'), violation(2, 'VBC-034'), violation(3, 'VBC-001')], read);
        expect(kept.map(v => `${v.ruleId}:${v.line}`)).toEqual(['VBC-034:2', 'VBC-001:3']);
    });

    it('reports rather than hides when the file cannot be read', () => {
        expect(applySuppressions([violation(2, 'VBC-001')], () => undefined)).toHaveLength(1);
    });
});
