import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { assignSleeveIds, beginGame, getRegisteredSleeves } from '../../src/api/piServer';
import { clearMemo } from '../../src/api/sleeveService';
import { fetchPrintings, ScryfallPrinting } from '../../src/api/scryfall';
import { getDeck, loadSettings, saveDeck } from '../../src/storage/deckStorage';
import { AppSettings, CardInstance, Deck, TokenTemplate } from '../../src/types';
import { Theme, useTheme } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import TomePageFrame from '../../src/components/TomePageFrame';
import { Button, Fleuron } from '../../src/components/parchment';

function ArtPopupContent({ card }: { card: CardInstance | null }) {
  console.log('[ArtPopup] imagePath:', card?.imagePath);
  const colors = useTheme();
  const artPopupStyles = useMemo(() => makeArtPopupStyles(colors), [colors]);
  const [showBack, setShowBack] = useState(false);
  if (!card) return null;
  const uri = showBack && card.backImagePath ? card.backImagePath : card.imagePath;
  return (
    <View style={artPopupStyles.wrap}>
      <Image
        source={{ uri }}
        style={artPopupStyles.img}
        resizeMode="contain"
        onError={e => console.log('[ArtPopup] image load error:', JSON.stringify(e?.nativeEvent ?? e))}
      />
      {!!card.backImagePath && (
        <Pressable onPress={() => setShowBack(v => !v)} style={artPopupStyles.flipBtn}>
          <Text style={artPopupStyles.flipLabel}>{showBack ? '⟵ Front' : 'Back ⟶'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function makeArtPopupStyles(colors: Theme) { return StyleSheet.create({
  wrap: { flex: 1, width: '100%', alignItems: 'center', gap: 12 },
  img: { width: '90%', height: '80%' },
  flipBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.overlay.light,
    borderWidth: 1,
    borderColor: colors.overlay.light,
  },
  flipLabel: { color: colors.text.primary, fontSize: 14, fontWeight: '700' },
}); }

const MTG_COLORS = ['W', 'U', 'B', 'R', 'G'];
const COLOR_LABELS: Record<string, string> = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌲' };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function DeckPreviewScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });
  const [settings, setSettings] = useState<AppSettings>({
    sleeveCount: 5,
    physicalZones: ['LIB', 'HND', 'BTFLD'],
    librarySleeveDepth: 1,
    devMode: false,
    theme: 'arcane',
  });

  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');
  const [artPopupCard, setArtPopupCard] = useState<CardInstance | null>(null);

  const [pickerCard, setPickerCard] = useState<CardInstance | null>(null);
  const [printings, setPrintings] = useState<ScryfallPrinting[]>([]);
  const [printingsLoading, setPrintingsLoading] = useState(false);

  const [addTokenVisible, setAddTokenVisible] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenPower, setNewTokenPower] = useState('1');
  const [newTokenToughness, setNewTokenToughness] = useState('1');
  const [newTokenColors, setNewTokenColors] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (id) getDeck(id).then(setDeck);
      loadSettings().then(setSettings);
    }, [id]),
  );

  if (!deck) {
    return (
      <TomePageFrame>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.primary} />
        </View>
      </TomePageFrame>
    );
  }

  const commanders = deck.cards.filter(c => c.place === 'commander');
  const commander = commanders[0];
  const library = settings.devMode
    ? deck.cards
        .filter(c => c.zone === 'LIB')
        .sort((a, b) => parseInt(a.place, 10) - parseInt(b.place, 10))
    : deck.cards
        .filter(c => c.zone === 'LIB')
        .sort((a, b) => a.baseName.localeCompare(b.baseName));

  const tokens: TokenTemplate[] = Array.isArray(deck.tokens) ? deck.tokens : [];

  const gameInProgress = !!deck.gameInProgress;

  const doStartNewGame = async () => {
    setSending(true);
    setSendProgress({ sent: 0, total: 0 });
    try {
      const resetCards = deck.cards
        .filter(c => !c.isToken)
        .map(c => c.place === 'commander'
          ? { ...c, zone: 'CMD' as const, castCount: 0 }
          : { ...c, zone: 'LIB' as const });

      const libCards = resetCards.filter(c => c.zone === 'LIB');
      const nonLibCards = resetCards.filter(c => c.zone !== 'LIB');
      const shuffled = shuffle(libCards);
      const OPENING_HAND_SIZE = 7;
      const openingHand = shuffled.slice(0, OPENING_HAND_SIZE)
        .map((c, i) => ({ ...c, zone: 'HND' as const, place: String(i + 1) }));
      const remainingLib = shuffled.slice(OPENING_HAND_SIZE)
        .map((c, i) => ({ ...c, place: String(i + 1) }));
      const unsleevedCards = [...nonLibCards, ...openingHand, ...remainingLib];

      const settings = await loadSettings();
      const newCards = assignSleeveIds(unsleevedCards, settings);

      const newDeck = { ...deck, cards: newCards, gameInProgress: true, lastPlayedAt: Date.now() };
      await saveDeck(newDeck);
      setDeck(newDeck);

      const sleeves = await getRegisteredSleeves();
      clearMemo();
      await beginGame(newCards, sleeves, (sent, total) => setSendProgress({ sent, total }), undefined, settings);
      router.push(`/game/${deck.id}?freshStart=true`);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const handleBeginGame = () => {
    if (gameInProgress) {
      Alert.alert(
        'Start New Game?',
        'This will reset your current game state. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', style: 'destructive', onPress: doStartNewGame },
        ],
      );
    } else {
      doStartNewGame();
    }
  };

  const toggleNewColor = (c: string) => {
    setNewTokenColors(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c],
    );
  };

  const handleAddToken = async () => {
    if (!newTokenName.trim()) { Alert.alert('Missing name', 'Enter a token name.'); return; }
    const template: TokenTemplate = {
      name: newTokenName.trim(),
      power: newTokenPower,
      toughness: newTokenToughness,
      colors: newTokenColors,
    };
    const updated: Deck = { ...deck, tokens: [...tokens, template] };
    await saveDeck(updated);
    setDeck(updated);
    setAddTokenVisible(false);
    setNewTokenName('');
    setNewTokenPower('1');
    setNewTokenToughness('1');
    setNewTokenColors([]);
  };

  const handleDeleteToken = async (index: number) => {
    const updated: Deck = { ...deck, tokens: tokens.filter((_, i) => i !== index) };
    await saveDeck(updated);
    setDeck(updated);
  };

  const openPrintingPicker = async (card: CardInstance) => {
    setPickerCard(card);
    setPrintings([]);
    setPrintingsLoading(true);
    try {
      const results = await fetchPrintings(card.baseName);
      setPrintings(results);
    } finally {
      setPrintingsLoading(false);
    }
  };

  const closePrintingPicker = () => {
    setPickerCard(null);
    setPrintings([]);
  };

  const handleSwapPrinting = (printing: ScryfallPrinting) => {
    if (!pickerCard || !deck) return;
    const fromLabel = pickerCard.setCode
      ? `${pickerCard.baseName} (${pickerCard.setCode} ${pickerCard.collectorNumber ?? ''})`
      : pickerCard.baseName;
    const toLabel = `${printing.setName} #${printing.collectorNumber}`;
    Alert.alert(
      'Swap printing?',
      `Replace ${fromLabel} with ${toLabel}?\n\nAll copies of this printing in the deck will be updated. You can swap back anytime.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Swap',
          onPress: async () => {
            const updatedCards = deck.cards.map(c => {
              if (c.baseName !== pickerCard.baseName) return c;
              if (c.setCode !== pickerCard.setCode || c.collectorNumber !== pickerCard.collectorNumber) return c;
              return {
                ...c,
                imagePath: printing.imagePath,
                backImagePath: printing.backImagePath,
                setCode: printing.set,
                collectorNumber: printing.collectorNumber,
                scryfallId: printing.id,
              };
            });
            const updatedDeck: Deck = { ...deck, cards: updatedCards, schemaVersion: 2 };
            await saveDeck(updatedDeck);
            setDeck(updatedDeck);
            closePrintingPicker();
          },
        },
      ],
    );
  };

  const uniqueGalleryCards: CardInstance[] = (() => {
    const allCards = [...(commander ? [commander] : []), ...library];
    const seen = new Set<string>();
    const result: CardInstance[] = [];
    for (const c of allCards) {
      if (!seen.has(c.baseName)) {
        seen.add(c.baseName);
        result.push(c);
      }
    }
    return result;
  })();

  const renderCard = ({ item }: { item: CardInstance }) => (
    <Pressable
      style={({ pressed }) => [styles.cardRow, pressed && styles.cardRowPressed]}
      onPress={() => openPrintingPicker(item)}
      onLongPress={() => setArtPopupCard(item)}
    >
      <Text style={styles.cardIndex}>
        {item.place === 'commander' ? '⚔' : settings.devMode ? item.place : '·'}
      </Text>
      <View style={styles.cardNameRow}>
        <Text style={styles.cardName}>{item.displayName}</Text>
        {item.setCode && (
          <Text style={styles.cardSetBadge}>{item.setCode} · {item.collectorNumber}</Text>
        )}
      </View>
      <Text style={styles.cardPickArrow}>›</Text>
    </Pressable>
  );

  return (
    <TomePageFrame>
      <View style={styles.header}>
        {deck.commanderImagePath ? (
          <Image
            source={{ uri: deck.commanderImagePath }}
            style={styles.headerArt}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.headerArt, styles.headerArtPlaceholder]} />
        )}
        <View style={styles.headerInfo}>
          <Text style={styles.deckTitle} numberOfLines={2}>{deck.name}</Text>
          {commanders.map(cmdr => (
            <Text key={cmdr.displayName} style={styles.commanderName}>{cmdr.displayName}</Text>
          ))}
          <Text style={styles.deckMeta}>{deck.cards.length} cards total</Text>
          <Text style={[styles.devModeLabel, settings.devMode && styles.devModeLabelActive]}>
            {settings.devMode ? 'Showing actual deck order' : 'Deck order hidden'}
          </Text>
          {commanders.length === 2 && !gameInProgress && (
            <Pressable
              onPress={async () => {
                const [a, b] = commanders;
                const newCards = deck.cards.map(c => {
                  if (c === a) return b;
                  if (c === b) return a;
                  return c;
                });
                const updated: Deck = {
                  ...deck,
                  cards: newCards,
                  commanderImagePath: b.imagePath || deck.commanderImagePath,
                };
                await saveDeck(updated);
                setDeck(updated);
              }}
              style={styles.swapPartnersBtn}
            >
              <Text style={styles.swapPartnersBtnText}>↕ Swap commanders</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* View toggle */}
      <View style={styles.viewToggleBar}>
        <Pressable
          style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewToggleBtnText, viewMode === 'list' && styles.viewToggleBtnTextActive]}>≡ List</Text>
        </Pressable>
        <Pressable
          style={[styles.viewToggleBtn, viewMode === 'gallery' && styles.viewToggleBtnActive]}
          onPress={() => setViewMode('gallery')}
        >
          <Text style={[styles.viewToggleBtnText, viewMode === 'gallery' && styles.viewToggleBtnTextActive]}>▦ Gallery</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {viewMode === 'list' ? (
          <FlatList
            key="list"
            data={[...commanders, ...library]}
            keyExtractor={(c, i) => `${c.baseName}-${i}`}
            renderItem={renderCard}
            scrollEnabled={false}
          />
        ) : (
          <FlatList
            key="gallery"
            data={uniqueGalleryCards}
            keyExtractor={(c, i) => `gallery-${c.baseName}-${i}`}
            numColumns={2}
            renderItem={({ item }) => (
              <Pressable style={styles.galleryTile} onLongPress={() => setArtPopupCard(item)}>
                {item.imagePath ? (
                  <Image source={{ uri: item.imagePath }} style={styles.galleryArt} resizeMode="cover" />
                ) : (
                  <View style={[styles.galleryArt, styles.galleryArtPlaceholder]} />
                )}
                <Text style={styles.galleryName} numberOfLines={2}>{item.displayName}</Text>
              </Pressable>
            )}
            scrollEnabled={false}
            contentContainerStyle={styles.galleryGrid}
          />
        )}

        {/* Manage Tokens section */}
        <View style={styles.fleuronWrap}>
          <Fleuron width={260} />
        </View>

        <View style={[styles.sectionHeader, viewMode === 'gallery' && { marginTop: 0 }]}>
          <Text style={styles.sectionTitle}>Token Library</Text>
          <Pressable style={styles.addTokenBtn} onPress={() => setAddTokenVisible(true)}>
            <Text style={styles.addTokenBtnText}>+ Add</Text>
          </Pressable>
        </View>

        {tokens.length === 0 ? (
          <Text style={styles.emptyText}>
            No tokens saved. Add tokens to quickly create them during a game.
          </Text>
        ) : (
          tokens.map((t, i) => (
            <View key={i} style={styles.tokenRow}>
              <View style={styles.tokenInfo}>
                <Text style={styles.tokenName}>{t.name}</Text>
                <Text style={styles.tokenMeta}>
                  {t.power}/{t.toughness}
                  {t.colors.length > 0
                    ? `  ${t.colors.map(c => COLOR_LABELS[c] ?? c).join('')}`
                    : '  Colorless'}
                </Text>
              </View>
              <Pressable onPress={() => handleDeleteToken(i)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      {sending ? (
        <View style={styles.sendingBar}>
          <ActivityIndicator color={colors.accent.primary} size="small" />
          <Text style={styles.sendingText}>
            Sending sleeves… {sendProgress.sent}/{sendProgress.total}
          </Text>
        </View>
      ) : gameInProgress ? (
        <View style={styles.bottomActions}>
          <Button variant="secondary" onPress={() => router.push(`/game/${deck.id}`)} style={styles.actionBtn}>
            ▶ Resume Game
          </Button>
          <Button variant="primary" onPress={handleBeginGame} style={styles.actionBtn}>
            ⚡ Begin New Game
          </Button>
        </View>
      ) : (
        <View style={styles.bottomActionFull}>
          <Button variant="primary" onPress={handleBeginGame}>⚡ Begin Game</Button>
        </View>
      )}

      {/* Add Token Template modal — leather sheet, kept by design */}
      <Modal
        visible={addTokenVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddTokenVisible(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setAddTokenVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>New Token Favorite</Text>

            <Text style={styles.sheetLabel}>Name</Text>
            <TextInput
              style={styles.sheetInput}
              value={newTokenName}
              onChangeText={setNewTokenName}
              placeholder="e.g. Soldier, Dragon, Treasure"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="words"
              autoFocus
            />

            <View style={styles.ptRow}>
              <View style={styles.ptField}>
                <Text style={styles.sheetLabel}>Power</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={newTokenPower}
                  onChangeText={setNewTokenPower}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
              </View>
              <Text style={styles.ptSlash}>/</Text>
              <View style={styles.ptField}>
                <Text style={styles.sheetLabel}>Toughness</Text>
                <TextInput
                  style={styles.sheetInput}
                  value={newTokenToughness}
                  onChangeText={setNewTokenToughness}
                  keyboardType="number-pad"
                  selectTextOnFocus
                />
              </View>
            </View>

            <Text style={styles.sheetLabel}>Color</Text>
            <View style={styles.colorRow}>
              {MTG_COLORS.map(c => (
                <Pressable
                  key={c}
                  style={[styles.colorBtn, newTokenColors.includes(c) && styles.colorBtnActive]}
                  onPress={() => toggleNewColor(c)}
                >
                  <Text style={styles.colorBtnText}>{COLOR_LABELS[c]}</Text>
                  <Text style={[styles.colorBtnLabel, newTokenColors.includes(c) && styles.colorBtnLabelActive]}>{c}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.sheetActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddTokenVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmBtn} onPress={handleAddToken}>
                <Text style={styles.confirmBtnText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Card art popup (long press) — full-bleed by design (card showcase, not UI surface) */}
      <Modal visible={artPopupCard !== null} transparent animationType="fade" onRequestClose={() => setArtPopupCard(null)}>
        <Pressable style={styles.artBackdrop} onPress={() => setArtPopupCard(null)}>
          <ArtPopupContent card={artPopupCard} />
        </Pressable>
      </Modal>

      {/* Printing picker sheet — leather sheet, kept by design */}
      <Modal
        visible={pickerCard !== null}
        transparent
        animationType="slide"
        onRequestClose={closePrintingPicker}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closePrintingPicker}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            <View style={styles.pickerHeader}>
              <View style={styles.pickerTitleBlock}>
                <Text style={styles.pickerTitle} numberOfLines={1}>
                  {pickerCard?.baseName}
                </Text>
                {pickerCard?.setCode && (
                  <Text style={styles.pickerCurrentPrinting}>
                    Current: {pickerCard.setCode} · {pickerCard.collectorNumber}
                  </Text>
                )}
              </View>
              <Pressable style={styles.pickerCloseBtn} onPress={closePrintingPicker} hitSlop={10}>
                <Text style={styles.pickerCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            {printingsLoading ? (
              <View style={styles.pickerLoading}>
                <ActivityIndicator color={colors.accent.primary} size="large" />
                <Text style={styles.pickerLoadingText}>Loading printings…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.pickerCount}>
                  {printings.length} printing{printings.length !== 1 ? 's' : ''}
                </Text>
                <FlatList
                  data={printings}
                  keyExtractor={p => p.id}
                  style={styles.pickerList}
                  initialNumToRender={12}
                  maxToRenderPerBatch={12}
                  windowSize={5}
                  removeClippedSubviews
                  renderItem={({ item }) => {
                    const isCurrentPrinting =
                      item.set === pickerCard?.setCode &&
                      item.collectorNumber === pickerCard?.collectorNumber;
                    const year = item.releasedAt.slice(0, 4);
                    return (
                      <Pressable
                        style={({ pressed }) => [
                          styles.printingRow,
                          isCurrentPrinting && styles.printingRowCurrent,
                          pressed && styles.printingRowPressed,
                        ]}
                        onPress={() => handleSwapPrinting(item)}
                      >
                        {item.imagePath ? (
                          <Image
                            source={{ uri: item.imagePath }}
                            style={styles.printingThumb}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.printingThumb, styles.printingThumbPlaceholder]} />
                        )}
                        <View style={styles.printingInfo}>
                          <Text style={styles.printingSetName} numberOfLines={1}>
                            {item.setName}
                          </Text>
                          <Text style={styles.printingMeta}>
                            {item.set.toUpperCase()} · #{item.collectorNumber} · {year}
                          </Text>
                        </View>
                        {isCurrentPrinting ? (
                          <Text style={styles.printingCurrentBadge}>✓</Text>
                        ) : (
                          <Text style={styles.printingArrow}>›</Text>
                        )}
                      </Pressable>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.pickerEmpty}>No printings found.</Text>
                  }
                />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </TomePageFrame>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header — sits transparently on parchment, commander art floats with text alongside.
  header: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.inkSoft,
    gap: 12,
  },
  headerArt: {
    width: 80,
    height: 110,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  headerArtPlaceholder: { backgroundColor: colors.bg.parchmentDeep },
  headerInfo: { flex: 1, justifyContent: 'center', gap: 4 },
  deckTitle: {
    color: colors.text.ink,
    fontFamily: fonts.displayBold,
    fontSize: 20,
  },
  commanderName: {
    color: colors.text.inkSoft,
    fontFamily: fonts.bodyItalic,
    fontSize: 13,
  },
  swapPartnersBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    backgroundColor: colors.bg.parchmentDeep,
  },
  swapPartnersBtnText: {
    color: colors.text.ink,
    fontFamily: fonts.display,
    fontSize: 11,
  },
  deckMeta: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  devModeLabel: {
    color: colors.text.inkSoft,
    fontFamily: fonts.bodyItalic,
    fontSize: 11,
    marginTop: 2,
  },
  devModeLabelActive: { color: colors.status.warning },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 12 },

  // Card list rows
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.inkSoft,
  },
  cardRowPressed: { backgroundColor: colors.bg.parchmentDeep },
  cardIndex: {
    width: 30,
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'right',
    marginRight: 12,
  },
  cardNameRow: { flex: 1, gap: 2 },
  cardName: {
    color: colors.text.ink,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  cardSetBadge: {
    color: colors.text.inkSoft,
    fontFamily: fonts.bodyItalic,
    fontSize: 11,
  },
  cardPickArrow: {
    color: colors.accent.primary,
    fontSize: 18,
    marginLeft: 6,
  },

  // Section header (Token Library) — preceded by a Fleuron divider so the
  // top hairline is no longer needed (the fleuron provides the seam).
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 10,
  },
  fleuronWrap: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 4,
  },
  sectionTitle: {
    color: colors.text.ink,
    fontFamily: fonts.display,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  addTokenBtn: {
    backgroundColor: colors.accent.primary,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.dark,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  addTokenBtnText: {
    color: colors.bg.app,
    fontFamily: fonts.display,
    fontSize: 13,
  },
  emptyText: {
    color: colors.text.inkSoft,
    fontFamily: fonts.bodyItalic,
    fontSize: 13,
    paddingHorizontal: 8,
    paddingBottom: 12,
    lineHeight: 20,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.inkSoft,
  },
  tokenInfo: { flex: 1 },
  tokenName: {
    color: colors.text.ink,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  tokenMeta: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  deleteBtn: { padding: 8 },
  deleteBtnText: { color: colors.status.danger, fontSize: 16 },

  // Sending status bar (transient)
  sendingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: colors.bg.parchmentDeep,
    borderTopWidth: 1,
    borderTopColor: colors.accent.primary,
    marginTop: 8,
  },
  sendingText: {
    color: colors.text.ink,
    fontFamily: fonts.body,
    fontSize: 14,
  },

  // Bottom actions
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  bottomActionFull: { marginTop: 8 },
  actionBtn: { flex: 1 },

  // ── Gallery ──────────────────────────────────────────────────────────────
  galleryGrid: { padding: 4 },
  galleryTile: {
    flex: 1,
    margin: 4,
    alignItems: 'center',
  },
  galleryArt: {
    width: '100%',
    aspectRatio: 0.72,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accent.primary,
  },
  galleryArtPlaceholder: { backgroundColor: colors.bg.parchmentDeep },
  galleryName: {
    color: colors.text.ink,
    fontFamily: fonts.body,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },

  // ── View toggle ──────────────────────────────────────────────────────────
  viewToggleBar: {
    flexDirection: 'row',
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.text.inkSoft,
  },
  viewToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent.primary,
    backgroundColor: colors.bg.parchmentDeep,
  },
  viewToggleBtnActive: {
    backgroundColor: colors.accent.primary,
    borderColor: colors.accent.dark,
  },
  viewToggleBtnText: {
    color: colors.text.ink,
    fontFamily: fonts.display,
    fontSize: 14,
  },
  viewToggleBtnTextActive: {
    color: colors.bg.app,
    fontFamily: fonts.displayBold,
  },

  // ── Modals (kept leather by design) ──────────────────────────────────────
  // ArtPopup uses artBackdrop → full-bleed dark overlay so card art shows
  // edge-to-edge without parchment cropping. The two bottom-sheet modals
  // (Add Token, Printing Picker) use leather sheet styling; their content
  // is form/UI, not parchment surface, so leather reads as a separate layer.
  artBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay.darker,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay.dark, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.text.muted,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.text.muted,
    alignSelf: 'center',
    marginVertical: 10,
  },
  sheetTitle: { color: colors.accent.primary, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  sheetLabel: { color: colors.text.secondary, fontSize: 13, marginBottom: 6, marginTop: 10 },
  sheetInput: {
    backgroundColor: 'transparent',
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.text.muted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 4,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: colors.text.muted },
  cancelBtnText: { color: colors.text.muted, fontSize: 15 },
  confirmBtn: { flex: 1, backgroundColor: colors.accent.dark, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  confirmBtnText: { color: colors.accent.primary, fontSize: 15, fontWeight: '800' },

  ptRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ptField: { flex: 1 },
  ptSlash: { color: colors.text.muted, fontSize: 24, fontWeight: '700', marginTop: 16 },

  colorRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  colorBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.text.muted,
    backgroundColor: colors.overlay.light,
    gap: 4,
  },
  colorBtnActive: { borderColor: colors.accent.primary, backgroundColor: colors.overlay.light },
  colorBtnText: { fontSize: 18 },
  colorBtnLabel: { color: colors.text.muted, fontSize: 11, fontWeight: '800' },
  colorBtnLabelActive: { color: colors.accent.primary },

  // Printing picker sheet (kept leather)
  pickerSheet: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.text.muted,
    paddingBottom: 36,
    maxHeight: '88%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
  },
  pickerTitleBlock: { flex: 1, gap: 3 },
  pickerTitle: { color: colors.accent.primary, fontSize: 18, fontWeight: '800' },
  pickerCurrentPrinting: { color: colors.text.muted, fontSize: 12 },
  pickerCloseBtn: { paddingTop: 2 },
  pickerCloseBtnText: { color: colors.text.muted, fontSize: 16 },
  pickerCount: {
    color: colors.text.muted,
    fontSize: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  pickerList: { flexGrow: 0 },
  pickerLoading: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  pickerLoadingText: { color: colors.accent.primary, fontSize: 14 },
  pickerEmpty: { color: colors.text.muted, fontSize: 14, padding: 20, textAlign: 'center' },

  printingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.bg.surface,
    gap: 12,
  },
  printingRowCurrent: { backgroundColor: colors.overlay.light },
  printingRowPressed: { backgroundColor: colors.overlay.light },
  printingThumb: { width: 44, height: 62, borderRadius: 4 },
  printingThumbPlaceholder: { backgroundColor: colors.bg.surface },
  printingInfo: { flex: 1, gap: 4 },
  printingSetName: { color: colors.text.primary, fontSize: 14, fontWeight: '600' },
  printingMeta: { color: colors.text.muted, fontSize: 12 },
  printingCurrentBadge: { color: colors.accent.primary, fontSize: 18, fontWeight: '700', width: 20, textAlign: 'center' },
  printingArrow: { color: colors.text.muted, fontSize: 20, width: 20, textAlign: 'center' },
}); }
