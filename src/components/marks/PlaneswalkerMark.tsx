/**
 * PlaneswalkerMark — MTG planeswalker-evocative silhouette.
 *
 * 14-point jagged figure: apex, shoulders, outstretched arms, hips and
 * feet. An artistic interpretation in the spirit of the planeswalker
 * glyph rather than a reproduction of the trademarked symbol.
 *
 * Path data is mirrored from src/assets/icons/mtg-planeswalker.svg —
 * the canonical asset. Visual treatment matches the other landing-page
 * marks: 1.4 stroke, sepia fill at low opacity.
 */
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  gold: string;
  sepia: string;
}

const FIGURE =
  'M 30 5 L 36 20 L 31 22 L 44 32 L 33 34 L 42 50 L 33 54 L 30 49 ' +
  'L 27 54 L 18 50 L 27 34 L 16 32 L 29 22 L 24 20 Z';

export default function PlaneswalkerMark({ size = 60, gold, sepia }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Path
        d={FIGURE}
        stroke={gold}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={sepia}
        fillOpacity="0.18"
      />
    </Svg>
  );
}
