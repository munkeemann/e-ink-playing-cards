import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { fetchCardByPrinting, fetchCards, fetchTokenImage } from '../src/api/scryfall';
import { saveDeck } from '../src/storage/deckStorage';
import { CardInstance, Deck, TokenTemplate } from '../src/types';
import { Theme, useTheme } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';
import TomePageFrame from '../src/components/TomePageFrame';
import { Button, Fleuron, TextInput } from '../src/components/parchment';

interface DeckEntry {
  name: string;
  count: number;
  setCode?: string;
  collectorNumber?: string;
  isCommander?: boolean;
}

function parseDeckList(text: string): DeckEntry[] {
  return text
    .split(/\r\n|\r|\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .flatMap(line => {
      // SAM1-69: strip a trailing "*CMDR*" marker (Tappedout convention) before regex.
      let isCommander = false;
      const cmdrMatch = line.match(/^(.*?)\s*\*CMDR\*\s*$/i);
      if (cmdrMatch) {
        isCommander = true;
        line = cmdrMatch[1].trim();
      }
      // Matches "4 Card Name" or "4 Card Name (SET) 123"
      const m = line.match(/^(\d+)\s+(.+?)(?:\s+\(([A-Za-z0-9]{2,6})\)(?:\s+(\S+))?)?$/);
      if (!m) return [];
      const [, countStr, name, setCode, collectorNumber] = m;
      const entry: DeckEntry = { count: parseInt(countStr, 10), name: name.trim() };
      if (setCode) entry.setCode = setCode.toUpperCase();
      if (collectorNumber) entry.collectorNumber = collectorNumber;
      if (isCommander) entry.isCommander = true;
      return [entry];
    });
}

function parseTokenList(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map(l => l.trim())
    .filter(Boolean);
}

export default function ImportDeckScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [deckName, setDeckName] = useState('');
  const [deckList, setDeckList] = useState('');
  const [tokenList, setTokenList] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
  const [tokenProgress, setTokenProgress] = useState<{ current: number; total: number } | null>(null);

  const handleImport = async () => {
    const trimmedName = deckName.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Enter a deck name.');
      return;
    }
    const entries = parseDeckList(deckList);
    if (entries.length === 0) {
      Alert.alert('Empty list', 'Paste a deck list first.');
      return;
    }

    // SAM1-69: detect commander entries. Explicit *CMDR* markers take precedence;
    // otherwise the first line is the (sole) commander for backward compatibility.
    const markedCommanders = entries.filter(e => e.isCommander);
    let commanderEntries: DeckEntry[];
    let libraryEntries: DeckEntry[];
    if (markedCommanders.length === 0) {
      commanderEntries = [entries[0]];
      libraryEntries = entries.slice(1);
    } else {
      if (markedCommanders.length > 2) {
        Alert.alert('Too many commanders', `Found ${markedCommanders.length} cards marked *CMDR*. A deck has at most two commanders (Partner).`);
        return;
      }
      commanderEntries = markedCommanders;
      libraryEntries = entries.filter(e => !e.isCommander);
    }

    const librarySlots: DeckEntry[] = [];
    for (const e of libraryEntries) {
      for (let i = 0; i < e.count; i++) librarySlots.push(e);
    }

    const uniqueNames = [
      ...new Set([...commanderEntries.map(e => e.name), ...librarySlots.map(e => e.name)]),
    ];

    const allEntries = [...commanderEntries, ...libraryEntries];
    const uniquePrintings = [...new Map(
      allEntries
        .filter(e => e.setCode && e.collectorNumber)
        .map(e => [`${e.setCode}/${e.collectorNumber}`, e]),
    ).values()];

    const totalSteps = uniqueNames.length + uniquePrintings.length;
    setProgress({ current: 0, total: totalSteps });
    setDownloadPercent(null);
    setTokenProgress(null);
    setImporting(true);

    try {
      let stepsDone = 0;
      const { results, errors } = await fetchCards(
        uniqueNames,
        (done) => {
          stepsDone = done;
          setProgress({ current: stepsDone, total: totalSteps });
        },
        (pct) => setDownloadPercent(pct),
      );

      if (errors.length > 0) {
        console.warn('Some cards failed:', errors);
      }

      type FetchedCard = (typeof results)[string];
      const printingMap = new Map<string, FetchedCard>();
      for (const e of uniquePrintings) {
        const key = `${e.setCode}/${e.collectorNumber}`;
        const fetched = await fetchCardByPrinting(e.setCode!, e.collectorNumber!);
        stepsDone++;
        setProgress({ current: stepsDone, total: totalSteps });
        if (fetched) {
          printingMap.set(key, fetched);
        } else {
          console.warn(`SAM1-40: ${key} not found, falling back to name lookup for "${e.name}"`);
        }
      }

      const getResult = (e: DeckEntry): FetchedCard => {
        if (e.setCode && e.collectorNumber) {
          const specific = printingMap.get(`${e.setCode}/${e.collectorNumber}`);
          if (specific) return specific;
        }
        return results[e.name] ?? { imagePath: '', backImagePath: '', colorIdentity: [] };
      };

      // SAM1-69: validate Partner keyword when two commanders were marked.
      if (commanderEntries.length === 2) {
        const lacking: string[] = [];
        for (const c of commanderEntries) {
          const fetched = getResult(c);
          const hasPartner = (fetched.keywords ?? []).some(k => k.toLowerCase() === 'partner');
          if (!hasPartner) lacking.push(c.name);
        }
        if (lacking.length > 0) {
          Alert.alert(
            'Invalid partner pair',
            `Two commanders were marked but the Partner keyword is missing on: ${lacking.join(', ')}. Both commanders must have Partner.`,
          );
          return;
        }
      }

      const cards: CardInstance[] = [];

      for (const commanderEntry of commanderEntries) {
        for (let i = 0; i < commanderEntry.count; i++) {
          const fetched = getResult(commanderEntry);
          cards.push({
            baseName: commanderEntry.name,
            displayName:
              commanderEntry.count > 1
                ? `${commanderEntry.name} ${i + 1}`
                : commanderEntry.name,
            imagePath: fetched.imagePath,
            backImagePath: fetched.backImagePath,
            isFlipped: false,
            place: 'commander',
            zone: 'CMD',
            sleeveId: null,
            setCode: commanderEntry.setCode ?? fetched.setCode,
            collectorNumber: commanderEntry.collectorNumber ?? fetched.collectorNumber,
            scryfallId: fetched.scryfallId,
            manaValue: fetched.manaValue,
            castCount: 0,
          });
        }
      }

      librarySlots.forEach((entry, idx) => {
        const fetched = getResult(entry);
        cards.push({
          baseName: entry.name,
          displayName: entry.name,
          imagePath: fetched.imagePath,
          backImagePath: fetched.backImagePath,
          isFlipped: false,
          place: String(idx + 1),
          zone: 'LIB',
          sleeveId: null,
          setCode: entry.setCode ?? fetched.setCode,
          collectorNumber: entry.collectorNumber ?? fetched.collectorNumber,
          scryfallId: fetched.scryfallId,
          manaValue: fetched.manaValue,
        });
      });

      const seen: Record<string, number> = {};
      const totalCount: Record<string, number> = {};
      for (const c of cards.filter(c => c.place !== 'commander')) {
        totalCount[c.baseName] = (totalCount[c.baseName] ?? 0) + 1;
      }
      for (const c of cards) {
        if (c.place === 'commander') continue;
        seen[c.baseName] = (seen[c.baseName] ?? 0) + 1;
        if (totalCount[c.baseName] > 1) {
          c.displayName = `${c.baseName} ${seen[c.baseName]}`;
        }
      }

      const allColors = new Set<string>();
      for (const name of uniqueNames) {
        for (const c of results[name]?.colorIdentity ?? []) allColors.add(c);
      }

      const tokenNames = parseTokenList(tokenList);
      const tokens: TokenTemplate[] = [];

      if (tokenNames.length > 0) {
        setTokenProgress({ current: 0, total: tokenNames.length });
        for (let i = 0; i < tokenNames.length; i++) {
          const name = tokenNames[i];
          await fetchTokenImage(name, []);
          tokens.push({ name, power: '', toughness: '', colors: [] });
          setTokenProgress({ current: i + 1, total: tokenNames.length });
        }
      }

      const primaryCommander = getResult(commanderEntries[0]);
      const WUBRG = ['W', 'U', 'B', 'R', 'G'];
      const deck: Deck = {
        id: Date.now().toString(),
        name: trimmedName,
        commanderImagePath: primaryCommander.imagePath,
        colors: [...allColors].sort((a, b) => WUBRG.indexOf(a) - WUBRG.indexOf(b)),
        cards,
        tokens: tokens.length > 0 ? tokens : undefined,
        schemaVersion: 2,
      };

      await saveDeck(deck);

      const warnText =
        errors.length > 0
          ? `\n\n${errors.length} card(s) failed to fetch.`
          : '';
      Alert.alert('Imported!', `"${deck.name}" saved.${warnText}`, [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
      setDownloadPercent(null);
      setTokenProgress(null);
    }
  };

  const progressLabel = () => {
    if (downloadPercent !== null && downloadPercent < 100) {
      return (
        <Text style={styles.progressText}>
          Downloading card database…{' '}
          <Text style={styles.progressNum}>{downloadPercent}%</Text>
        </Text>
      );
    }
    if (tokenProgress !== null) {
      return (
        <Text style={styles.progressText}>
          Fetching token art…{' '}
          <Text style={styles.progressNum}>{tokenProgress.current} of {tokenProgress.total}</Text>
        </Text>
      );
    }
    return (
      <Text style={styles.progressText}>
        Looking up cards…{' '}
        <Text style={styles.progressNum}>
          {progress.current}/{progress.total}
        </Text>
      </Text>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TomePageFrame>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Deck Name</Text>
          <TextInput
            value={deckName}
            onChangeText={setDeckName}
            placeholder="e.g. Ur-Dragon"
            editable={!importing}
          />

          <Text style={styles.label}>Deck List</Text>
          <Text style={styles.hint}>
            One card per line: "1 Card Name" or "1 Card Name (SET) 123". First line is the commander; mark partner commanders with "*CMDR*" suffix on each.
          </Text>
          <TextInput
            value={deckList}
            onChangeText={setDeckList}
            placeholder={'1 The Ur-Dragon\n1 Scion of the Ur-Dragon\n4 Cultivate\n...'}
            multiline
            textAlignVertical="top"
            editable={!importing}
            style={styles.textArea}
          />

          <View style={styles.fleuronWrap}>
            <Fleuron width={260} />
          </View>

          <Text style={styles.label}>Tokens (optional)</Text>
          <Text style={styles.hint}>
            One per line — art will be pre-fetched and cached.
          </Text>
          <TextInput
            value={tokenList}
            onChangeText={setTokenList}
            placeholder={'Goblin\nTreasure\nSoldier\n...'}
            multiline
            textAlignVertical="top"
            editable={!importing}
            autoCapitalize="words"
            style={styles.tokenArea}
          />

          {importing ? (
            <View style={styles.progressBox}>
              <ActivityIndicator size="large" color={colors.accent.primary} />
              {progressLabel()}
            </View>
          ) : (
            <View style={styles.buttonWrap}>
              <Button onPress={handleImport}>Import Deck</Button>
            </View>
          )}
        </ScrollView>
      </TomePageFrame>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  kav: { flex: 1 },
  scroll: { paddingBottom: 24 },
  label: {
    color: colors.text.ink,
    fontFamily: fonts.display,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginTop: 18,
    marginBottom: 6,
  },
  hint: {
    color: colors.text.inkSoft,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: 8,
    lineHeight: 18,
  },
  textArea: { height: 300, lineHeight: 22 },
  tokenArea: { height: 120, lineHeight: 22 },
  progressBox: { marginTop: 24, alignItems: 'center', gap: 12 },
  progressText: { color: colors.text.ink, fontFamily: fonts.body, fontSize: 15 },
  progressNum: { color: colors.accent.dark, fontFamily: fonts.bodyBold },
  buttonWrap: { marginTop: 28 },

  fleuronWrap: {
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 0,
  },
}); }
