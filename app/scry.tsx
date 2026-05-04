import { useCallback, useState, useMemo} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { assignSleeveIds, beginGame, getRegisteredSleeves } from '../src/api/piServer';
import { getDeck, loadSettings, saveDeck } from '../src/storage/deckStorage';
import { CardInstance, Deck } from '../src/types';
import { Theme, useTheme } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import TomePageFrameDark from '../src/components/TomePageFrameDark';
import { Button, Fleuron } from '../src/components/parchment';

export default function ScryScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { deckId, count } = useLocalSearchParams<{
    deckId: string;
    count: string;
  }>();
  const N = Math.max(1, parseInt(count ?? '3', 10));

  const [deck, setDeck] = useState<Deck | null>(null);
  const [topCards, setTopCards] = useState<CardInstance[]>([]);
  const [bottomCards, setBottomCards] = useState<CardInstance[]>([]);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!deckId) return;
      getDeck(deckId).then(d => {
        if (!d) return;
        setDeck(d);
        const library = d.cards
          .filter(c => c.zone === 'LIB')
          .sort((a, b) => parseInt(a.place, 10) - parseInt(b.place, 10));
        setTopCards(library.slice(0, N));
        setBottomCards([]);
      });
    }, [deckId, N]),
  );

  if (!deck) {
    return (
      <TomePageFrameDark>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      </TomePageFrameDark>
    );
  }

  const sendToBottom = (card: CardInstance) => {
    setTopCards(prev => prev.filter(c => c !== card));
    setBottomCards(prev => [...prev, card]);
  };

  const bringToTop = (card: CardInstance) => {
    setBottomCards(prev => prev.filter(c => c !== card));
    setTopCards(prev => [...prev, card]);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setTopCards(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setTopCards(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const moveUpBottom = (index: number) => {
    if (index === 0) return;
    setBottomCards(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDownBottom = (index: number) => {
    setBottomCards(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!deck) return;
    setBusy(true);
    try {
      const commander = deck.cards.filter(c => c.place === 'commander');
      const scrySet = new Set([...topCards, ...bottomCards]);
      const restLibrary = deck.cards
        .filter(c => c.zone === 'LIB' && !scrySet.has(c))
        .sort((a, b) => parseInt(a.place, 10) - parseInt(b.place, 10));

      const newLibrary = [...topCards, ...restLibrary, ...bottomCards].map(
        (c, i) => ({ ...c, place: String(i + 1) }),
      );

      const [sleeves, settings] = await Promise.all([getRegisteredSleeves(), loadSettings()]);

      // Preserve non-LIB, non-commander cards (hand, battlefield, graveyard, exile)
      // so they are not dropped when the deck is saved back to disk.
      const nonLibNonCommander = deck.cards.filter(c => c.zone !== 'LIB' && c.place !== 'commander');

      // Reassign sleeve IDs based on new scry order before pushing to sleeves.
      const reordered = [...commander, ...nonLibNonCommander, ...newLibrary];
      const newCards = assignSleeveIds(reordered, settings);

      const top5 = newCards
        .filter(c => c.zone === 'LIB')
        .sort((a, b) => parseInt(a.place, 10) - parseInt(b.place, 10))
        .slice(0, 5);
      console.log('[Scry] top 5 after sleeveId reassign:', top5.map(c => `"${c.displayName}" place=${c.place} sleeve=${c.sleeveId ?? 'null'}`).join(' | '));

      const updated = { ...deck, cards: newCards };
      await saveDeck(updated);
      await beginGame(newCards, sleeves, undefined, undefined, settings);
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <TomePageFrameDark>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Keep on Top ({topCards.length})
          </Text>
          <Text style={styles.sectionHint}>Use buttons to reorder · Tap name to send bottom</Text>
        </View>

        {topCards.length === 0 ? (
          <Text style={styles.emptyText}>All cards sent to bottom</Text>
        ) : (
          topCards.map((card, i) => (
            <View key={`top-${card.baseName}-${card.place}-${i}`} style={styles.cardRow}>
              <TouchableOpacity
                style={styles.moveBtn}
                onPress={() => moveUp(i)}
                disabled={i === 0}
              >
                <Text style={[styles.moveBtnText, i === 0 && styles.moveBtnDisabled]}>▲</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.moveBtn}
                onPress={() => moveDown(i)}
                disabled={i === topCards.length - 1}
              >
                <Text style={[styles.moveBtnText, i === topCards.length - 1 && styles.moveBtnDisabled]}>▼</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardNameContainer} onPress={() => sendToBottom(card)}>
                <Text style={styles.cardName}>{card.displayName}</Text>
                <Text style={styles.cardHint}>tap→bottom</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {bottomCards.length > 0 && (
          <>
            <View style={styles.fleuronWrap}>
              <Fleuron width={260} register="dark" />
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Send to Bottom ({bottomCards.length})
              </Text>
              <Text style={styles.sectionHint}>Use buttons to reorder · Tap name to restore</Text>
            </View>
            {bottomCards.map((c, i) => (
              <View key={`bot-${c.baseName}-${i}`} style={styles.bottomRow}>
                <TouchableOpacity
                  style={styles.moveBtn}
                  onPress={() => moveUpBottom(i)}
                  disabled={i === 0}
                >
                  <Text style={[styles.moveBtnText, i === 0 && styles.moveBtnDisabled]}>▲</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.moveBtn}
                  onPress={() => moveDownBottom(i)}
                  disabled={i === bottomCards.length - 1}
                >
                  <Text style={[styles.moveBtnText, i === bottomCards.length - 1 && styles.moveBtnDisabled]}>▼</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bottomNameContainer} onPress={() => bringToTop(c)}>
                  <Text style={styles.bottomName}>{c.displayName}</Text>
                  <Text style={styles.bottomHint}>↑ tap to restore</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={handleConfirm} disabled={busy} register="dark">
          {busy ? '…' : '✓  Confirm & Send Sleeves'}
        </Button>
      </View>
    </TomePageFrameDark>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  sectionHeader: {
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.disabled,
  },
  sectionTitle: {
    color: colors.accent.primary,
    fontFamily: fonts.display,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionHint: {
    color: colors.text.secondary,
    fontFamily: fonts.bodyItalic,
    fontSize: 11,
    marginTop: 4,
  },
  emptyText: {
    color: colors.text.secondary,
    fontFamily: fonts.bodyItalic,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },

  fleuronWrap: { alignItems: 'center', marginVertical: 12 },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.disabled,
    gap: 10,
  },
  moveBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  moveBtnText: { color: colors.accent.dark, fontSize: 16 },
  moveBtnDisabled: { color: colors.text.disabled },
  cardNameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardName: { color: colors.text.primary, fontFamily: fonts.body, fontSize: 15, flex: 1 },
  cardHint: { color: colors.text.secondary, fontFamily: fonts.bodyItalic, fontSize: 10 },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.disabled,
    gap: 10,
    opacity: 0.85,
  },
  bottomNameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  bottomName: { color: colors.text.secondary, fontFamily: fonts.body, fontSize: 14, flex: 1 },
  bottomHint: { color: colors.text.secondary, fontFamily: fonts.bodyItalic, fontSize: 11 },

  footer: { marginTop: 8 },
}); }
