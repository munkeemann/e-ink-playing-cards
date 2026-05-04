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
  advanceMaxs,
  maxsSleeveUpdates,
} from '../../src/cah/CahMaxsGame';
import { loadMaxsGame, saveMaxsGame, clearMaxsGame } from '../../src/storage/cahMaxsStorage';
import { sendToSleeve, clearMemo } from '../../src/api/sleeveService';
import { getRegisteredSleeves } from '../../src/api/piServer';
import { CahMaxsGameState, CahMaxsSleeveUpdate } from '../../src/types/cah_maxs';
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
  updates: CahMaxsSleeveUpdate[],
  rendererRef: React.RefObject<CardRendererRef | null>,
  t0: number,
): Promise<void> {
  console.log(`[CAH-MAXS] pushUpdates start — count=${updates.length} (+${Date.now() - t0}ms)`);
  const registered = new Set(await getRegisteredSleeves());
  console.log(`[CAH-MAXS] registered sleeves: [${[...registered].sort((a, b) => a - b).join(', ')}] (+${Date.now() - t0}ms)`);

  for (const u of updates) {
    if (!registered.has(u.sleeveId)) {
      console.log(`[CAH-MAXS] sleeve ${u.sleeveId} not registered — skipping`);
      continue;
    }
    let imageData: ArrayBuffer | undefined;
    if (u.cardText && rendererRef.current) {
      try {
        imageData = await captureWithTimeout(
          rendererRef.current.capture(u.cardText, u.cardScheme ?? 'white'),
        );
      } catch (e) {
        console.warn(`[CAH-MAXS] capture FAILED sleeve=${u.sleeveId} — ${e instanceof Error ? e.message : e}`);
      }
    }
    try {
      await sendToSleeve(u.sleeveId, u.descriptor, imageData);
    } catch (e) {
      console.warn(`[CAH-MAXS] sendToSleeve ERROR sleeve=${u.sleeveId} — ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`[CAH-MAXS] pushUpdates done (+${Date.now() - t0}ms)`);
}

export default function CahMaxsGameScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [state, setState] = useState<CahMaxsGameState | null>(null);
  const [busy, setBusy] = useState(false);
  const rendererRef = useRef<CardRendererRef>(null);

  useFocusEffect(
    useCallback(() => {
      loadMaxsGame().then(s => {
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

  const handleDeal = async () => {
    if (busy) return;
    setBusy(true);
    const t0 = Date.now();
    console.log(`[CAH-MAXS] handleDeal start — fromPhase=${state.phase}  round=${state.round}`);
    try {
      clearMemo();
      const newState = advanceMaxs(state);
      setState(newState);
      await saveMaxsGame(newState);
      const updates = maxsSleeveUpdates(newState);
      await pushUpdates(updates, rendererRef, t0);
      console.log(`[CAH-MAXS] handleDeal complete (+${Date.now() - t0}ms)`);
    } catch (e) {
      console.error(`[CAH-MAXS] handleDeal ERROR — ${e instanceof Error ? e.message : e}`);
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
          await clearMaxsGame();
          router.back();
        },
      },
    ]);
  };

  const { phase, playerCount, K, round, currentPrompt } = state;
  const phaseLabel = phase.replace('_', ' ').toUpperCase();
  const sleeveCount = 1 + playerCount * K;
  const dealLabel = phase === 'pre_deal' ? 'Deal Round 1' : `Next Round (${round + 1})`;

  return (
    <TomePageFrameDark>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* Off-screen card renderer for JPEG capture */}
        <CardRenderer ref={rendererRef} />

        {/* Phase header */}
        <View style={styles.phaseRow}>
          <View style={styles.phaseBadge}>
            <Text style={styles.phaseText}>{phaseLabel}</Text>
          </View>
          <Text style={styles.sleeveInfo}>
            Round {round} · {playerCount}p × {K}  ·  {sleeveCount} sleeves
          </Text>
        </View>

        {/* Black card prompt — preserved with the CAH-physical-card colors
            (#050505 + #ffffff). Adds a thin accent.dark border so it
            integrates as a framed prompt on the dark-parchment page. */}
        {currentPrompt && (
          <View style={styles.blackCard}>
            <Text style={styles.blackCardText}>{currentPrompt.text}</Text>
            {currentPrompt.pick > 1 && (
              <Text style={styles.pickBadge}>PICK {currentPrompt.pick}</Text>
            )}
          </View>
        )}

        {/* Deal / Next Round button */}
        <Button onPress={handleDeal} disabled={busy} register="dark">
          {busy ? '…' : `${dealLabel}  →`}
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

  // CAH-specific: see app/cah/game.tsx for rationale on the black-card
  // colors (preserved across the dark-parchment migration). Border
  // migrated to accent.dark so it integrates as a framed prompt.
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

  endBtn: { marginTop: 8 },
}); }
