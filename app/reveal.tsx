import { useCallback, useState, useMemo} from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { getDeck, saveDeck } from '../src/storage/deckStorage';
import { CardInstance, Deck } from '../src/types';
import { Theme, useTheme } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import TomePageFrameDark from '../src/components/TomePageFrameDark';
import { Button } from '../src/components/parchment';

export default function RevealScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { deckId, count } = useLocalSearchParams<{ deckId: string; count: string }>();
  const N = Math.max(1, parseInt(count ?? '3', 10));

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<CardInstance[]>([]);
  const [artCard, setArtCard] = useState<CardInstance | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!deckId) return;
      getDeck(deckId).then(d => {
        if (!d) return;
        setDeck(d);
        const library = d.cards
          .filter(c => c.zone === 'LIB')
          .sort((a, b) => parseInt(a.place, 10) - parseInt(b.place, 10));
        setCards(library.slice(0, N));
      });
    }, [deckId, N]),
  );

  if (!deck) return null;

  const moveUp = (index: number) => {
    if (index === 0) return;
    setCards(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setCards(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleConfirm = async () => {
    // Rebuild library: revealed cards in new order, then the rest unchanged
    const revealedSet = new Set(cards);
    const restLibrary = deck.cards
      .filter(c => c.zone === 'LIB' && !revealedSet.has(c))
      .sort((a, b) => parseInt(a.place, 10) - parseInt(b.place, 10));
    const newLibrary = [...cards, ...restLibrary].map((c, i) => ({ ...c, place: String(i + 1) }));
    const nonLib = deck.cards.filter(c => c.zone !== 'LIB');
    const updated = { ...deck, cards: [...nonLib, ...newLibrary] };
    await saveDeck(updated);
    // No sleeve push — reveal is app-only
    router.back();
  };

  return (
    <TomePageFrameDark>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Reveal — Top {N}</Text>
          <Text style={styles.sectionHint}>Reorder with ▲▼ · Long press art for full view</Text>
        </View>

        {cards.map((card, i) => (
          <View key={`${card.baseName}-${card.place}-${i}`} style={styles.cardRow}>
            <TouchableOpacity style={styles.moveBtn} onPress={() => moveUp(i)} disabled={i === 0}>
              <Text style={[styles.moveBtnText, i === 0 && styles.moveBtnDisabled]}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.moveBtn} onPress={() => moveDown(i)} disabled={i === cards.length - 1}>
              <Text style={[styles.moveBtnText, i === cards.length - 1 && styles.moveBtnDisabled]}>▼</Text>
            </TouchableOpacity>
            <Pressable onLongPress={() => setArtCard(card)}>
              {card.imagePath ? (
                <Image source={{ uri: card.imagePath }} style={styles.cardThumb} resizeMode="cover" />
              ) : (
                <View style={[styles.cardThumb, styles.cardThumbPlaceholder]} />
              )}
            </Pressable>
            <Pressable style={styles.cardNameContainer} onLongPress={() => setArtCard(card)}>
              <Text style={styles.cardName}>{card.displayName}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <Button variant="secondary" register="dark" onPress={() => router.back()} style={styles.footerBtn}>
          Cancel
        </Button>
        <Button register="dark" onPress={handleConfirm} style={styles.footerBtn}>
          ✓  Confirm Order
        </Button>
      </View>

      {/* Full-art overlay (long press) — kept full-bleed dark, untouched */}
      <Modal visible={artCard !== null} transparent animationType="fade" onRequestClose={() => setArtCard(null)}>
        <Pressable style={styles.artBackdrop} onPress={() => setArtCard(null)}>
          {artCard?.imagePath ? (
            <Image source={{ uri: artCard.imagePath }} style={styles.artFull} resizeMode="contain" />
          ) : null}
        </Pressable>
      </Modal>
    </TomePageFrameDark>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

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

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.disabled,
    gap: 10,
  },
  moveBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  moveBtnText: { color: colors.accent.dark, fontSize: 16 },
  moveBtnDisabled: { color: colors.text.disabled },
  cardThumb: {
    width: 44,
    height: 60,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.dark,
  },
  cardThumbPlaceholder: { backgroundColor: colors.bg.darkParchmentDeep },
  cardNameContainer: { flex: 1 },
  cardName: {
    color: colors.text.primary,
    fontFamily: fonts.body,
    fontSize: 15,
  },

  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  footerBtn: { flex: 1 },

  // Full-art viewer modal — full-bleed dark backdrop is correct for an
  // art viewer; left untouched.
  artBackdrop: { flex: 1, backgroundColor: colors.overlay.darker, alignItems: 'center', justifyContent: 'center' },
  artFull: { width: '90%', height: '80%' },
}); }
