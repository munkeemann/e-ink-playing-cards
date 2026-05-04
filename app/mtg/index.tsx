import { useCallback, useState, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { deleteDeck, loadDecks } from '../../src/storage/deckStorage';
import { Deck } from '../../src/types';
import { Theme, useTheme } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import TomePageFrame from '../../src/components/TomePageFrame';

const MANA_IMAGES: Record<string, ReturnType<typeof require>> = {
  W: require('../../assets/images/white_mana.png'),
  U: require('../../assets/images/blue_mana.png'),
  B: require('../../assets/images/black_mana.png'),
  R: require('../../assets/images/red_mana.png'),
  G: require('../../assets/images/green_mana.png'),
  C: require('../../assets/images/colorless_mana.png'),
};

export default function DeckListScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [decks, setDecks] = useState<Deck[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadDecks().then(setDecks);
    }, []),
  );

  const handleDelete = (deck: Deck) => {
    Alert.alert('Delete Deck', `Delete "${deck.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDeck(deck.id);
          setDecks(prev => prev.filter(d => d.id !== deck.id));
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Deck }) => {
    const commanderNames = item.cards
      .filter(c => c.place === 'commander')
      .map(c => c.displayName);
    const subtitle = commanderNames.length > 0 ? commanderNames.join(' & ') : null;
    // Per-tile gradient id — SVG ids are global within a document, so each
    // FlatList row needs its own to avoid collisions.
    const gradientId = `tileFade-${item.id}`;
    return (
      <Pressable
        style={styles.tileOuter}
        onPress={() => router.push(`/deck/${item.id}`)}
        onLongPress={() => handleDelete(item)}
      >
        <View style={styles.tileInner}>
          {item.commanderImagePath ? (
            <Image
              source={{ uri: item.commanderImagePath }}
              style={styles.tileImg}
            />
          ) : (
            <View style={[styles.tileImg, styles.tilePlaceholder]} />
          )}
          <Svg
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.55" stopColor="#000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000" stopOpacity="0.75" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
          </Svg>

          <View style={styles.tileContent} pointerEvents="none">
            <Text style={styles.tileName} numberOfLines={2}>{item.name}</Text>
            {subtitle && (
              <Text style={styles.tileCommander} numberOfLines={1}>{subtitle}</Text>
            )}
            <View style={styles.tileFooter}>
              <View style={styles.colorRow}>
                {item.colors.map(c => MANA_IMAGES[c] ? (
                  <Image key={c} source={MANA_IMAGES[c]} style={styles.manaIcon} />
                ) : null)}
              </View>
              <Text style={styles.cardCount}>{item.cards.length} cards</Text>
            </View>
          </View>

          <Pressable
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
            hitSlop={8}
          >
            <Text style={styles.deleteBtnLabel}>✕</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <TomePageFrame>
      {decks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No Decks</Text>
          <Text style={styles.emptyHint}>Tap + to import your first deck</Text>
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={d => d.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
      <Pressable style={styles.fab} onPress={() => router.push('/import')}>
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>
    </TomePageFrame>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  list: { paddingBottom: 96 },

  // ── Tile chrome ──────────────────────────────────────────────────────────
  // Outer Pressable: parchmentDeep fill in the 3px border-gap, 1px gold rim.
  // Inner View: 1px gold rim with overflow hidden, holds the commander image
  // + bottom gradient + content stack. The 3px gap between the two gold rims
  // is the "double-line gold border" idiom used elsewhere in the parchment
  // chrome (TomePageFrame, TomeTileFrame).
  //
  // Aspect 16:9 + an inner Image at the card's natural ~488/680 aspect
  // anchored top-left frames the TOP of the card (title bar +
  // illustration) — same idiom as the prior commander-banner attempt on
  // deck-preview, but applied here where it belongs: the deck-list tile.
  tileOuter: {
    width: '100%',
    aspectRatio: 16 / 9,
    marginBottom: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    backgroundColor: colors.bg.parchmentDeep,
    overflow: 'hidden',
  },
  tileInner: {
    flex: 1,
    margin: 3,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    overflow: 'hidden',
  },
  // Image: top-anchored, full inner width, with the card's natural aspect.
  // Renders ~1.394× inner-width tall, with the bottom clipped by the
  // tileInner's overflow:hidden — anchors the visible region to the TOP
  // of the card. No resizeMode='cover' (which would re-center on the
  // type line); the explicit aspectRatio + position:absolute is the crop.
  tileImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    aspectRatio: 488 / 680,
  },
  tilePlaceholder: { backgroundColor: colors.bg.parchmentDeep },

  // Content overlay sits at the bottom of the tile, on top of the gradient.
  tileContent: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
  },
  tileName: {
    color: colors.text.primary,
    fontFamily: fonts.displayBold,
    fontSize: 17,
    letterSpacing: 0.3,
  },
  tileCommander: {
    color: colors.accent.primary,
    fontFamily: fonts.bodyItalic,
    fontSize: 12,
    marginTop: 2,
  },
  tileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorRow: { flexDirection: 'row', gap: 6 },
  manaIcon: { width: 22, height: 22 },
  cardCount: {
    color: colors.text.secondary,
    fontFamily: fonts.body,
    fontSize: 12,
  },

  // Gold-outlined delete button (replaces the cyan-era overlay.dark circle).
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    backgroundColor: colors.overlay.darker,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnLabel: {
    color: colors.text.primary,
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Empty state ──────────────────────────────────────────────────────────
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: {
    color: colors.text.ink,
    fontFamily: fonts.displayBold,
    fontSize: 22,
  },
  emptyHint: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  // ── FAB (+ import deck) ──────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    borderColor: colors.accent.dark,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.accent.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabLabel: {
    fontSize: 30,
    color: colors.bg.app,
    fontFamily: fonts.displayBold,
    lineHeight: 34,
  },
}); }
