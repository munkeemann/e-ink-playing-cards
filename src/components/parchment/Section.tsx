/**
 * parchment/Section — flat section grouping for a parchment page.
 *
 * Renders title (uppercase serif) + optional hint (faded ink) + body.
 * The body is bracketed by hairline rules (top + bottom) using
 * text.inkSoft at hairlineWidth — subtle on parchment but defines the
 * grouping without the leather-card-on-parchment problem.
 *
 * Caller owns row layout inside the body. For row-to-row separators,
 * apply `borderTopWidth: StyleSheet.hairlineWidth, borderTopColor:
 * colors.text.inkSoft` on rows after the first.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme, useTheme } from '../../theme/colors';

interface Props {
  title: string;
  hint?: string;
  children: ReactNode;
}

export default function Section({ title, hint, children }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function makeStyles(colors: Theme) {
  return StyleSheet.create({
    section: { marginBottom: 24 },
    title: {
      color: colors.text.ink,
      fontFamily: 'serif',
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    hint: {
      color: colors.text.inkSoft,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 8,
    },
    body: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.text.inkSoft,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.text.inkSoft,
    },
  });
}
