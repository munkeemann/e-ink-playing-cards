/**
 * SpellbookMark — D&D open spellbook / grimoire.
 *
 * Two pages spreading from a central spine, ruled with a few faint
 * lines to suggest inscribed text, topped by a small four-pointed
 * spark to evoke arcane magic. Stroked gold and softly filled in
 * sepia at low opacity to match the other landing-page marks.
 */
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  gold: string;
  sepia: string;
}

export default function SpellbookMark({ size = 60, gold, sepia }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Left page */}
      <Path
        d="M 8 20 Q 19 17, 30 21 L 30 48 Q 19 44, 8 47 Z"
        stroke={gold}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={sepia}
        fillOpacity="0.18"
      />
      {/* Right page */}
      <Path
        d="M 52 20 Q 41 17, 30 21 L 30 48 Q 41 44, 52 47 Z"
        stroke={gold}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={sepia}
        fillOpacity="0.18"
      />
      {/* Ruled lines, left page */}
      <Path d="M 13 28 L 26 28" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
      <Path d="M 13 33 L 26 33" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
      <Path d="M 13 38 L 23 38" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
      {/* Ruled lines, right page */}
      <Path d="M 34 28 L 47 28" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
      <Path d="M 34 33 L 47 33" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
      <Path d="M 34 38 L 44 38" stroke={gold} strokeWidth="0.8" strokeLinecap="round" />
      {/* Arcane spark above the spine */}
      <Path
        d="M 30 4 L 31.4 9.6 L 36 11 L 31.4 12.4 L 30 18 L 28.6 12.4 L 24 11 L 28.6 9.6 Z"
        stroke={gold}
        strokeWidth="1"
        strokeLinejoin="round"
        fill={gold}
        fillOpacity="0.55"
      />
    </Svg>
  );
}
