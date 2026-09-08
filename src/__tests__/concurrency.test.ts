import { describe, it, expect } from 'vitest';
import { runWithConcurrencyLimit } from '../engine/utils';

const tick = () => new Promise(resolve => setImmediate(resolve));

describe('runWithConcurrencyLimit', () => {
    it('returns results in the order of the input, not of completion', async () => {
        const items = [30, 20, 10, 0];
        const results = await runWithConcurrencyLimit(items, 4, async (ms) => {
            for (let i = 0; i < ms; i++) await tick();
            return ms;
        });
        expect(results).toEqual(items);
    });

    it('gives every item to exactly one worker', async () => {
        const items = Array.from({ length: 200 }, (_, i) => i);
        const seenItems: number[] = [];
        await runWithConcurrencyLimit(items, 8, async (n) => {
            await tick();
            seenItems.push(n);
            return n;
        });
        expect(seenItems.sort((a, b) => a - b)).toEqual(items);
    });

    it('never runs more than the limit at once', async () => {
        let running = 0;
        let peak = 0;
        await runWithConcurrencyLimit(Array.from({ length: 50 }), 4, async () => {
            running++;
            peak = Math.max(peak, running);
            await tick();
            running--;
            return null;
        });
        expect(peak).toBeLessThanOrEqual(4);
        expect(peak).toBeGreaterThan(1);
    });

    it('does not spawn workers it has no items for', async () => {
        let started = 0;
        await runWithConcurrencyLimit([1, 2], 16, async (n) => {
            started++;
            await tick();
            return n;
        });
        expect(started).toBe(2);
    });

    it('handles an empty list without hanging', async () => {
        expect(await runWithConcurrencyLimit([], 4, async () => 1)).toEqual([]);
    });

    it('surfaces a task failure to the caller', async () => {
        await expect(runWithConcurrencyLimit([1, 2, 3], 2, async (n) => {
            if (n === 2) throw new Error('boom');
            return n;
        })).rejects.toThrow('boom');
    });
});
