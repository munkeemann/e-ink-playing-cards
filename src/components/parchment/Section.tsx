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
import { Register, Theme, registerTokens, useTheme } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

interface Props {
  title: string;
  hint?: string;
  children: ReactNode;
  register?: Register;
}

export default function Section({ title, hint, children, register = 'parchment' }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors, register), [colors, register]);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

function makeStyles(colors: Theme, register: Register) {
  const r = registerTokens(colors, register);
  return StyleSheet.create({
    section: { marginBottom: 24 },
    title: {
      color: r.ink,
      fontFamily: fonts.display,
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    hint: {
      color: r.inkSoft,
      fontSize: 12,
      lineHeight: 18,
      marginBottom: 8,
    },
    body: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: r.hairline,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: r.hairline,
    },
  });
}
