import { useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { createGame, allSleeveUpdates } from '../../src/holdem/HoldemGame';
import { saveHoldemGame } from '../../src/storage/holdemStorage';
import { sendToSleeve, clearMemo, prefetchCardBacks } from '../../src/api/sleeveService';
import { prefetchSkin } from './game';
import { getRegisteredSleeves } from '../../src/api/piServer';
import { totalSleeveCount } from '../../src/holdem/HoldemSleeveLayout';
import { SKIN_NAMES } from '../../src/assets/skins/registry';
import { Theme, useTheme } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import TomePageFrame from '../../src/components/TomePageFrame';
import { Button, ChipButton, Stepper } from '../../src/components/parchment';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;

export default function HoldemSetupScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [playerCount, setPlayerCount] = useState(2);
  const [cardSkin, setCardSkin] = useState('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('[Setup] HoldemSetup mount — cardSkin:', cardSkin);
    const tCB = Date.now();
    console.log('[Setup] prefetchCardBacks start');
    prefetchCardBacks()
      .then(() => console.log('[Setup] prefetchCardBacks done in', Date.now() - tCB, 'ms'))
      .catch(e => console.warn('[Setup] prefetchCardBacks ERROR:', e instanceof Error ? e.message : e));
    const tSkin = Date.now();
    console.log('[Setup] prefetchSkin start —', cardSkin);
    prefetchSkin(cardSkin)
      .then(() => console.log('[Setup] prefetchSkin done in', Date.now() - tSkin, 'ms —', cardSkin))
      .catch(e => console.warn('[Setup] prefetchSkin ERROR:', e instanceof Error ? e.message : e));
  }, [cardSkin]);

  const handleStart = async () => {
    setLoading(true);
    try {
      const state = createGame(playerCount, cardSkin);
      await saveHoldemGame(state);

      // Push face-down descriptors to all sleeves to initialise displays
      clearMemo();
      const updates = allSleeveUpdates(state);
      const registered = new Set(await getRegisteredSleeves());
      for (const u of updates) {
        if (!registered.has(u.sleeveId)) {
          console.log(`[HoldemSetup] sleeve ${u.sleeveId} not registered — skipping`);
          continue;
        }
        const t0 = Date.now();
        console.log(`[HoldemSetup] sleeve ${u.sleeveId}: sendToSleeve START`);
        await sendToSleeve(u.sleeveId, u.descriptor).catch(() => {});
        console.log(`[HoldemSetup] sleeve ${u.sleeveId}: sendToSleeve DONE +${Date.now() - t0}ms`);
      }

      router.replace('/holdem/game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TomePageFrame>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Texas Hold'em</Text>

        <View style={styles.section}>
          <View style={styles.stepperRow}>
            <View style={styles.stepperLabelCol}>
              <Text style={styles.stepperLabel}>Players</Text>
              <Text style={styles.stepperHint}>
                {totalSleeveCount(playerCount)} sleeves required ({playerCount * 2} hole · 5 community)
              </Text>
            </View>
            <Stepper
              value={playerCount}
              min={MIN_PLAYERS}
              max={MAX_PLAYERS}
              onChange={setPlayerCount}
            />
          </View>
        </View>

        <View style={styles.skinSection}>
          <Text style={styles.skinLabel}>Card Skin</Text>
          <View style={styles.skinChipRow}>
            {SKIN_NAMES.map(skin => (
              <ChipButton
                key={skin}
                label={skin}
                active={cardSkin === skin}
                onPress={() => setCardSkin(skin)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.startBtnWrap}>
        <Button variant="primary" onPress={handleStart} disabled={loading}>
          {loading ? 'Starting…' : 'Start Game'}
        </Button>
      </View>
    </TomePageFrame>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16, gap: 16 },

  title: {
    color: colors.text.ink,
    fontFamily: fonts.displayBold,
    fontSize: 22,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },

  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.text.inkSoft,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  stepperLabelCol: { flex: 1, marginRight: 12, gap: 2 },
  stepperLabel: {
    color: colors.text.ink,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  stepperHint: {
    color: colors.text.inkSoft,
    fontFamily: fonts.bodyItalic,
    fontSize: 11,
  },

  skinSection: { gap: 8 },
  skinLabel: {
    color: colors.text.ink,
    fontFamily: fonts.display,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  skinChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  startBtnWrap: { marginTop: 8 },
}); }
