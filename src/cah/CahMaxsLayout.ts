/**
 * Sleeve 1          → prompt (black card)
 * Sleeve 2..1+P*K   → responses (white cards); player p, card k (both 0-based)
 *                     sleeveId = 2 + p*K + k
 */
export function maxsSleeveId(playerIdx: number, cardIdx: number, K: number): number {
  return 2 + playerIdx * K + cardIdx;
}

export function totalMaxsSleeveCount(playerCount: number, K: number): number {
  return 1 + playerCount * K;
}
