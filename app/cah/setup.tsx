import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { createCahGame } from '../../src/cah/CahGame';
import { totalCahSleeveCount } from '../../src/cah/CahSleeveLayout';
import { saveCahGame } from '../../src/storage/cahStorage';
import { createMaxsGame } from '../../src/cah/CahMaxsGame';
import { totalMaxsSleeveCount } from '../../src/cah/CahMaxsLayout';
import { saveMaxsGame } from '../../src/storage/cahMaxsStorage';
import { faceDownDescriptor, sendToSleeve, clearMemo, prefetchCardBacks } from '../../src/api/sleeveService';
import { getRegisteredSleeves } from '../../src/api/piServer';
import { CahBlackCard, CahCard } from '../../src/types/cah';
import {
  listPackChips,
  DEFAULT_ACTIVE_PACK_IDS,
  PackChip,
  chipsByCategory,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  PackCategory,
} from '../../src/cah/packGroups';
import { loadActivePacks, saveActivePacks } from '../../src/storage/cahPacksStorage';
import { getPromptsForPacks, getResponsesForPacks } from '../../src/cah/CahContent';
import { Theme, useTheme } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import TomePageFrame from '../../src/components/TomePageFrame';
import { Button, ChipButton, Fleuron, Stepper } from '../../src/components/parchment';

type Ruleset = 'official' | 'maxs';

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const MIN_HAND = 5;
const MAX_HAND = 10;

const MAXS_MIN_PLAYERS = 2;
const MAXS_MAX_PLAYERS = 8;
const MAXS_MIN_K = 1;
const MAXS_MAX_K = 10;
const REGISTERED_POLL_MS = 3000;

function packBadgeText(chip: PackChip): string | null {
  if (chip.promptCount === 0 && chip.responseCount > 0) return 'responses only';
  if (chip.responseCount === 0 && chip.promptCount > 0) return 'prompts only';
  return null;
}

export default function CahSetupScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [ruleset, setRuleset] = useState<Ruleset>('maxs');
  const [playerCount, setPlayerCount] = useState(4);
  const [handSize, setHandSize] = useState(7);
  const [maxsPlayerCount, setMaxsPlayerCount] = useState(4);
  const [maxsK, setMaxsK] = useState(5);
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [activePackIds, setActivePackIds] = useState<string[]>(DEFAULT_ACTIVE_PACK_IDS);
  const [packsLoaded, setPacksLoaded] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<PackCategory>>(new Set());

  useEffect(() => {
    prefetchCardBacks();
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadActivePacks().then(ids => {
      if (cancelled) return;
      if (ids) setActivePackIds(ids);
      setPacksLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!packsLoaded) return;
    saveActivePacks(activePackIds);
  }, [activePackIds, packsLoaded]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const ids = await getRegisteredSleeves();
        if (!cancelled) setRegisteredCount(ids.length);
      } catch {
        if (!cancelled) setRegisteredCount(0);
      }
    };
    tick();
    const iv = setInterval(tick, REGISTERED_POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const chips = useMemo(() => listPackChips(), []);
  const chipsByCat = useMemo(() => chipsByCategory(), []);

  const toggleCategory = (cat: PackCategory) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };
  const activePackSet = useMemo(() => new Set(activePackIds), [activePackIds]);
  const filteredPrompts = useMemo(() => getPromptsForPacks(activePackIds), [activePackIds]);
  const filteredResponses = useMemo(() => getResponsesForPacks(activePackIds), [activePackIds]);

  const isChipActive = (chip: PackChip) =>
    chip.packIds.length > 0 && chip.packIds.every(id => activePackSet.has(id));

  const toggleChip = (chip: PackChip) => {
    const allOn = isChipActive(chip);
    setActivePackIds(prev => {
      const next = new Set(prev);
      if (allOn) {
        for (const id of chip.packIds) next.delete(id);
      } else {
        for (const id of chip.packIds) next.add(id);
      }
      return [...next];
    });
  };

  const officialSleeveCount = totalCahSleeveCount(playerCount, handSize);
  const maxsSleeveCount = totalMaxsSleeveCount(maxsPlayerCount, maxsK);
  const maxsBudgetOK = registeredCount !== null && maxsSleeveCount <= registeredCount;

  const emptySelection = activePackIds.length === 0;
  const officialPoolOK = filteredPrompts.length > 0 && filteredResponses.length > 0;
  const officialBlocked = emptySelection || !officialPoolOK;

  const maxsRequiredResponses = maxsPlayerCount * maxsK;
  const maxsPoolHasPrompt = filteredPrompts.length >= 1;
  const maxsPoolHasResponses = filteredResponses.length >= maxsRequiredResponses;
  const maxsPoolOK = maxsPoolHasPrompt && maxsPoolHasResponses;
  const maxsBlocked = emptySelection || !maxsPoolOK || !maxsBudgetOK;

  const packHint = (() => {
    if (emptySelection) return 'Select at least one pack';
    if (ruleset === 'official') {
      if (filteredPrompts.length === 0) return 'Selected packs have no prompts';
      if (filteredResponses.length === 0) return 'Selected packs have no responses';
    } else {
      if (!maxsPoolHasPrompt) return 'Selected packs have no prompts';
      if (!maxsPoolHasResponses) {
        return `Need ${maxsRequiredResponses} responses, selected packs have ${filteredResponses.length}`;
      }
    }
    return `${filteredPrompts.length} prompts · ${filteredResponses.length} responses`;
  })();

  const handleStartOfficial = async () => {
    const black: CahBlackCard[] = filteredPrompts.map((p, i) => ({
      id: i + 1,
      text: p.text,
      pick: p.pick,
    }));
    const white: CahCard[] = filteredResponses.map((r, i) => ({
      id: i + 1,
      text: r.text,
    }));

    const state = createCahGame(playerCount, handSize, black, white);
    await saveCahGame(state);

    clearMemo();
    const registered = new Set(await getRegisteredSleeves());
    for (let sid = 1; sid <= officialSleeveCount; sid++) {
      if (!registered.has(sid)) {
        console.log(`[CahSetup] sleeve ${sid} not registered — skipping`);
        continue;
      }
      const t0 = Date.now();
      console.log(`[CahSetup] sleeve ${sid}: sendToSleeve START`);
      await sendToSleeve(sid, faceDownDescriptor()).catch(() => {});
      console.log(`[CahSetup] sleeve ${sid}: sendToSleeve DONE +${Date.now() - t0}ms`);
    }

    router.replace('/cah/game');
  };

  const handleStartMaxs = async () => {
    const state = createMaxsGame(maxsPlayerCount, maxsK, filteredPrompts, filteredResponses);
    await saveMaxsGame(state);

    clearMemo();
    const registered = new Set(await getRegisteredSleeves());
    console.log(`[CAH-MAXS] setup handleStart — P=${maxsPlayerCount} K=${maxsK} sleeves=${maxsSleeveCount} registered=${registered.size} packs=${activePackIds.length}`);
    for (let sid = 1; sid <= maxsSleeveCount; sid++) {
      if (!registered.has(sid)) {
        console.log(`[CAH-MAXS] sleeve ${sid} not registered — skipping`);
        continue;
      }
      const t0 = Date.now();
      console.log(`[CAH-MAXS] sleeve ${sid}: sendToSleeve face-down START`);
      await sendToSleeve(sid, faceDownDescriptor()).catch(() => {});
      console.log(`[CAH-MAXS] sleeve ${sid}: sendToSleeve face-down DONE +${Date.now() - t0}ms`);
    }

    router.replace('/cah/game_maxs');
  };

  const startBlocked = ruleset === 'maxs' ? maxsBlocked : officialBlocked;

  const handleStart = async () => {
    if (busy) return;
    if (startBlocked) return;
    setBusy(true);
    try {
      if (ruleset === 'maxs') await handleStartMaxs();
      else await handleStartOfficial();
    } finally {
      setBusy(false);
    }
  };

  return (
    <TomePageFrame>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Cards Against Humanity</Text>
          <Text style={styles.subtitle}>
            {ruleset === 'maxs' ? "Ruleset: Max's Rules" : 'Ruleset: Official'}
          </Text>
        </View>

        {/* Ruleset picker */}
        <View style={styles.rulesetRow}>
          {(['maxs', 'official'] as const).map(r => (
            <View key={r} style={styles.rulesetChipWrap}>
              <ChipButton
                label={r === 'maxs' ? "Max's Rules" : 'Official'}
                active={ruleset === r}
                onPress={() => setRuleset(r)}
              />
            </View>
          ))}
        </View>

        {ruleset === 'official' ? (
          <>
            <View style={styles.stepperGroup}>
              <View style={styles.stepperRow}>
                <View style={styles.stepperLabelCol}>
                  <Text style={styles.stepperLabel}>Players</Text>
                  <Text style={styles.stepperHint}>Min {MIN_PLAYERS}, max {MAX_PLAYERS}</Text>
                </View>
                <Stepper
                  value={playerCount}
                  min={MIN_PLAYERS}
                  max={MAX_PLAYERS}
                  onChange={setPlayerCount}
                />
              </View>
              <View style={[styles.stepperRow, styles.stepperRowDivider]}>
                <View style={styles.stepperLabelCol}>
                  <Text style={styles.stepperLabel}>Hand size</Text>
                  <Text style={styles.stepperHint}>{MIN_HAND}–{MAX_HAND} cards per player</Text>
                </View>
                <Stepper
                  value={handSize}
                  min={MIN_HAND}
                  max={MAX_HAND}
                  onChange={setHandSize}
                />
              </View>
            </View>

            <Text style={styles.sleeveHint}>
              {officialSleeveCount} sleeves required  (1 prompt + {playerCount} × {handSize})
            </Text>
          </>
        ) : (
          <>
            <View style={styles.stepperGroup}>
              <View style={styles.stepperRow}>
                <View style={styles.stepperLabelCol}>
                  <Text style={styles.stepperLabel}>Players</Text>
                  <Text style={styles.stepperHint}>Min {MAXS_MIN_PLAYERS}, max {MAXS_MAX_PLAYERS}</Text>
                </View>
                <Stepper
                  value={maxsPlayerCount}
                  min={MAXS_MIN_PLAYERS}
                  max={MAXS_MAX_PLAYERS}
                  onChange={setMaxsPlayerCount}
                />
              </View>
              <View style={[styles.stepperRow, styles.stepperRowDivider]}>
                <View style={styles.stepperLabelCol}>
                  <Text style={styles.stepperLabel}>Cards per player (K)</Text>
                  <Text style={styles.stepperHint}>{MAXS_MIN_K}–{MAXS_MAX_K} cards per player</Text>
                </View>
                <Stepper
                  value={maxsK}
                  min={MAXS_MIN_K}
                  max={MAXS_MAX_K}
                  onChange={setMaxsK}
                />
              </View>
            </View>

            <Text style={[styles.sleeveHint, !maxsBudgetOK && styles.sleeveHintWarn]}>
              {registeredCount === null
                ? `${maxsSleeveCount} sleeves needed  (1 prompt + ${maxsPlayerCount} × ${maxsK}) · checking registered…`
                : maxsBudgetOK
                  ? `${maxsSleeveCount} sleeves needed, ${registeredCount} connected`
                  : `Needs ${maxsSleeveCount} sleeves, ${registeredCount} connected`}
            </Text>
          </>
        )}

        <View style={styles.fleuronWrap}>
          <Fleuron width={260} />
        </View>

        {/* Pack selector — categorized accordion */}
        <View style={styles.packsSection}>
          <View style={styles.packsHeaderRow}>
            <Text style={styles.sectionLabel}>Packs</Text>
            <Text style={styles.packsSummary}>
              {chips.filter(isChipActive).length} / {chips.length} selected
            </Text>
          </View>
          <Text style={[styles.packHint, (emptySelection || (ruleset === 'maxs' ? !maxsPoolOK : !officialPoolOK)) && styles.packHintWarn]}>
            {packHint}
          </Text>
          {CATEGORY_ORDER.map(cat => {
            const catChips = chipsByCat[cat];
            if (catChips.length === 0) return null;
            const expanded = expandedCats.has(cat);
            const activeCount = catChips.filter(isChipActive).length;
            return (
              <View key={cat} style={styles.categoryBlock}>
                <Pressable style={styles.categoryHeader} onPress={() => toggleCategory(cat)}>
                  <Text style={styles.categoryHeaderLabel}>{CATEGORY_LABELS[cat]}</Text>
                  <Text style={styles.categoryHeaderCount}>
                    {activeCount} / {catChips.length}
                  </Text>
                  <Text style={styles.categoryHeaderChevron}>{expanded ? '▾' : '▸'}</Text>
                </Pressable>
                {expanded && (
                  <View style={styles.categoryBody}>
                    {catChips.map(chip => {
                      const active = isChipActive(chip);
                      const badge = packBadgeText(chip);
                      return (
                        <ChipButton
                          key={chip.id}
                          label={chip.label}
                          active={active}
                          onPress={() => toggleChip(chip)}
                          badge={badge}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.startBtnWrap}>
          <Button
            variant="primary"
            onPress={handleStart}
            disabled={busy || startBlocked}
          >
            {busy
              ? 'Starting…'
              : ruleset === 'maxs' ? "Start Max's Game  →" : 'Start Game  →'}
          </Button>
        </View>
      </ScrollView>
    </TomePageFrame>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16, gap: 16 },

  header: { alignItems: 'center', paddingTop: 4, paddingBottom: 12 },
  title: {
    color: colors.text.ink,
    fontFamily: fonts.displayBold,
    fontSize: 20,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.text.inkSoft,
    fontFamily: fonts.bodyItalic,
    fontSize: 12,
    marginTop: 4,
  },

  // Stepper group (replaces leather card)
  stepperGroup: {
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
  stepperRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.text.inkSoft,
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

  sleeveHint: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
  },
  sleeveHintWarn: { color: colors.status.warning },

  rulesetRow: { flexDirection: 'row', gap: 8 },
  rulesetChipWrap: { flex: 1 },

  packsSection: { gap: 8 },
  packsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: colors.text.ink,
    fontFamily: fonts.display,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  packsSummary: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  packHint: {
    color: colors.text.inkSoft,
    fontFamily: fonts.bodyItalic,
    fontSize: 12,
  },
  packHintWarn: { color: colors.status.warning, fontFamily: fonts.bodyBold },

  categoryBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.text.inkSoft,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 12,
    gap: 10,
  },
  categoryHeaderLabel: {
    flex: 1,
    color: colors.text.ink,
    fontFamily: fonts.display,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  categoryHeaderCount: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  categoryHeaderChevron: {
    color: colors.accent.primary,
    fontSize: 14,
    minWidth: 14,
    textAlign: 'right',
  },
  categoryBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 14,
  },

  startBtnWrap: { marginTop: 8 },

  fleuronWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
}); }
