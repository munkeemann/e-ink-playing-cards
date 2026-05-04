/**
 * parchment/Stepper — numeric +/− pair with a centered serif value.
 *
 * Visual: 38×38 buttons with parchmentDeep fill, gold hairline border,
 * dark-ink serif glyphs. borderRadius 4 (rune-stamp, not pill). Center
 * value renders in dark-ink serif at 22pt.
 *
 * onChange is called with the next integer value, clamped by min/max
 * guards. Buttons fade to opacity 0.35 when at their bound.
 */
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Register, Theme, registerTokens, useTheme } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

interface Props {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  register?: Register;
}

export default function Stepper({ value, min = -Infinity, max = Infinity, onChange, register = 'parchment' }: Props) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors, register), [colors, register]);
  const decDisabled = value <= min;
  const incDisabled = value >= max;

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, decDisabled && styles.btnDisabled]}
        onPress={() => !decDisabled && onChange(value - 1)}
        disabled={decDisabled}
      >
        <Text style={styles.glyph}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        style={[styles.btn, incDisabled && styles.btnDisabled]}
        onPress={() => !incDisabled && onChange(value + 1)}
        disabled={incDisabled}
      >
        <Text style={styles.glyph}>+</Text>
      </Pressable>
    </View>
  );
}

function makeStyles(colors: Theme, register: Register) {
  const r = registerTokens(colors, register);
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    btn: {
      width: 38,
      height: 38,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.accent.primary,
      backgroundColor: r.recess,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnDisabled: { opacity: 0.35 },
    glyph: {
      color: r.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      lineHeight: 26,
    },
    value: {
      color: r.ink,
      fontFamily: fonts.display,
      fontSize: 22,
      minWidth: 48,
      textAlign: 'center',
    },
  });
}
