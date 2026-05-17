import { randomInt } from 'node:crypto';

/**
 * Returns a uniformly-random element from a non-empty array.
 * Uses `crypto.randomInt` per TASK.md §2 — never `Math.random`.
 */
export const randomPick = <T>(pool: readonly T[]): T => {
  if (pool.length === 0) {
    throw new Error('randomPick: pool is empty');
  }

  return pool[randomInt(0, pool.length)];
};
