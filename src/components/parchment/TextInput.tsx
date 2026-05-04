/**
 * parchment/TextInput — RN TextInput with the parchment palette baked in.
 *
 *   bg              parchmentDeep
 *   border          1px accent.primary, radius 4
 *   text color      text.ink, serif 16pt
 *   placeholder     text.muted (faded ink)
 *   selection caret accent.primary (gold)
 *
 * Stub component: no consumers in this commit. Will be picked up by the
 * later dnd/new and import.tsx migrations. Accepts and forwards all
 * standard TextInputProps; consumer-supplied `style` merges over the
 * parchment defaults (consumer wins).
 */
import { useMemo } from 'react';
import { StyleSheet, TextInput as RNTextInput } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Register, Theme, registerTokens, useTheme } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

interface Props extends TextInputProps {
  register?: Register;
}

export default function TextInput({ register = 'parchment', ...props }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors, register), [colors, register]);
  return (
    <RNTextInput
      placeholderTextColor={colors.text.muted}
      selectionColor={colors.accent.primary}
      {...props}
      style={[styles.input, props.style]}
    />
  );
}

function makeStyles(colors: Theme, register: Register) {
  const r = registerTokens(colors, register);
  return StyleSheet.create({
    input: {
      backgroundColor: r.recess,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.accent.primary,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: fonts.body,
      fontSize: 16,
      color: r.ink,
    },
  });
}
