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

/**
 * Returns an element from `pool` chosen with probability proportional to its
 * `weight`. Rows with weight 0 are effectively excluded. Throws if the pool is
 * empty or every weight is 0 — callers are expected to pre-validate so a 409
 * surfaces at the request boundary instead of a 500.
 *
 * Uses `crypto.randomInt` per TASK.md §2.
 */
export const weightedPick = <T extends { weight: number }>(
  pool: readonly T[],
): T => {
  if (pool.length === 0) {
    throw new Error('weightedPick: pool is empty');
  }

  const total = pool.reduce((sum, item) => sum + Math.max(0, item.weight), 0);

  if (total <= 0) {
    throw new Error('weightedPick: total weight is zero');
  }

  const target = randomInt(0, total);
  let cumulative = 0;

  for (const item of pool) {
    cumulative += Math.max(0, item.weight);

    if (target < cumulative) {
      return item;
    }
  }

  // Unreachable given total > 0, but keeps the return type non-undefined.
  return pool[pool.length - 1];
};
