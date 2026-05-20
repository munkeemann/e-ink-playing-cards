import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { loadDecks } from '../src/storage/deckStorage';
import { loadHoldemGame } from '../src/storage/holdemStorage';
import { loadCahGame } from '../src/storage/cahStorage';
import { loadMaxsGame } from '../src/storage/cahMaxsStorage';
import { Deck } from '../src/types';
import { HoldemGameState } from '../src/types/holdem';
import { CahGameState } from '../src/types/cah';
import { CahMaxsGameState } from '../src/types/cah_maxs';
import { clearMemo } from '../src/api/sleeveService';
import TomePageFrame from '../src/components/TomePageFrame';
import TomeTileFrame from '../src/components/TomeTileFrame';
import {
  CahCardsMark,
  PlaneswalkerMark,
  SpadeMark,
  SpellbookMark,
} from '../src/components/marks';
import { Theme, useTheme } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

type MarkComponent = (props: { size?: number; gold: string; sepia: string }) => ReactElement;

type GameDef = {
  id: string;
  shortLabel: string;
  title: string;
  Mark: MarkComponent;
  available: boolean;
  route: string;
};

const GAMES: GameDef[] = [
  { id: 'mtg',   shortLabel: 'MTG',     title: 'Magic: The Gathering',    Mark: PlaneswalkerMark, available: true, route: '/mtg' },
  { id: 'poker', shortLabel: "Hold'em", title: "Texas Hold'em",           Mark: SpadeMark,        available: true, route: '/holdem/setup' },
  { id: 'cah',   shortLabel: 'CAH',     title: 'Cards Against Humanity',  Mark: CahCardsMark,     available: true, route: '/cah/setup' },
  { id: 'dnd',   shortLabel: 'D&D',     title: 'D&D Spell Cards',         Mark: SpellbookMark,    available: true, route: '/dnd' },
];

type ResumeTarget =
  | { kind: 'mtg'; deck: Deck; ts: number }
  | { kind: 'holdem'; game: HoldemGameState; ts: number }
  | { kind: 'cah'; game: CahGameState; ts: number }
  | { kind: 'cah_maxs'; game: CahMaxsGameState; ts: number };

function EyeOfProvidence({ gold }: { gold: string }) {
  return (
    <Svg width={40} height={30} viewBox="0 0 40 30">
      <Path d="M 16 4 L 24 4 L 20 0 Z" stroke={gold} strokeWidth="1" fill="none" />
      <Path d="M 8 18 Q 20 8, 32 18 Q 20 26, 8 18 Z" stroke={gold} strokeWidth="1" fill="none" />
      <Circle cx="20" cy="18" r="3" fill={gold} />
      <Path d="M 8 12 L 4 8 M 14 8 L 12 2 M 26 8 L 28 2 M 32 12 L 36 8" stroke={gold} strokeWidth="0.8" />
    </Svg>
  );
}

function LozengeDivider({ gold, width }: { gold: string; width: number }) {
  const cy = 6;
  const cx = width / 2;
  const half = 5;
  const leftEnd = cx - half - 3;
  const rightStart = cx + half + 3;
  return (
    <Svg width={width} height={12} viewBox={`0 0 ${width} 12`}>
      <Path d={`M 8 ${cy} L ${leftEnd} ${cy}`} stroke={gold} strokeWidth="0.8" />
      <Path d={`M ${cx} ${cy - half} L ${cx + half} ${cy} L ${cx} ${cy + half} L ${cx - half} ${cy} Z`} stroke={gold} strokeWidth="1" fill="none" />
      <Path d={`M ${rightStart} ${cy} L ${width - 8} ${cy}`} stroke={gold} strokeWidth="0.8" />
    </Svg>
  );
}

function FleuronDivider({ gold }: { gold: string }) {
  return (
    <Svg width={44} height={6} viewBox="0 0 44 6">
      <Path d="M 4 3 L 18 3" stroke={gold} strokeWidth="0.6" />
      <Path d="M 22 0.5 L 24.5 3 L 22 5.5 L 19.5 3 Z" stroke={gold} strokeWidth="0.7" fill="none" />
      <Path d="M 26 3 L 40 3" stroke={gold} strokeWidth="0.6" />
    </Svg>
  );
}

function IdentifyMark({ size = 60, gold, sepia }: { size?: number; gold: string; sepia: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* card silhouette — same rounded-rect motif as a sleeve display */}
      <Rect
        x={16}
        y={8}
        width={28}
        height={44}
        rx={3}
        stroke={gold}
        strokeWidth="1.4"
        fill={sepia}
        fillOpacity="0.18"
      />
      {/* big numeral as the "this sleeve is N" stamp */}
      <SvgText
        x={30}
        y={36}
        textAnchor="middle"
        fill={gold}
        fontSize={22}
        fontWeight="700"
      >
        #
      </SvgText>
      {/* faint zone-strip cues at the bottom of the card */}
      <Path d="M 20 44 L 26 44" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
      <Path d="M 28 44 L 34 44" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
      <Path d="M 36 44 L 40 44" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
    </Svg>
  );
}

const DIAGNOSTICS_TILE: GameDef = {
  id: 'diag',
  shortLabel: 'Diagnostics',
  title: 'Sleeve Diagnostics',
  Mark: IdentifyMark,
  available: true,
  route: '/diagnostics',
};

export default function GameSelectScreen() {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [resume, setResume] = useState<ResumeTarget | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        loadDecks().then(decks => {
          const deck = decks
            .filter(d => d.gameInProgress)
            .sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))[0] ?? null;
          return deck
            ? ({ kind: 'mtg', deck, ts: deck.lastPlayedAt ?? 0 } as ResumeTarget)
            : null;
        }),
        loadHoldemGame().then(game =>
          game ? ({ kind: 'holdem', game, ts: game.startedAt } as ResumeTarget) : null,
        ),
        loadCahGame().then(game =>
          game ? ({ kind: 'cah', game, ts: game.startedAt } as ResumeTarget) : null,
        ),
        loadMaxsGame().then(game =>
          game ? ({ kind: 'cah_maxs', game, ts: game.startedAt } as ResumeTarget) : null,
        ),
      ]).then(([mtg, holdem, cah, cahMaxs]) => {
        const candidates = [mtg, holdem, cah, cahMaxs].filter((c): c is ResumeTarget => c !== null);
        if (candidates.length === 0) { setResume(null); return; }
        setResume(candidates.reduce((best, c) => (c.ts > best.ts ? c : best)));
      });
    }, []),
  );

  const handleResume = () => {
    if (!resume) return;
    if (resume.kind === 'mtg') router.push(`/game/${resume.deck.id}` as any);
    else if (resume.kind === 'holdem') router.push('/holdem/game');
    else if (resume.kind === 'cah_maxs') router.push('/cah/game_maxs');
    else router.push('/cah/game');
  };

  const resumeName =
    resume?.kind === 'mtg'
      ? resume.deck.name
      : resume?.kind === 'holdem'
        ? `Hold'em — ${resume.game.playerCount} players`
        : resume?.kind === 'cah'
          ? `CAH — ${resume.game.playerCount} players`
          : resume?.kind === 'cah_maxs'
            ? `CAH Max's — ${resume.game.playerCount} players`
            : null;

  const TileButton = ({ game }: { game: GameDef }) => {
    const Mark = game.Mark;
    return (
      <View style={styles.tileWrap}>
        <Pressable
          onPress={() => { clearMemo(); router.push(game.route as any); }}
          style={styles.tilePressable}
        >
          {({ pressed }) => (
            <TomeTileFrame pressed={pressed && game.available}>
              <View style={[styles.tileIcon, !game.available && styles.tileDim]}>
                <Mark size={60} gold={colors.accent.primary} sepia={colors.text.inkSoft} />
              </View>
              <Text style={[styles.tileLabel, !game.available && styles.tileDim]}>
                {game.shortLabel}
              </Text>
              <View style={styles.tileFleuron}>
                <FleuronDivider gold={colors.accent.primary} />
              </View>
              {!game.available && (
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonText}>SOON</Text>
                </View>
              )}
            </TomeTileFrame>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <TomePageFrame>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => router.push('/settings')}
          hitSlop={12}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
        <View style={styles.titleBlock}>
          <EyeOfProvidence gold={colors.accent.primary} />
          <Text style={styles.title}>The Arcanum</Text>
          <View style={styles.titleDivider}>
            <LozengeDivider gold={colors.accent.primary} width={240} />
          </View>
          <Text style={styles.subtitle}>DECK MANAGER</Text>
        </View>

        {resume && resumeName && (
          <Pressable style={styles.resumeBanner} onPress={handleResume}>
            <View style={styles.resumeLeft}>
              <Text style={styles.resumeLabel}>▶  RESUME</Text>
              <Text style={styles.resumeName} numberOfLines={1}>{resumeName}</Text>
            </View>
            <Text style={styles.resumeArrow}>›</Text>
          </Pressable>
        )}

        <View style={styles.grid}>
          <View style={styles.tileRow}>
            <TileButton game={GAMES[0]} />
            <TileButton game={GAMES[1]} />
          </View>
          <View style={styles.tileRow}>
            <TileButton game={GAMES[2]} />
            <TileButton game={GAMES[3]} />
          </View>
          <View style={styles.tileRow}>
            <TileButton game={DIAGNOSTICS_TILE} />
            <View style={[styles.tileWrap, styles.tilePhantom]} />
          </View>
        </View>
      </TomePageFrame>
    </View>
  );
}

function makeStyles(colors: Theme) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },

  settingsBtn: {
    position: 'absolute',
    top: 28,
    right: 28,
    padding: 8,
    zIndex: 10,
  },
  settingsIcon: { fontSize: 22 },

  titleBlock: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 18,
  },
  title: {
    color: colors.text.ink,
    fontFamily: fonts.displayBold,
    fontSize: 36,
    letterSpacing: 0.5,
    marginTop: 8,
  },
  titleDivider: {
    marginTop: 6,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.text.inkSoft,
    fontFamily: fonts.displayRegular,
    fontSize: 12,
    letterSpacing: 4,
  },

  resumeBanner: {
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bg.parchmentDeep,
    borderWidth: 1,
    borderColor: colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resumeLeft: { flex: 1, gap: 3 },
  resumeLabel: { color: colors.accent.dark, fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  resumeName: { color: colors.text.ink, fontFamily: fonts.bodyBold, fontSize: 15 },
  resumeArrow: { color: colors.accent.primary, fontSize: 28, marginLeft: 8 },

  grid: {
    flex: 1,
    justifyContent: 'center',
    gap: 14,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 14,
  },
  tileWrap: {
    flex: 1,
    aspectRatio: 4 / 5,
  },
  tilePhantom: { opacity: 0 },
  tilePressable: {
    flex: 1,
  },

  tileIcon: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    color: colors.text.ink,
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 0.5,
    marginTop: 10,
    textAlign: 'center',
  },
  tileFleuron: {
    marginTop: 6,
    alignItems: 'center',
  },
  tileDim: {
    opacity: 0.4,
  },

  comingSoonBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.bg.parchment,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  comingSoonText: { color: colors.text.inkSoft, fontSize: 8, fontWeight: '700', letterSpacing: 1.2 },
}); }
