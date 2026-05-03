/**
 * parchment/Button — CTA button for parchment pages.
 *
 *   variant 'primary'   (default) — gold fill, dark-walnut serif label,
 *                                   antique-gold rim border. The visual
 *                                   weight anchor of a page.
 *   variant 'secondary' (stub)    — parchmentDeep fill, gold border, dark
 *                                   serif label. Lighter than primary;
 *                                   use for non-CTA actions on parchment.
 *
 * Both variants use borderRadius 4 (rune-stamp, not pill). Pressed state
 * fades opacity to 0.85 for tactile feedback. Disabled fades to 0.4.
 */
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Theme, useTheme } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

interface Props {
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

export default function Button({
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  children,
}: Props) {
  const colors = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        isPrimary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={isPrimary ? styles.primaryLabel : styles.secondaryLabel}>
        {children}
      </Text>
    </Pressable>
  );
}

function makeStyles(colors: Theme) {
  return StyleSheet.create({
    primary: {
      backgroundColor: colors.accent.primary,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.accent.dark,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryLabel: {
      color: colors.bg.app,
      fontFamily: fonts.display,
      fontSize: 17,
      letterSpacing: 0.5,
    },
    secondary: {
      backgroundColor: colors.bg.parchmentDeep,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.accent.primary,
      paddingVertical: 14,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryLabel: {
      color: colors.text.ink,
      fontFamily: fonts.display,
      fontSize: 16,
    },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.85 },
  });
}
