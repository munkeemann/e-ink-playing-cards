import { useCallback, useState, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { listDecks } from '../../src/storage/dndStorage';
import { DndDeck } from '../../src/types/dnd';
import { Theme, useTheme } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import TomePageFrame from '../../src/components/TomePageFrame';
import { Button } from '../../src/components/parchment';

export default function DndDeckPickerScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [decks, setDecks] = useState<DndDeck[]>([]);

  useFocusEffect(
    useCallback(() => {
      listDecks().then(setDecks);
    }, []),
  );

  const renderDeck = ({ item }: { item: DndDeck }) => {
    const modText = item.abilityMod !== undefined ? `  ·  +${item.abilityMod} mod` : '';
    const subtitle = `${item.className}  ·  Level ${item.level}${modText}`;
    return (
      <Pressable
        style={({ pressed }) => [styles.deckRow, pressed && styles.deckRowPressed]}
        onPress={() => router.push(`/dnd/${item.id}` as any)}
      >
        <View style={styles.deckBody}>
          <Text style={styles.deckName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.deckMeta}>{subtitle}</Text>
          <Text style={styles.deckSpells}>
            {item.spells.length} spell{item.spells.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Text style={styles.deckArrow}>›</Text>
      </Pressable>
    );
  };

  return (
    <TomePageFrame>
      {decks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No decks yet</Text>
          <Text style={styles.emptyHint}>Tap New Deck to build your first spell list</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={decks}
          keyExtractor={d => d.id}
          renderItem={renderDeck}
          contentContainerStyle={styles.listContent}
        />
      )}
      <View style={styles.buttonWrap}>
        <Button onPress={() => router.push('/dnd/new' as any)}>+  New Deck</Button>
      </View>
    </TomePageFrame>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingBottom: 12 },

  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.inkSoft,
  },
  deckRowPressed: {
    backgroundColor: colors.bg.parchmentDeep,
  },
  deckBody: { flex: 1, gap: 3 },
  deckName: {
    color: colors.text.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
  deckMeta: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  deckSpells: {
    color: colors.text.inkSoft,
    fontFamily: fonts.bodyItalic,
    fontSize: 11,
    marginTop: 2,
  },
  deckArrow: {
    color: colors.accent.primary,
    fontSize: 24,
    marginLeft: 8,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyTitle: {
    color: colors.text.ink,
    fontFamily: fonts.displayBold,
    fontSize: 22,
  },
  emptyHint: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: 'center',
  },

  buttonWrap: { marginTop: 8 },
}); }
