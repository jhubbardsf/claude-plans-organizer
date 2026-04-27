/**
 * Concurrency pool utility
 * Limits the number of concurrent async operations
 */

export interface ConcurrencyPool {
  run: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Creates a concurrency pool that limits parallel async operations.
 *
 * Unlike batch processing (which waits for all in a batch to complete),
 * this pool keeps all slots filled continuously for maximum throughput.
 *
 * @param concurrency - Maximum number of concurrent operations
 * @returns Pool with a run() method for executing functions
 */
export function createPool(concurrency: number): ConcurrencyPool {
  let running = 0;
  const queue: Array<() => void> = [];

  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    // Wait if at capacity
    if (running >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    running++;
    try {
      return await fn();
    } finally {
      running--;
      // Wake up next queued operation
      const next = queue.shift();
      if (next) {
        next();
      }
    }
  };

  return { run };
}
