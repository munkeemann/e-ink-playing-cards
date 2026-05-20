/**
 * Concurrency primitives shared by Pi-bound dispatch loops (MTG beginGame,
 * CAH pushUpdates). Extracted so both modules can fan out POSTs under the
 * same cap without duplicating the semaphore.
 */

// Concurrency cap on parallel per-sleeve POSTs. Keeps the Pi HTTP server
// from being swamped while still saturating the link.
export const PI_CONCURRENCY = 8;

/**
 * Minimal counting semaphore — caps concurrent in-flight async work.
 * Acquire before work, release in a `finally`.
 */
export function makeSemaphore(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return {
    acquire: (): Promise<void> => new Promise(resolve => {
      if (active < max) { active++; resolve(); }
      else queue.push(() => { active++; resolve(); });
    }),
    release: () => { active--; const next = queue.shift(); if (next) next(); },
  };
}
