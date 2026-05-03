/**
 * parchment/Row — navigable list row inside a parchment page.
 *
 * Visual: transparent bg (parchment shows through), label in dark serif,
 * optional icon to the left, optional gold chevron on the right.
 * Hairline below (text.inkSoft at hairlineWidth) by default — set
 * `showHairline={false}` for the last row of a section if the parent
 * already provides a bottom border.
 *
 * If onPress is provided the row becomes a Pressable with a
 * parchmentDeep recess fill on press; otherwise it renders as a plain
 * View.
 *
 * Stub component: no consumers in this commit. Will be picked up by the
 * later mtg/index, dnd/index, and other list-style migrations.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme, useTheme } from '../../theme/colors';

interface Props {
  label: string;
  icon?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  showHairline?: boolean;
}

export default function Row({
  label,
  icon,
  onPress,
  chevron = true,
  showHairline = true,
}: Props) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors, showHairline), [colors, showHairline]);

  const inner = (
    <>
      {icon && <View style={styles.iconWrap}>{icon}</View>}
      <Text style={styles.label}>{label}</Text>
      {chevron && onPress && <Text style={styles.chevron}>›</Text>}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.row}>{inner}</View>;
}

function makeStyles(colors: Theme, showHairline: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: 'transparent',
      borderBottomWidth: showHairline ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: colors.text.inkSoft,
    },
    rowPressed: {
      backgroundColor: colors.bg.parchmentDeep,
    },
    iconWrap: { marginRight: 12 },
    label: {
      flex: 1,
      color: colors.text.ink,
      fontFamily: 'serif',
      fontSize: 16,
    },
    chevron: {
      color: colors.accent.primary,
      fontSize: 24,
      marginLeft: 8,
    },
  });
}
