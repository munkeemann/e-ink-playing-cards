/**
 * TomePage — parchment surface for elevated regions (deck tiles, card
 * lists, modal sheets). SVG procedural, no asset files. Drop-in around any
 * group that previously used `backgroundColor: colors.bg.elevated` and
 * wants the parchment treatment.
 *
 * Layer stack inside the wrapper:
 *   1. Solid bg.elevated paint on the wrapper View — ensures something is
 *      visible during the first render before onLayout measures the size.
 *   2. Base radial gradient — bg.elevated at center, bg.surface at edges
 *      (warm parchment center, slightly aged at the rim).
 *   3. Cream fiber Pattern at low opacity using `text.muted` tone for paper
 *      grain. Rotated to break grid alignment.
 *   4. Inner vignette — radial gradient using `divider`, transparent at
 *      center, low alpha at edges. Default ON; gives "aged page" feel.
 *
 * Tier 1 ships with `variant: 'default'` only. The 'aged' branch is
 * scaffolded for future tuning (deeper vignette, shifted grain).
 */
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Pattern, Rect, Path } from 'react-native-svg';
import { useTheme } from '../theme/colors';

type Variant = 'default' | 'aged';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: Variant;
}

export default function TomePage({ children, style, variant = 'default' }: Props) {
  const colors = useTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  // 'aged' variant scaffolded for later; Tier 1 only renders 'default'.
  void variant;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) {
      setSize({ w: width, h: height });
    }
  };

  const fiberPaths = useMemo(() => [
    'M 0 5 L 10 9',
    'M 12 0 L 20 4',
    'M 4 16 L 14 22',
    'M 22 14 L 28 18',
    'M 6 24 L 14 28',
  ], []);

  return (
    <View
      style={[{ backgroundColor: colors.bg.elevated, overflow: 'hidden' }, style]}
      onLayout={onLayout}
    >
      {size && (
        <Svg
          width={size.w}
          height={size.h}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <RadialGradient
              id="parchFill"
              cx="50%"
              cy="50%"
              rx="70%"
              ry="70%"
              fx="50%"
              fy="50%"
            >
              <Stop offset="0%" stopColor={colors.bg.elevated} stopOpacity="1" />
              <Stop offset="100%" stopColor={colors.bg.surface} stopOpacity="1" />
            </RadialGradient>
            <Pattern
              id="parchFiber"
              x="0"
              y="0"
              width="28"
              height="28"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(12)"
            >
              {fiberPaths.map((d, i) => (
                <Path
                  key={i}
                  d={d}
                  stroke={colors.text.muted}
                  strokeWidth="0.4"
                  strokeOpacity="0.18"
                  fill="none"
                />
              ))}
            </Pattern>
            <RadialGradient
              id="parchVignette"
              cx="50%"
              cy="50%"
              rx="75%"
              ry="75%"
              fx="50%"
              fy="50%"
            >
              <Stop offset="55%" stopColor={colors.divider} stopOpacity="0" />
              <Stop offset="100%" stopColor={colors.divider} stopOpacity="0.45" />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#parchFill)" />
          <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#parchFiber)" />
          <Rect x="0" y="0" width={size.w} height={size.h} fill="url(#parchVignette)" />
        </Svg>
      )}
      {children}
    </View>
  );
}
