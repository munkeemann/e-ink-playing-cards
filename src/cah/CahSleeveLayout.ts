/**
 * Sleeve 1          → black card (prompt)
 * Sleeve 2..1+P*H   → white cards; player p (0-based), hand slot k (0-based)
 *                      sleeveId = 2 + p*handSize + k
 */
export function cahSleeveId(playerIdx: number, handSlot: number, handSize: number): number {
  return 2 + playerIdx * handSize + handSlot;
}

export function totalCahSleeveCount(playerCount: number, handSize: number): number {
  return 1 + playerCount * handSize;
}
