import * as os from 'os';

/**
 * Executes a list of tasks with a maximum concurrency limit.
 * Helps prevent Out-of-Memory (OOM) errors that occur when using Promise.all on thousands of files.
 */
export async function runWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number = os.cpus().length,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let currentIndex = 0;

    const worker = async () => {
        while (currentIndex < items.length) {
            const index = currentIndex++;
            results[index] = await fn(items[index]);
        }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);

    return results;
}
