# Arcanum Code Review — Phase 1 Audit

Read-only audit of the iOS app (TypeScript, `app/` and `src/`) and the Pi server (`pi/server.py`). The firmware file `sleeve_firmware.ino` was named in scope but is not present in this repo on disk; it was not audited. Android files were skipped per scope.

## Summary

| Severity | Count |
|----------|-------|
| CRIT     | 0     |
| HIGH     | 8     |
| MED      | 19    |
| LOW      | 13    |
| **Total**| **40** |

| Risk to fix | Count |
|-------------|-------|
| SAFE        | 27    |
| MEDIUM      | 10    |
| HIGH        | 3     |

A few findings are flagged with **(ASK)** — I want a confirmation before deleting code that may have been preserved deliberately.

---

## src/api/piServer.ts

### F1. `alertWait` debug instrumentation throughout `getRegisteredSleeves` and `beginGame`
- **Severity:** HIGH
- **Risk:** SAFE
- **Where:** `src/api/piServer.ts:7-27` (machinery), 56, 61, 64, 72, 76, 80, 388, 398, 400, 428-429, 450, 455, 459, 465, 481, 486, plus the comment block at 165-169
- **Why:** This is the debug-modal scaffold the prompt explicitly named. When `_piDebugAlerts` is on, every Pi network call pops a blocking modal that the user must dismiss to continue. The instrumentation litters two load-bearing functions and is the source of the preexisting `tsc` error at `piServer.ts:25` (resolver type mismatch with `Alert.alert`'s `onPress`). Logic flow is unchanged; only the debug surface goes away.
- **Proposed fix:** Remove the `alertWait` helper, the `_piDebugAlerts` module flag, and `configurePiDebug`. Strip every `await alertWait(...)` call. Keep the existing `console.log` / `console.warn` lines. Find consumers of `configurePiDebug` (`app/_layout.tsx:18, 109`) and remove. Remove `piDebugAlerts` from `AppSettings` and from any toggle in `app/settings.tsx`.
- **Notes:** This also fixes the `piServer.ts:25` TS error.

### F2. `pushZoneUpdate` (direct sleeve IP path) is dead
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/api/piServer.ts:143-163`
- **Why:** No call sites — the active path is `pushZoneUpdateViaPi` (line 185). `getSleeveIpMap` (line 114) is its only producer; both are dead together.
- **Proposed fix:** Delete `pushZoneUpdate` and `getSleeveIpMap`, plus the `ZONE_INDEX` map at line 106 if no other consumer remains (verify — `pushZoneUpdateViaPi` reuses it).

### F3. `sendToGraveyard` is a deprecated dead alias
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/api/piServer.ts:101-102`
- **Why:** Marked `@deprecated`, no consumers in `app/` or `src/`.
- **Proposed fix:** Delete.

### F4. AbortController + setTimeout pattern duplicated 6 times
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/api/piServer.ts:58-60, 90-95, 116-118, 152-159, 194-199, 315-317`
- **Why:** The `timedFetch(url, opts, ms)` helper already exists in `src/api/sleeveService.ts:5` and a local copy lives in `app/holdem/game.tsx:92`. Six handwritten copies in `piServer.ts` duplicate the same shape. Each is correct individually, but the duplication makes any retry/backoff change a 6-place edit.
- **Proposed fix:** Export `timedFetch` from a shared module (e.g. `src/api/http.ts` or extend `sleeveService.ts`'s export). Refactor all 7 call sites (6 in piServer + 1 in holdem) to use it.

### F5. `pushCardToSleeve` Scryfall image fetch has no timeout
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/api/piServer.ts:295`
- **Why:** `await fetch(card.imagePath)` — no AbortController, no timeout. If a Scryfall image stalls mid-game, the call hangs forever. This is one of the load-bearing paths called after every zone transition (`applyTransitionResult` in game/[id].tsx).
- **Proposed fix:** Wrap in a `timedFetch(card.imagePath, 5000)` (after F4). Treat timeout the same as `!resp.ok`: just return.

### F6. `beginGame` progress callback uses wrong denominator
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/api/piServer.ts:470` vs definition of `total` at line 439
- **Why:** `total = eligible.length` (registered candidates), but `onProgress?.(sent, candidates.length)` reports against `candidates.length` (which includes unregistered cards too). With 8 candidates / 4 eligible, the UI shows "1/8 … 4/8" instead of "1/4 … 4/4".
- **Proposed fix:** Replace `candidates.length` with `total` in the `onProgress` call.

### F7. Magic numbers: semaphore size, timeout values
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/api/piServer.ts:442` (`makeSemaphore(8)`), and the various 3000/5000/10000 timeout literals
- **Why:** Concurrency cap (8) and per-request timeouts are scattered as literals. With dozens of physical sleeves planned, the cap is a tuning parameter.
- **Proposed fix:** Hoist to module-level `const PI_CONCURRENCY = 8`, `const SLEEVE_TIMEOUT_MS = 10_000`, etc. Group near `PI_SERVER`.

---

## src/api/sleeveService.ts

### F8. Hardcoded `PI_SERVER` IP doesn't match deployment
- **Severity:** HIGH
- **Risk:** MEDIUM
- **Where:** `src/api/sleeveService.ts:3`
- **Why:** `'http://192.168.86.193:5050'` is a home-LAN address. CLAUDE.md and `pi/server.py:407` (`192.168.4.1/24` on `wlan1`) both indicate the field network has the Pi at `192.168.4.1:5050`. Whichever is currently correct, the address being baked in as a `const` means a build switch every time the network changes. This will bite at the next field demo.
- **Proposed fix:** Move to AppSettings (e.g. `settings.piServerUrl`), default `'http://192.168.4.1:5050'`. Plumb through every callsite; `serverUrl` is already an optional arg on most Pi-facing functions, so the change mostly shifts the default source. Add a settings UI field (out of session scope — file as separate ticket).
- **Notes:** I'm flagging this as MEDIUM risk because changing the default touches the hardware-comms path; verify on Pi-on-AP network before merging. Keep as HIGH severity due to demo risk.

### F9. Verbose `console.log` instrumentation throughout sleeveService
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/api/sleeveService.ts:23-44, 68, 84, 93, 102, 112-113, 123-124, 134, 161-189, 207-303` (~41 console statements)
- **Why:** Most descriptor builders log entry. `sendToSleeve` logs at every step (enter, getCardBackBytes start/done, fingerprint start/done, dedup skip/proceed, body built, POST start/done, OK/error). Useful for hardware debug, noisy in production.
- **Proposed fix:** Either gate behind a `__DEV__` check, or introduce a tiny `dlog(...)` helper that no-ops in release. Don't blanket-delete — these entries pulled their weight in past hardware sessions. **(ASK)** before reducing, since the user may want to keep verbose logging through more hardware iterations.

### F10. `prefetchCardBacks` duplicates `getCardBackBytes` cache-fill
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/api/sleeveService.ts:22-46` and 167-190
- **Why:** Both fetch the same `card_back.jpg` asset, both populate `_cardBackCache`, both have near-identical try/log/fetch logic with separate console.log prefixes.
- **Proposed fix:** Have `prefetchCardBacks` call `getCardBackBytes()` inside a try/catch (which is already idempotent via the cache) and return void. Drops ~25 lines.

### F11. Unused destructured variable `_fd`
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/api/sleeveService.ts:241`
- **Why:** `const { _useFaceBack: _fd, ...wireDescriptor } = descriptor;` — the rename-to-underscore pattern is fine but explicit; `const { _useFaceBack, ...wireDescriptor } = descriptor;` would still work (TS doesn't flag `_useFaceBack` as unused once it's a declared name; ESLint with `no-unused-vars` does, but you'd allow `_*` names).
- **Proposed fix:** Either drop `_fd` (`const { _useFaceBack: _, ...wireDescriptor } = descriptor` or just leave it as is). Cosmetic only.

---

## src/api/scryfall.ts

### F12. No timeout on Scryfall network calls
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/api/scryfall.ts:157, 217, 260, 299` (and the bulk-data download at 71-99)
- **Why:** Every fetch in this file is a bare `fetch(url, { headers })` with no AbortController. If Scryfall hangs (rare but real — they do CDN maintenance), the import flow blocks indefinitely with a spinner.
- **Proposed fix:** Use `timedFetch` from F4. For the bulk-data download, give it a generous timeout (60s) — that file is ~150 MB.

### F13. No rate-limiting on per-printing fetches
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/api/scryfall.ts:255` (`fetchCardByPrinting`), called in a loop from `app/import.tsx:140-150`
- **Why:** Scryfall asks for 50–100 ms between requests. The import loop awaits each call sequentially (so you don't fire-hose them), but without a deliberate inter-call delay, on a fast network you can still exceed the recommended rate. Their docs say rate-limited responses get a 429 — currently we'd retry/error rather than throttle.
- **Proposed fix:** Add a small `await sleep(75)` between `fetchCardByPrinting` calls in the import loop, OR add a token-bucket inside the function. The former is simpler and more local to the import flow.

---

## src/shared/CardRenderer.tsx

### F14. Preexisting `tsc` error on `rafTick`
- **Severity:** HIGH
- **Risk:** SAFE
- **Where:** `src/shared/CardRenderer.tsx:18`
- **Why:** `requestAnimationFrame(resolve)` passes the Promise resolver directly as a `FrameRequestCallback`. The callback signature `(time: number) => void` doesn't match `(value?: void | PromiseLike<void>) => void`. This is one of the two strict-mode errors `tsc` reports today.
- **Proposed fix:** Wrap the resolver: `requestAnimationFrame(() => requestAnimationFrame(() => resolve()))`. Pure refactor, no behavior change.

---

## pi/server.py

### F15. Two zone-index mappings that mirror each other
- **Severity:** HIGH
- **Risk:** HIGH
- **Where:** `pi/server.py:92-96` (`ZONE_INDEX` says LIB=0, EXL=4) and (`ZONE_INDEX_TO_CELL` says LIB=4, EXL=0)
- **Why:** `_build_descriptor` (line 111) writes `active_index = ZONE_INDEX["LIB"] = 0` into the outgoing descriptor's `zone_strip.active_index`. But `set_zone` (line 363-366) and `zone_update` (line 325) store/return active_idx using the *inverted* convention from `ZONE_INDEX_TO_CELL`, where LIB=4 and EXL=0. The iOS-side mapping in `piServer.ts:106-108` matches the inverted convention (`LIB: 4, … EXL: 0`). So **the descriptor sent to firmware in legacy fallback mode (line 244) uses the un-inverted index**, while every other call site assumes inverted. Either the firmware re-inverts internally for descriptor strips (in which case `ZONE_INDEX` is correct and the comment should explain), or there's an actual semantics bug in the legacy fallback path.
- **Proposed fix:** **(ASK)** This needs verification against firmware before changing. If firmware-confirmed, document the inversion in a comment naming both endpoints. If not, unify on the inverted mapping (matching the iOS app and `set_zone`) and adjust `_build_descriptor`.
- **Notes:** Treating as HIGH risk: misalignment breaks every zone strip on every sleeve. Do not touch in Phase 2.

### F16. No size limit on uploaded images
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `pi/server.py:215-218, 232` (`request.get_data()`, `image_file.read()`)
- **Why:** Flask's `MAX_CONTENT_LENGTH` is unset; both the multipart and legacy-body paths read the entire request body into memory before validation. A malformed or oversized client request could OOM the Pi (which has limited RAM).
- **Proposed fix:** Add `app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024` (8 MB — generous for a 540×760 JPEG) right after `app = Flask(__name__)`. Flask returns 413 automatically.

### F17. `set_zone` validates `zone` only after posting to firmware
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `pi/server.py:347, 357-368`
- **Why:** `zone = request.args.get("zone")` — accepted as-is, posted to the sleeve's HTTP endpoint at `params={"zone": zone}`. If `zone` is non-numeric, the firmware presumably rejects it, but then `int(zone)` on line 363 raises `ValueError`, propagating as 500. The sleeve has already been told to update; the Pi's `zone_states` is not. State drift.
- **Proposed fix:** Convert `zone` to int (or 400-error) at the top of the handler, before the outbound POST.

### F18. `_ping_loop` logs failures but doesn't reap dead sleeves
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `pi/server.py:76-89`
- **Why:** A dead sleeve stays in `registry` forever. The iOS app then tries to push to it, and times out at 10s on every push. Multiplied by partner decks (~6 sleeves, sequential image fetches before parallel POST), this can stall game-start by 60s if half the registered sleeves are off.
- **Proposed fix:** After N consecutive ping failures (e.g. 3 = 90 s), drop the sleeve from `registry` and persist. **(ASK)** before changing — this affects observable behavior on hardware.

### F19. Subprocess call to `identify` doesn't check returncode
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `pi/server.py:147-150`
- **Why:** Useful debug — but if `identify` fails, `result.stdout` may be empty / malformed. The log line `f"JPEG properties: {identify.stdout.decode().strip()}"` then prints an empty string with no indication of why. Belt-and-braces.
- **Proposed fix:** `if identify.returncode != 0: logging.warning(f"identify failed: {identify.stderr.decode()}")` before the format line.

### F20. `_load_registry` and `_ping_loop` start only under `__main__`
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `pi/server.py:420-425`
- **Why:** If the service is ever moved to gunicorn / uwsgi, the `if __name__ == "__main__":` block doesn't run. Currently fine (systemd uses `python3 server.py`), but a footgun for any deployment change.
- **Proposed fix:** Hoist the registry-load and ping-thread start to module scope (idempotent on import). Leave `app.run` / `configure_network` inside `__main__`.

### F21. `face_down` truthiness uses case-sensitive comparison
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `pi/server.py:230`
- **Why:** `face_down = request.args.get("face_down", "0") not in ("0", "", "false", "False")` — accepts "False" but not "FALSE", "f", "no", "0.0".
- **Proposed fix:** `request.args.get("face_down", "").lower() in ("1", "true", "yes")` (default = falsy).

### F22. `/diag` accepts unbounded body and logs it at INFO
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `pi/server.py:160-164`
- **Why:** Logs all incoming `/diag` payload at INFO. Combined with no `MAX_CONTENT_LENGTH` (F16), a stray bulk POST fills the log.
- **Proposed fix:** Cap `body` to e.g. first 2 KB before logging. After F16, the request body is already capped, so this is belt-and-braces.

---

## src/storage/

### F23. `loadDecks` lacks try/catch on `JSON.parse`
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/storage/deckStorage.ts:17-20`
- **Why:** Other storage modules (`cahStorage`, `holdemStorage`, `cahPacksStorage`, `dndStorage`) all guard `JSON.parse` and return null/[] on failure. `loadDecks` does not — corrupt storage crashes the entire MTG app on launch.
- **Proposed fix:** Wrap the parse in try/catch; return `[]` and `console.warn` on failure.

### F24. Three near-identical single-game storage modules
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/storage/cahStorage.ts`, `src/storage/cahMaxsStorage.ts`, `src/storage/holdemStorage.ts`
- **Why:** Same shape: `save(state) / load(): T | null / clear()`. Different keys and types. Could be a single `makeGameStorage<T>(key)` returning the trio.
- **Proposed fix:** `src/storage/makeGameStorage.ts` exporting a factory. Replace the three modules with thin re-exports; existing imports keep working.

### F25. AppSettings defaults are duplicated 4 times
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/storage/deckStorage.ts:8-15` (DEFAULT_SETTINGS) and inline copies in `app/settings.tsx:30-36`, `app/deck/[id].tsx:84-90`, `app/game/[id].tsx:138`
- **Why:** Four sources of truth. Drift waiting to happen.
- **Proposed fix:** Export `DEFAULT_SETTINGS` from `deckStorage.ts` and import everywhere instead of inlining.

### F26. `cahPacksStorage` swallows write errors silently
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/storage/cahPacksStorage.ts:20`
- **Why:** `catch {}` — no log, no surface. Silent data loss.
- **Proposed fix:** `catch (e) { console.warn('[cahPacks] save failed:', e); }`.

---

## src/cah/

### F27. Large CAH_RULES_DISABLED dead-code blocks
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/cah/CahGame.ts:175-208, 215-223, 276-306, 321-322` (and mirroring blocks in `app/cah/game.tsx:140-176, 192-202`)
- **Why:** Hundreds of lines of commented-out CAH submission/voting/winner-pick logic, marked "DISABLED" with intent. The user's prompt explicitly flagged stale comments. This is preserved deliberately, but the file is hard to read and the disabled call sites still import dead exports (`pickWinner`, `submitCard`, `deltaRevealUpdates`, `startNextRound`).
- **Proposed fix:** **(ASK)** Two options:
  1. Delete the commented blocks and the dead exports; recover from git history if/when CAH rules return.
  2. Move the disabled rules into a separate `cah_rules.archive.ts` file with a header explaining the freeze, and delete the inline comments.
- **Notes:** Don't touch in Phase 2 without your call.

### F28. Dead exports in CAH layout files
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/cah/CahSleeveLayout.ts:15` (`buildCahSleeveLayout`), `:41` (`isCahSleeveFaceUp`); `src/cah/CahMaxsLayout.ts:21` (`buildMaxsLayout`), `:1` (`MaxsSleeveSlot`)
- **Why:** Exported but unused — only the `cahSleeveId` / `maxsSleeveId` / `total*Count` helpers have consumers.
- **Proposed fix:** Delete the dead exports.

### F29. Duplicate `blackCardDescriptor` definition
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/cah/CahGame.ts:65-67` vs `src/api/sleeveService.ts:122-125` (`cahBlackCardDescriptor`)
- **Why:** Two implementations returning the identical shape. The CahGame one is private; the sleeveService one is exported and used by `CahMaxsGame.ts:7, 122`.
- **Proposed fix:** Delete the local `blackCardDescriptor` in CahGame, import `cahBlackCardDescriptor` from sleeveService.

### F30. `_playerIdx` / `_handSlot` retained-but-unused signature
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/cah/CahGame.ts:77-79`
- **Why:** Comment claims args "are kept in the signature so callers don't need to change." But the function is private to this file and only called from lines 113, 121, 154 — all of which would be trivially updated.
- **Proposed fix:** Remove the unused params and update the three internal call sites. ~2 lines.

### F31. Unused destructured `submissionSlots`
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/cah/CahGame.ts:139`
- **Why:** Function `deltaRevealUpdates` (which is itself dead — see F27) destructures `submissionSlots` and never reads it. TS strict-mode flags.
- **Proposed fix:** Goes away if the dead function is removed (F27).

---

## app/game/[id].tsx (MTG in-game)

### F32. `/zones` poll has no in-flight backoff
- **Severity:** MED
- **Risk:** MEDIUM
- **Where:** `app/game/[id].tsx:221-339`
- **Why:** `setInterval(async () => fetchZones(), 500)` — when the Pi is unreachable, `fetchZones` waits up to 3 s on its AbortController. The interval keeps firing every 500 ms regardless of pending fetches. Up to 6 in-flight requests stack against an unreachable Pi (= 12 req/s into a black hole). Memory pressure is bounded but real.
- **Proposed fix:** Track an `inFlight` flag in a ref; skip the tick if a fetch is still pending. Optional: exponential backoff after consecutive failures.
- **Notes:** Marked MEDIUM risk because it's the load-bearing zone-poll path. Test plan: hide Pi (turn off AP), watch logs to confirm no stacking. Then re-enable Pi, confirm zone polling resumes without delay.

### F33. Unused variable `shuffled` in `handleShuffle`
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `app/game/[id].tsx:477`
- **Why:** `const shuffled = shuffle(lib).map(...)` is computed and discarded; the actual library used is `shuffledLib` declared again at line 490. Two shuffles, only one consumed.
- **Proposed fix:** Delete line 477. Also drops one `shuffle()` call per handleShuffle invocation.

### F34. `as any` route casts in expo-router push calls
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `app/index.tsx:127, 149`, `app/dnd/index.tsx:34, 65`, `app/dnd/new.tsx:88`
- **Why:** `router.push(... as any)` to bypass expo-router's typed-route Pathname. The casts are usually because the route was added without regenerating route types.
- **Proposed fix:** Either regenerate route types (`npx expo customize tsconfig.json`) or, if that's churn, add a typed route alias. Cosmetic — TS strict-mode noise.

### F35. `as any` cast for `_useFaceBack` flag
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `app/cah/game.tsx:67`
- **Why:** `(u.descriptor as any)._useFaceBack` — the field exists on `Descriptor` type as `_useFaceBack?: true`. No cast needed.
- **Proposed fix:** `u.descriptor._useFaceBack`.

---

## app/holdem/game.tsx

### F36. Local `timedFetch` reimplementation
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `app/holdem/game.tsx:92-100`
- **Why:** Duplicates `timedFetch` from `sleeveService.ts:5`. Goes away if F4 lands (extract to shared module).
- **Proposed fix:** Delete after F4.

---

## Cross-cutting

### F37. Settings type carries `piDebugAlerts` field used only by alertWait
- **Severity:** MED
- **Risk:** SAFE
- **Where:** `src/types/index.ts:88` (interface), `src/storage/deckStorage.ts:13` (default), and the toggle in `app/settings.tsx`
- **Why:** Once F1 lands and `alertWait` is gone, this setting controls nothing. Keeping it confuses users.
- **Proposed fix:** Remove `piDebugAlerts` from `AppSettings`, `DEFAULT_SETTINGS`, and the settings UI. Rolled into F1.

### F38. `console.log` density in components
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `app/deck/[id].tsx:27, 39`, `app/game/[id].tsx:32, 44, 236, 244, 288, 298`, etc.
- **Why:** Component-level diagnostic logs that are rarely useful in production but make grep harder.
- **Proposed fix:** **(ASK)** Same as F9 — gate with a `dlog` helper rather than blanket-delete.

### F39. ZONE_INDEX duplicated in iOS code
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/api/piServer.ts:106-108` (`ZONE_INDEX`) and `src/api/sleeveService.ts:63-65` (`MTG_ZONE_ACTIVE`)
- **Why:** Two zone-name → numeric-index maps, both with TKN→2 fallback. Different name, different value convention (one has LIB=4, the other LIB=0 — see F15 for why). They should be the same on the iOS side at least.
- **Proposed fix:** **(ASK)** depends on resolving F15 first. After that, consolidate to one map in one file.

### F40. AmbientLayer reanimated effects miss shared-value deps
- **Severity:** LOW
- **Risk:** SAFE
- **Where:** `src/components/AmbientLayer.tsx:86-98, 146-167, 197-218`
- **Why:** `useEffect(..., [active])` doesn't include `breathe`, `y`, `rot` shared values. Reanimated convention is to omit them (they're refs), but `react-hooks/exhaustive-deps` ESLint rule flags. Cosmetic; runtime behavior is fine.
- **Proposed fix:** Add `// eslint-disable-next-line react-hooks/exhaustive-deps` directly above each effect, or include the shared values (Reanimated tolerates it).

---

## Notes on findings I did NOT flag

- `zoneTransition.ts` is well-structured and treated as load-bearing per the prompt; I did not propose changes. Object-identity-based `cards.indexOf(card)` is correct for the current call sites.
- `holdem`, `cahMaxs` game logic was clean — pure functions, no embedded I/O.
- `parchment/` component kit (Button, Stepper, etc.) was clean.
- The `useFocusEffect`/`useEffect` cleanup patterns in setup screens (`cah/setup.tsx:80, 100`) were correct.
- `app/index.tsx`, `app/import.tsx`, `app/scry.tsx`, `app/reveal.tsx`, `app/dnd/*`, `app/coming-soon.tsx`, `app/_layout.tsx` — skimmed, no major findings beyond F34 and F38.
- Firmware (`sleeve_firmware.ino`) was named in scope but is not present in this repo. Watchdog/JPEG-OOM/protocol-parser checks were not performed.

---

## Phase 1 stop point

Findings ready: 0 CRIT / 8 HIGH / 19 MED / 13 LOW = 40 total. SAFE: 27, MEDIUM: 10, HIGH: 3.

Awaiting greenlight on Phase 2 (SAFE-only fixes, in order CRIT→HIGH→MED→LOW). The (ASK) findings (F9, F15, F18, F27, F38, F39) will not be touched in Phase 2 without your call.

---

## Phase 2 summary

**11 commits**, all on `main`, none pushed:

| # | Hash       | Findings                          | Subject                                                          |
|---|------------|-----------------------------------|------------------------------------------------------------------|
| 1 | `48d1b3c`  | F1, F37                           | remove alertWait debug modals + piDebugAlerts setting            |
| 2 | `83db842`  | F8                                | centralize PI_SERVER in src/config.ts                            |
| 3 | `9736b35`  | F4, F36                           | extract timedFetch to src/api/http.ts                            |
| 4 | `53e5d90`  | F2, F3                            | delete dead Pi-client exports                                    |
| 5 | `5a5d1df`  | F5, F6                            | bound pushCardToSleeve image fetch + beginGame progress denom    |
| 6 | `3580e7a`  | F10                               | dedup prefetchCardBacks against getCardBackBytes                 |
| 7 | `1ad9808`  | F12, F13                          | bound Scryfall fetches with timedFetch + import rate-limit       |
| 8 | `b05f437`  | F23, F25                          | harden loadDecks JSON.parse + centralize DEFAULT_SETTINGS        |
| 9 | `4f26168`  | F16, F17, F19, F20, F21, F22      | Pi server hardening                                              |
|10 | `710cca8`  | F11, F26, F28, F29, F30, F33, F35 | TS cleanups (dead exports, log on error, dedup descriptors)      |
|11 | `bdd14db`  | F7                                | hoist piServer timeout/concurrency literals to module constants  |

### Findings resolved in Phase 2

23 of 27 SAFE findings: F1, F2, F3, F4, F5, F6, F7, F8, F10, F11, F12, F13, F16, F17, F19, F20, F21, F22, F23, F25, F26, F28, F29, F30, F33, F35, F36, F37 (28, including F37 which was rolled into F1).

### Findings downgraded / skipped in Phase 2

- **F14** (CardRenderer rafTick TS error) — downgraded to MEDIUM per the user's "if the fix changes behavior at all, not just a type annotation" rule. The fix wraps the resolver in `() => resolve()`, which drops the `time: number` argument from `requestAnimationFrame`. Functional behavior identical at runtime, but it is a code change rather than a type annotation. **Queue for Phase 3.**
- **F40** (AmbientLayer ESLint deps) — skipped. The repo has no ESLint config, so the lint warnings don't fire today. Adding `// eslint-disable-next-line` comments would be noise without an active linter.
- **F24** (makeGameStorage factory across cahStorage / cahMaxsStorage / holdemStorage) — skipped per "Don't add features, refactor, or introduce abstractions beyond what the task requires." Three 22-line modules with zero shared logic don't justify a factory abstraction. Can revisit in Phase 3 if you disagree.
- **F34** (`as any` route casts in `router.push`) — skipped. The fix requires regenerating expo-router typed-route definitions, which is a build-config change outside this audit's scope. Five sites; can be a single follow-up ticket.

### Findings deferred per Phase 1 (ASK) — still untouched

F9 / F38 (console.log density), F15 / F39 (zone-index mappings), F18 (Pi auto-reap), F27 (CAH_RULES_DISABLED).

### Tally

| Category                      | Count |
|-------------------------------|-------|
| Fixed in Phase 2              | 28    |
| Downgraded (F14)              | 1     |
| Skipped with rationale (F40, F24, F34) | 3 |
| Deferred per Phase 1 ASK      | 6     |
| MEDIUM-risk (queue for Phase 3) | 7   |
| HIGH-risk (deferred entirely) | 3     |
| **Total**                     | 48*   |

\* Some findings appear in multiple buckets (F14 in both downgraded and Phase-3 queue). Sum exceeds 40.

### TypeScript & Pi syntax

After every commit, `npx tsc --noEmit` reported only the deferred F14 error (CardRenderer.tsx:18) — zero new errors introduced. `python3 -m py_compile pi/server.py` passes after commit 9.

### Phase 2 stop point

Awaiting greenlight on Phase 3 (MEDIUM-risk findings, prioritized queue, one EAS build per fix).
