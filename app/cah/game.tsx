import { useCallback, useRef, useState, useMemo} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  advanceCah,
  allSleeveUpdates,
  CAH_PHASE_BUTTON_LABEL,
  CahSleeveUpdate,
  totalCahSleeveCount,
  // CAH_RULES_DISABLED: allSleeveUpdates, submitCard, pickWinner — submission tracking / voting
} from '../../src/cah/CahGame';
import { loadCahGame, saveCahGame, clearCahGame } from '../../src/storage/cahStorage';
import { sendToSleeve, clearMemo } from '../../src/api/sleeveService';
import { getRegisteredSleeves } from '../../src/api/piServer';
import { PI_CONCURRENCY, makeSemaphore } from '../../src/api/concurrency';
import { CahGameState } from '../../src/types/cah';
import CardRenderer, { CardRendererRef } from '../../src/shared/CardRenderer';
import { Theme, useTheme } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import TomePageFrameDark from '../../src/components/TomePageFrameDark';
import { Button } from '../../src/components/parchment';

const CAPTURE_TIMEOUT_MS = 3000;

function captureWithTimeout(p: Promise<ArrayBuffer>): Promise<ArrayBuffer> {
  return Promise.race([
    p,
    new Promise<ArrayBuffer>((_, reject) =>
      setTimeout(() => reject(new Error('capture timed out')), CAPTURE_TIMEOUT_MS),
    ),
  ]);
}

async function pushUpdates(
  updates: CahSleeveUpdate[],
  rendererRef: React.RefObject<CardRendererRef | null>,
  t0: number,
): Promise<void> {
  console.log(`[DEAL] step: getRegisteredSleeves (+${Date.now()-t0}ms)`);
  const registered = new Set(await getRegisteredSleeves());
  console.log(`[DEAL] step done: getRegisteredSleeves — [${[...registered].sort((a,b)=>a-b).join(', ')}] (+${Date.now()-t0}ms)`);
  console.log(`[DEAL] pushUpdates count=${updates.length}, registered=${registered.size}`);

  // Phase A — serial captures. CardRenderer is a single off-screen
  // component, so concurrent captures aren't safe. Updates without
  // cardText skip capture (descriptor-only / face-back).
  type Prepared = { u: CahSleeveUpdate; imageData?: ArrayBuffer };
  const prepared: Prepared[] = [];
  for (const u of updates) {
    let imageData: ArrayBuffer | undefined;
    if (u.cardText && rendererRef.current) {
      console.log(`[DEAL] step: capture sleeve=${u.sleeveId} text="${u.cardText.slice(0, 30)}" (+${Date.now()-t0}ms)`);
      try {
        imageData = await captureWithTimeout(
          rendererRef.current.capture(u.cardText, u.cardScheme ?? 'white'),
        );
        console.log(`[DEAL] step done: capture sleeve=${u.sleeveId} — ${imageData.byteLength} bytes (+${Date.now()-t0}ms)`);
      } catch (e) {
        console.warn(`[DEAL] step done: capture sleeve=${u.sleeveId} FAILED — ${e instanceof Error ? e.message : e} (+${Date.now()-t0}ms)`);
      }
    }
    prepared.push({ u, imageData });
  }

  // Phase B — parallel sends under PI_CONCURRENCY cap. Sleeves not in the
  // registered set are dropped here (preserves b361894 skip behavior); the
  // rest fan out via the shared semaphore so the network phase isn't the
  // bottleneck anymore.
  const eligible: Prepared[] = [];
  for (const p of prepared) {
    if (registered.has(p.u.sleeveId)) eligible.push(p);
    else console.log(`[DEAL] sleeve ${p.u.sleeveId} not registered — skipping`);
  }
  const total = eligible.length;
  const sem = makeSemaphore(PI_CONCURRENCY);
  const sendT0 = Date.now();

  const tasks = eligible.map(({ u, imageData }) => (async () => {
    await sem.acquire();
    const start = Date.now();
    try {
      await sendToSleeve(u.sleeveId, u.descriptor, imageData);
      const ms = Date.now() - start;
      console.log(`[DEAL] sleeve ${u.sleeveId} ✓ in ${ms}ms`);
      return { ok: true as const };
    } catch (e) {
      const ms = Date.now() - start;
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[DEAL] sleeve ${u.sleeveId} ✗ ${msg} (${ms}ms)`);
      return { ok: false as const };
    } finally {
      sem.release();
    }
  })());

  const results = await Promise.allSettled(tasks);
  const okCount = results.reduce(
    (n, r) => n + (r.status === 'fulfilled' && r.value.ok ? 1 : 0),
    0,
  );
  const elapsed = Date.now() - sendT0;
  console.log(`[DEAL] complete: ${okCount}/${total} in ${elapsed}ms`);
}

export default function CahGameScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [state, setState] = useState<CahGameState | null>(null);
  const [busy, setBusy] = useState(false);
  const rendererRef = useRef<CardRendererRef>(null);

  useFocusEffect(
    useCallback(() => {
      loadCahGame().then(s => {
        if (!s) { router.replace('/cah/setup'); return; }
        setState(s);
      });
    }, []),
  );

  if (!state) {
    return (
      <TomePageFrameDark>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent.primary} size="large" />
        </View>
      </TomePageFrameDark>
    );
  }

  const { phase, playerCount, handSize, currentBlackCard, playerHands } = state;
  // CAH_RULES_DISABLED: czarIndex, scores, submittedPlayers, submissionSlots,
  //                      revealOrder, revealedCount, roundWinner — players/turns/
  //                      submission tracking/voting/scoreboard/round winners

  const sleeveCount = totalCahSleeveCount(playerCount, handSize);
  const phaseLabel = phase.replace('_', ' ').toUpperCase();

  const handleAdvance = async () => {
    if (busy) return;
    setBusy(true);
    const t0 = Date.now();
    console.log(`[DEAL] start — phase=${state.phase} players=${state.playerCount} handSize=${state.handSize}`);
    try {
      console.log('[SLV] clearMemo called from cah handleAdvance');
      clearMemo();
      const { newState, sleeveUpdates } = advanceCah(state);
      setState(newState);

      console.log(`[DEAL] step: saveCahGame (+${Date.now()-t0}ms)`);
      await saveCahGame(newState);
      console.log(`[DEAL] step done: saveCahGame (+${Date.now()-t0}ms)`);

      console.log(`[DEAL] step: pushUpdates count=${sleeveUpdates.length} (+${Date.now()-t0}ms)`);
      await pushUpdates(sleeveUpdates, rendererRef, t0);
      console.log(`[DEAL] step done: pushUpdates (+${Date.now()-t0}ms)`);

      console.log(`[DEAL] complete (+${Date.now()-t0}ms)`);
    } catch (e) {
      console.error(`[DEAL] ERROR: ${e instanceof Error ? e.message : e} (+${Date.now()-t0}ms)`);
    } finally {
      console.log(`[DEAL] finally — setBusy(false) (+${Date.now()-t0}ms)`);
      setBusy(false);
    }
  };

  // CAH_RULES_DISABLED: submission tracking
  // const handleSubmit = async (playerIdx: number, handSlot: number) => {
  //   if (busy) return;
  //   if (phase !== 'submissions') return;
  //   setBusy(true);
  //   try {
  //     const { newState, sleeveUpdates } = submitCard(state, playerIdx, handSlot);
  //     setState(newState);
  //     await saveCahGame(newState);
  //     await pushUpdates(sleeveUpdates, rendererRef);
  //   } finally {
  //     setBusy(false);
  //   }
  // };

  // CAH_RULES_DISABLED: voting / winner selection
  // const handlePickWinner = async (winnerIdx: number) => {
  //   if (busy) return;
  //   if (phase !== 'winner' && phase !== 'reveal') return;
  //   setBusy(true);
  //   try {
  //     let workingState = state;
  //     if (phase === 'reveal') {
  //       const advanced = advanceCah({ ...state, phase: 'reveal', revealedCount: revealOrder.length });
  //       workingState = advanced.newState;
  //       await pushUpdates(advanced.sleeveUpdates, rendererRef);
  //     }
  //     const { newState } = pickWinner(
  //       { ...workingState, phase: 'winner' },
  //       winnerIdx,
  //     );
  //     setState(newState);
  //     await saveCahGame(newState);
  //   } finally {
  //     setBusy(false);
  //   }
  // };

  // Re-push current sleeve state to all sleeves — recovery action for a
  // glitched/rebooted sleeve. Reuses the existing two-phase pushUpdates
  // pipeline. clearMemo() up front so the dedup memo doesn't skip every
  // send when the app's "last known" fingerprint matches what the (now
  // blank) sleeve actually displays.
  const handleResync = async () => {
    if (busy) return;
    setBusy(true);
    const t0 = Date.now();
    console.log(`[RESYNC] start — phase=${state.phase} players=${state.playerCount}`);
    try {
      clearMemo();
      const updates = allSleeveUpdates(state);
      console.log(`[RESYNC] dispatching ${updates.length} sleeve updates`);
      await pushUpdates(updates, rendererRef, t0);
      console.log(`[RESYNC] complete (+${Date.now()-t0}ms)`);
    } catch (e) {
      console.error(`[RESYNC] ERROR: ${e instanceof Error ? e.message : e} (+${Date.now()-t0}ms)`);
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = () => {
    Alert.alert('End Game', 'End this session and return to game select?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Game',
        style: 'destructive',
        onPress: async () => {
          await clearCahGame();
          router.back();
        },
      },
    ]);
  };

  // CAH_RULES_DISABLED: submission phase button visibility
  // const showSubmit = phase === 'submissions';

  // CAH_RULES_DISABLED: winner-pick button visibility
  // const showWinnerPick = phase === 'winner' ||
  //   (phase === 'reveal' && revealedCount >= revealOrder.length);

  const buttonLabel = CAH_PHASE_BUTTON_LABEL[phase];

  // CAH_RULES_DISABLED: advance button was hidden during submissions/winner-pick phases
  const hideAdvance = false;

  return (
    <TomePageFrameDark>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Off-screen card renderer */}
        <CardRenderer ref={rendererRef} />

        {/* Phase header */}
        <View style={styles.phaseRow}>
          <View style={styles.phaseBadge}>
            <Text style={styles.phaseText}>{phaseLabel}</Text>
          </View>
          <Text style={styles.sleeveInfo}>{sleeveCount} sleeves</Text>
        </View>

        {/* Black card prompt — preserved with the CAH-physical-card colors
            (#050505 + #ffffff). Adds a thin accent.dark border so it
            integrates as a framed prompt on the dark-parchment page. */}
        <View style={styles.blackCard}>
          <Text style={styles.blackCardText}>{currentBlackCard.text}</Text>
          {currentBlackCard.pick > 1 && (
            <Text style={styles.pickBadge}>PICK {currentBlackCard.pick}</Text>
          )}
        </View>

        {/* Advance button (hidden during submissions and winner-pick) */}
        {!hideAdvance && (
          <Button onPress={handleAdvance} disabled={busy} register="dark">
            {busy ? '…' : `${buttonLabel}  →`}
          </Button>
        )}

        {/* Players */}
        <Text style={styles.sectionHeader}>Players</Text>
        <View style={styles.tableCard}>
          {Array.from({ length: playerCount }, (_, p) => {
          // CAH_RULES_DISABLED: isCzar, hasSubmitted, isWinner, submittedSlot, revealPos, isRevealed
          // — players/turns, submission tracking, voting, czar rotation, round winners

          return (
            <View
              key={p}
              style={[
                styles.playerRow,
                p < playerCount - 1 && styles.rowBorder,
              ]}
            >
              <View style={styles.playerMeta}>
                <Text style={styles.playerLabel}>
                  Player {p + 1}
                </Text>
                {/* CAH_RULES_DISABLED: score display (scoreboard) */}
                {/* <Text style={styles.playerScore}>Score: {scores[p]}</Text> */}
              </View>

              {/* Hand card count */}
              <View style={styles.handRow}>
                <Text style={styles.handCount}>{playerHands[p]?.length ?? 0} cards</Text>
              </View>

              {/* CAH_RULES_DISABLED: submit card button (submission tracking) */}
              {/* {showSubmit && !hasSubmitted && ( <Pressable ... Submit card… /> )} */}

              {/* CAH_RULES_DISABLED: winner pick button (voting / round winners) */}
              {/* {showWinnerPick && !isCzar && ( <Pressable ... Pick/Winner /> )} */}
            </View>
          );
        })}
      </View>

        {/* CAH_RULES_DISABLED: separate "Next round" button after winner picked (round winners) */}
        {/* {phase === 'winner' && roundWinner !== null && (
          <Pressable ... Next Round → </Pressable>
        )} */}

        {/* Resync sleeves — re-push current state without changing game */}
        <Button
          variant="secondary"
          register="dark"
          onPress={handleResync}
          disabled={busy}
          style={styles.resyncBtn}
        >
          {busy ? '…' : '↻ Resync Sleeves'}
        </Button>

        {/* End game */}
        <Button variant="secondary" register="dark" onPress={handleEnd} style={styles.endBtn}>
          End Game
        </Button>

      </ScrollView>
    </TomePageFrameDark>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingBottom: 16, gap: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  phaseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phaseBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: colors.bg.darkParchmentDeep,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.dark,
  },
  phaseText: {
    color: colors.accent.primary,
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  sleeveInfo: {
    color: colors.text.secondary,
    fontFamily: fonts.body,
    fontSize: 12,
  },

  // CAH-specific: the black-prompt-card visual matches the physical Cards
  // Against Humanity card. Pure-black + white text are intentional
  // game-element colors, not theme tokens — preserved across the
  // dark-parchment migration. The border is migrated to accent.dark so
  // it integrates as a framed prompt on the dark page.
  blackCard: {
    backgroundColor: '#050505',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.dark,
    padding: 16,
    minHeight: 80,
    justifyContent: 'center',
  },
  blackCardText: { color: '#ffffff', fontSize: 16, fontWeight: '600', lineHeight: 22 },
  pickBadge: {
    color: '#ffffff',
    opacity: 0.6,
    fontFamily: fonts.display,
    fontSize: 11,
    marginTop: 8,
    letterSpacing: 1.5,
  },

  sectionHeader: {
    color: colors.accent.primary,
    fontFamily: fonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 8,
  },

  tableCard: {
    backgroundColor: colors.bg.darkParchmentDeep,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.dark,
    overflow: 'hidden',
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.text.disabled },
  winnerRow: { backgroundColor: colors.bg.darkParchmentDeep },

  playerRow: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  playerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playerLabel: {
    color: colors.text.primary,
    fontFamily: fonts.body,
    fontSize: 14,
    flex: 1,
  },
  winnerLabel: { color: colors.status.success },
  playerScore: { color: colors.text.secondary, fontFamily: fonts.body, fontSize: 12 },
  submittedTag: {
    color: colors.accent.primary,
    fontFamily: fonts.display,
    fontSize: 10,
    letterSpacing: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.bg.darkParchmentDeep,
    borderWidth: 1,
    borderColor: colors.accent.dark,
  },

  // CAH_RULES_DISABLED: hand/submit/cardChip/winPick styles below remain
  // for the rules-disabled paths in this file. Migrated to dark-register
  // tokens for consistency in case the rules ever come back.
  handRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  handCount: { color: colors.text.secondary, fontFamily: fonts.body, fontSize: 12 },
  submitBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    backgroundColor: colors.bg.darkParchment,
    borderWidth: 1,
    borderColor: colors.accent.dark,
  },
  submitBtnPressed: { backgroundColor: colors.bg.darkParchment, borderColor: colors.accent.primary },
  submitBtnText: { color: colors.accent.primary, fontFamily: fonts.display, fontSize: 12 },
  cardChip: {
    minWidth: 44,
    maxWidth: 90,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: colors.bg.darkParchment,
    borderWidth: 1,
    borderColor: colors.accent.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardChipSubmitted: { borderColor: colors.accent.primary, backgroundColor: colors.bg.darkParchmentDeep },
  cardChipRevealed: { borderColor: colors.status.success, backgroundColor: colors.bg.darkParchmentDeep, maxWidth: 200 },
  cardChipPressed: { backgroundColor: colors.bg.darkParchment, borderColor: colors.accent.primary },
  cardChipText: { color: colors.text.secondary, fontFamily: fonts.body, fontSize: 12, textAlign: 'center' },
  cardChipTextRevealed: { color: colors.text.primary, fontSize: 11 },

  winPickBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: colors.bg.darkParchment,
    borderWidth: 1,
    borderColor: colors.accent.dark,
  },
  winPickBtnPressed: { backgroundColor: colors.bg.darkParchment },
  winPickBtnWon: { backgroundColor: colors.bg.darkParchmentDeep, borderColor: colors.status.success },
  winPickBtnText: { color: colors.text.primary, fontFamily: fonts.display, fontSize: 13 },
  winPickBtnTextWon: { color: colors.status.success },

  resyncBtn: { marginTop: 8 },
  endBtn: { marginTop: 4 },
}); }
