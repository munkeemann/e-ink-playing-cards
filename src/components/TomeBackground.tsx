/**
 * TomeBackground — app-level leather backdrop. Mounts at root behind the
 * navigator. Reads bg.app/bg.surface/divider from useTheme() so it tracks
 * theme changes (ARCANE → aged-leather; legacy themes → whatever those
 * tokens are).
 *
 * Procedural SVG, no asset files. Layer stack:
 *   1. Base radial gradient — bg.surface at center, bg.app at edges (warm
 *      center, deeper at corners — like a book lit by a candle).
 *   2. Subtle fiber Pattern at low opacity using `divider` tone, simulating
 *      leather grain. Pattern is rotated to avoid grid alignment.
 *
 * pointerEvents="none" — never intercepts touches. absoluteFill — sits
 * behind every sibling that comes later in source order.
 */
import { useMemo } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Pattern, Rect, Path } from 'react-native-svg';
import { useTheme } from '../theme/colors';

const { width: W, height: H } = Dimensions.get('window');

export default function TomeBackground() {
  const colors = useTheme();

  // Static stroke geometry; memoized so it isn't reallocated each render.
  const fiberPaths = useMemo(() => [
    'M 0 4 L 12 8',
    'M 14 0 L 22 6',
    'M 4 14 L 18 22',
    'M 24 12 L 30 18',
    'M 8 26 L 16 30',
  ], []);

  return (
    <Svg
      width={W}
      height={H}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id="leatherFill"
          cx="50%"
          cy="45%"
          rx="80%"
          ry="80%"
          fx="50%"
          fy="45%"
        >
          <Stop offset="0%" stopColor={colors.bg.surface} stopOpacity="1" />
          <Stop offset="100%" stopColor={colors.bg.app} stopOpacity="1" />
        </RadialGradient>
        <Pattern
          id="leatherFiber"
          x="0"
          y="0"
          width="32"
          height="32"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(18)"
        >
          {fiberPaths.map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke={colors.divider}
              strokeWidth="0.5"
              strokeOpacity="0.35"
              fill="none"
            />
          ))}
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width={W} height={H} fill="url(#leatherFill)" />
      <Rect x="0" y="0" width={W} height={H} fill="url(#leatherFiber)" />
    </Svg>
  );
}
