/**
 * parchment/ChipButton — selectable chip following the gold-leaf-on-
 * parchment pattern.
 *
 *   default state — parchmentDeep fill + 1px accent.primary border, dark
 *                   ink serif label
 *   active  state — accent.primary fill (gold) + accent.dark border, dark
 *                   walnut bg.app label in displayBold
 *
 * Same idiom as the primary Save button. Optional `badge` renders a small
 * italic body line under the label (e.g. "responses only" on a CAH pack
 * chip with no prompts).
 *
 * Promoted to the parchment library after a second consumer (holdem/setup)
 * needed the same pattern beyond cah/setup. Prior to this commit it was an
 * inline helper inside cah/setup.tsx.
 */
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Theme, useTheme } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

interface Props {
  label: string;
  active: boolean;
  onPress: () => void;
  badge?: string | null;
}

export default function ChipButton({ label, active, onPress, badge }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      {badge ? (
        <Text style={[styles.chipBadge, active && styles.chipBadgeActive]}>{badge}</Text>
      ) : null}
    </Pressable>
  );
}

function makeStyles(colors: Theme) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.accent.primary,
      backgroundColor: colors.bg.parchmentDeep,
      alignItems: 'center',
      minHeight: 36,
      justifyContent: 'center',
    },
    chipActive: {
      backgroundColor: colors.accent.primary,
      borderColor: colors.accent.dark,
    },
    chipLabel: {
      color: colors.text.ink,
      fontFamily: fonts.display,
      fontSize: 13,
    },
    chipLabelActive: {
      color: colors.bg.app,
      fontFamily: fonts.displayBold,
    },
    chipBadge: {
      color: colors.text.inkSoft,
      fontFamily: fonts.bodyItalic,
      fontSize: 10,
      marginTop: 2,
    },
    chipBadgeActive: {
      color: colors.bg.app,
    },
  });
}
