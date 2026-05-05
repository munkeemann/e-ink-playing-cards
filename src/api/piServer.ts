import { AppSettings, CardInstance } from '../types';
import { PI_SERVER, mtgDescriptor, sendToSleeve } from './sleeveService';
import { timedFetch } from './http';

export { PI_SERVER };

// Network timeouts (ms). Pi-side endpoints get short timeouts because the
// Pi is on local Wi-Fi; image fetches go to Scryfall over the wider net.
const PI_FETCH_TIMEOUT_MS = 5000;
const PI_POST_TIMEOUT_MS = 3000;
const SCRYFALL_IMAGE_TIMEOUT_MS = 5000;
const SLEEVE_SELECT_POLL_TIMEOUT_MS = 30_000;
// Concurrency cap on parallel beginGame per-sleeve POSTs. Keeps the Pi
// HTTP server from being swamped while still saturating the link.
const PI_CONCURRENCY = 8;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Minimal counting semaphore — caps concurrent in-flight async work.
 * Used by beginGame to fan out per-sleeve POSTs in parallel without
 * overwhelming the Pi. Acquire before work, release in a `finally`.
 */
function makeSemaphore(max: number) {
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

/**
 * Returns the list of registered sleeve IDs from the Pi, or an empty array
 * if the Pi is unreachable or returns no sleeves.
 */
export async function getRegisteredSleeves(serverUrl: string = PI_SERVER): Promise<number[]> {
  const url = `${serverUrl}/sleeves`;
  try {
    const resp = await timedFetch(url, {}, PI_FETCH_TIMEOUT_MS);
    if (!resp.ok) return [];
    const raw = await resp.text();
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) return data as number[];
    // Pi returns {"sleeves": {"4": "192.168.4.19", ...}}
    if (data && typeof data === 'object' && 'sleeves' in data) {
      const sleevesMap = (data as { sleeves: Record<string, unknown> }).sleeves;
      if (sleevesMap && typeof sleevesMap === 'object') {
        return Object.keys(sleevesMap).map(Number).filter(n => !isNaN(n));
      }
    }
    console.warn(`[Pi] getRegisteredSleeves: unrecognised format: ${JSON.stringify(data)}`);
    return [];
  } catch (e) {
    console.warn('[Pi] getRegisteredSleeves error:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Clears a sleeve display on the Pi.
 */
export async function clearSleeve(sid: number, serverUrl: string = PI_SERVER): Promise<void> {
  try {
    await timedFetch(`${serverUrl}/clear?sleeve_id=${sid}`, { method: 'POST' }, PI_POST_TIMEOUT_MS);
  } catch {
    // Pi may be offline — fail silently
  }
}

// SAM1-68: requires firmware ZONE_COUNT=6. CMD is appended at the end of
// MTG_ZONE_CELLS (index 5); strips will silently drop zone=5 until firmware ships.
const ZONE_INDEX: Record<string, number> = {
  LIB: 4, HND: 3, BTFLD: 2, TKN: 2, GRV: 1, EXL: 0, CMD: 5,
};

// Short-lived cache so rapid zone-update calls don't each fire a separate /sleeves fetch.
let _regCache: { ids: Set<number>; expires: number } | null = null;

async function getCachedRegistered(serverUrl: string): Promise<Set<number>> {
  const now = Date.now();
  if (_regCache && now < _regCache.expires) return _regCache.ids;
  const ids = new Set(await getRegisteredSleeves(serverUrl));
  _regCache = { ids, expires: now + 15_000 };
  return ids;
}

/**
 * Routes a zone-index update through the Pi server (POST /set_zone).
 * Parameters are sent as URL query params: /set_zone?sleeve_id=N&zone=N
 * Zone index mapping: LIB=4, HND=3, BTFLD/TKN=2, GRV=1, EXL=0, CMD=5.
 */
export async function pushZoneUpdateViaPi(
  sleeveId: number,
  zone: string,
  serverUrl: string = PI_SERVER,
): Promise<void> {
  const registered = await getCachedRegistered(serverUrl);
  if (!registered.has(sleeveId)) return;
  const zoneIndex = ZONE_INDEX[zone] ?? 0;
  try {
    await timedFetch(
      `${serverUrl}/set_zone?sleeve_id=${sleeveId}&zone=${zoneIndex}`,
      { method: 'POST' },
      PI_POST_TIMEOUT_MS,
    );
  } catch {
    // Pi offline — fail silently
  }
}

/**
 * Assigns permanent sleeveIds to cards at game-start based on settings.
 * Commanders occupy sleeves 1..commanderCount in deck-list order (SAM1-69:
 * partner decks have two commanders). Non-commander cards take sleeves
 * starting at commanderCount+1 and are filled from physicalZones in this
 * priority: HND, BTFLD/TKN, GRV, EXL, then LIB (top librarySleeveDepth
 * cards). HND beats LIB on purpose — when sleeves are scarce, hand is
 * core game state and library preview is a nice-to-have.
 * All other cards get sleeveId null.
 * Returns a new cards array with sleeveId assigned.
 */
export function assignSleeveIds(
  cards: CardInstance[],
  settings: AppSettings,
): CardInstance[] {
  const physZones = new Set(settings.physicalZones);
  const depth = settings.librarySleeveDepth ?? 1;

  // Commanders occupy the leading sleeves and are never part of the non-commander fill loop.
  const commanders = cards.filter(c => c.place === 'commander');
  const commanderCount = commanders.length;
  const nonCommanderSlots = Math.max(0, settings.sleeveCount - commanderCount);
  const nonCommanderSleeved: CardInstance[] = [];

  const addZone = (zone: string) => {
    let zoneCards: CardInstance[];
    if (zone === 'LIB') {
      zoneCards = cards
        .filter(c => c.zone === 'LIB' && c.place !== 'commander')
        .sort((a, b) => parseInt(a.place, 10) - parseInt(b.place, 10))
        .slice(0, depth);
    } else if (zone === 'BTFLD') {
      zoneCards = cards.filter(c => (c.zone === 'BTFLD' || c.zone === 'TKN') && c.place !== 'commander');
    } else {
      zoneCards = cards.filter(c => c.zone === zone && c.place !== 'commander');
    }
    for (const card of zoneCards) {
      if (nonCommanderSleeved.length >= nonCommanderSlots) return;
      if (!nonCommanderSleeved.includes(card)) nonCommanderSleeved.push(card);
    }
  };

  for (const zone of ['HND', 'BTFLD', 'GRV', 'EXL', 'LIB']) {
    if (nonCommanderSleeved.length >= nonCommanderSlots) break;
    if (physZones.has(zone)) addZone(zone);
  }

  const sleevedSet = new Map<CardInstance, number>();
  commanders.forEach((c, i) => sleevedSet.set(c, i + 1));
  nonCommanderSleeved.forEach((c, i) => sleevedSet.set(c, commanderCount + i + 1));

  return cards.map(c => ({ ...c, sleeveId: sleevedSet.get(c) ?? null }));
}

/**
 * Returns the lowest sleeve number (1..sleeveCount) not currently assigned
 * to any card in the deck. Returns null if all slots are full.
 */
export function nextFreeSleeveId(cards: CardInstance[], sleeveCount: number): number | null {
  const used = new Set(cards.map(c => c.sleeveId).filter((s): s is number => s !== null));
  for (let i = 1; i <= sleeveCount; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}

/**
 * Pushes a single card image to its assigned sleeve on the Pi.
 * No-ops if card.sleeveId is null. For tokens with empty imagePath (Scryfall miss),
 * pushes the card-back image so the sleeve clears its prior content instead of
 * displaying a stale image. Non-token cards with empty imagePath still no-op.
 * commanderSleeveCount controls the descriptor label cutover (SAM1-69).
 */
export async function pushCardToSleeve(
  card: CardInstance,
  commanderSleeveCount: number = 1,
  serverUrl: string = PI_SERVER,
): Promise<void> {
  if (card.sleeveId === null) return;
  if (!card.imagePath) {
    if (!card.isToken) return;
    try {
      const desc = { ...mtgDescriptor(card.sleeveId, card.zone, commanderSleeveCount), _useFaceBack: true as const };
      await sendToSleeve(card.sleeveId, desc, undefined, serverUrl);
    } catch {
      // Pi offline — fail silently
    }
    return;
  }
  try {
    const imageResp = await timedFetch(card.imagePath, {}, SCRYFALL_IMAGE_TIMEOUT_MS);
    if (!imageResp.ok) return;
    const buf = await imageResp.arrayBuffer();
    await sendToSleeve(card.sleeveId, mtgDescriptor(card.sleeveId, card.zone, commanderSleeveCount), buf, serverUrl);
  } catch {
    // Pi offline or Scryfall slow — fail silently
  }
}

export interface SleeveZoneState {
  active_idx: number;
  cell: string;
}

/**
 * Fetches /zones and returns a sleeveId → {active_idx, cell} map.
 * Pi returns {"zones": {"2": {"active_idx": 0, "cell": "EXL"}, ...}}.
 * Returns an empty object if the Pi is unreachable or the response is malformed.
 */
export async function fetchZones(serverUrl: string = PI_SERVER): Promise<Record<number, SleeveZoneState>> {
  const resp = await timedFetch(`${serverUrl}/zones`, {}, PI_POST_TIMEOUT_MS);
  if (!resp.ok) return {};
  const raw = await resp.json() as unknown;
  if (raw && typeof raw === 'object' && 'zones' in raw) {
    const map = (raw as { zones: Record<string, unknown> }).zones;
    const result: Record<number, SleeveZoneState> = {};
    for (const [idStr, value] of Object.entries(map)) {
      const id = Number(idStr);
      if (isNaN(id)) continue;
      if (value && typeof value === 'object' && 'cell' in value && 'active_idx' in value) {
        const v = value as { active_idx: unknown; cell: unknown };
        if (typeof v.cell === 'string' && typeof v.active_idx === 'number') {
          result[id] = { active_idx: v.active_idx, cell: v.cell };
        }
      }
    }
    return result;
  }
  return {};
}

/**
 * Snapshots /zones then polls every 500ms for any sleeve whose zone_name changed.
 * Returns the sleeve_id of the first changed sleeve, or null on timeout or cancellation.
 * Pass isCancelled to allow the caller to abort early (e.g. user taps Cancel).
 */
export async function waitForSleeveSelection(
  isCancelled: () => boolean,
  timeoutMs: number = SLEEVE_SELECT_POLL_TIMEOUT_MS,
  serverUrl: string = PI_SERVER,
): Promise<number | null> {
  // Snapshot current zone state
  let snapshot: Record<number, SleeveZoneState> = {};
  try {
    snapshot = await fetchZones(serverUrl);
  } catch {
    return null;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (isCancelled()) return null;
    await sleep(500);
    if (isCancelled()) return null;
    try {
      const current = await fetchZones(serverUrl);
      for (const [idStr, zoneState] of Object.entries(current)) {
        const id = Number(idStr);
        if (snapshot[id]?.cell !== zoneState.cell) return id;
      }
    } catch {
      // Pi offline or slow — keep polling
    }
  }
  return null;
}

/**
 * Pushes card images to Pi sleeves at game-start.
 * Uses card.sleeveId (permanent assignment) and only pushes cards whose
 * zone is in settings.physicalZones (or commander which is always pushed).
 * Cards with sleeveId null are skipped.
 */
export async function beginGame(
  cards: CardInstance[],
  registeredSleeves: number[],
  onProgress?: (sent: number, total: number) => void,
  serverUrl: string = PI_SERVER,
  settings?: AppSettings,
): Promise<void> {
  try {
    const safeCards = Array.isArray(cards) ? cards : [];
    const safeRegistered = Array.isArray(registeredSleeves) ? registeredSleeves : [];
    const registeredSet = new Set(safeRegistered);
    const physZones = settings ? new Set(settings.physicalZones) : null;
    const commanderSleeveCount = safeCards.filter(c => c.place === 'commander').length || 1;

    // Cards that have a sleeveId and imagePath, regardless of whether registered.
    // Unregistered sleeves are skipped gracefully inside the loop.
    const candidates = safeCards.filter(c => {
      if (c.sleeveId === null || c.sleeveId === undefined || !c.imagePath) return false;
      if (c.place === 'commander') return true;
      // SAM1-81: TKN is "physical via BTFLD" — assignSleeveIds at line 217-218
      // already bundles TKN with BTFLD for sleeve assignment. Match that
      // convention here so tokens (zone='TKN') push when BTFLD is in
      // physicalZones; otherwise the cascade in createTokenFromValues sets
      // a valid sleeveId that beginGame would silently skip.
      const effectiveZone = c.zone === 'TKN' ? 'BTFLD' : c.zone;
      if (physZones && !physZones.has(effectiveZone)) return false;
      return true;
    }).sort((a, b) => (a.sleeveId ?? 0) - (b.sleeveId ?? 0));

    // Pre-split: log each unregistered sleeve once, then dispatch eligible
    // ones in parallel under a concurrency cap. `total` is fixed at dispatch
    // time so it doesn't race with the parallel sent-counter increments.
    const eligible: CardInstance[] = [];
    for (const card of candidates) {
      if (registeredSet.has(card.sleeveId!)) eligible.push(card);
      else console.log(`[Pi] Sleeve ${card.sleeveId} not registered — skipping`);
    }
    const total = eligible.length;

    const t0 = Date.now();
    const sem = makeSemaphore(PI_CONCURRENCY);
    let sent = 0;

    const tasks = eligible.map(card => (async () => {
      const sid = card.sleeveId!;
      await sem.acquire();
      const start = Date.now();
      try {
        const imageResp = await fetch(card.imagePath);
        if (!imageResp.ok) throw new Error(`Scryfall fetch failed: HTTP ${imageResp.status}`);
        const arrayBuffer = await imageResp.arrayBuffer();

        await sendToSleeve(sid, mtgDescriptor(sid, card.zone, commanderSleeveCount), arrayBuffer, serverUrl);
        const ms = Date.now() - start;
        console.log(`[Pi] sleeve ${sid} ✓ in ${ms}ms`);
        return { ok: true as const, sid, ms };
      } catch (e) {
        const ms = Date.now() - start;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[Pi] Sleeve ${sid} failed in ${ms}ms:`, msg);
        return { ok: false as const, sid, ms, msg };
      } finally {
        sem.release();
        sent++;
        onProgress?.(sent, total);
      }
    })());

    const results = await Promise.allSettled(tasks);
    const okCount = results.reduce(
      (n, r) => n + (r.status === 'fulfilled' && r.value.ok ? 1 : 0),
      0,
    );
    const elapsed = Date.now() - t0;

    console.log(`[Pi] beginGame complete: ${okCount}/${total} registered sleeves pushed in ${elapsed}ms`);
  } catch (e) {
    console.error('[Pi] beginGame outer catch:', e instanceof Error ? e.message : e);
  }
}
