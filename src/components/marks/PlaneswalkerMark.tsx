/**
 * PlaneswalkerMark — MTG planeswalker symbol.
 *
 * Stylized jagged hexagonal flame with horizontal serrations on each
 * flank, evoking the official MTG planeswalker icon without copying it
 * exactly. Drawn for a 60×60 viewBox so it slots in where a 60-pt
 * emoji previously rendered on the landing tiles.
 *
 * Visual weight is tuned to match the other three brand marks
 * (Ampersand / Spade / Cards) so they read as a coherent set: 1.4px
 * outline stroke, sepia-shadow inner fill at low opacity, gold accent
 * dot at the throat.
 */
import Svg, { Circle, Path } from 'react-native-svg';

interface Props {
  size?: number;
  gold: string;
  sepia: string;
}

export default function PlaneswalkerMark({ size = 60, gold, sepia }: Props) {
  // 12-point silhouette: top point, jagged shoulders, base curl.
  const outline =
    'M 30 6 L 38 22 L 32 24 L 44 38 L 36 40 L 40 54 ' +
    'L 20 54 L 24 40 L 16 38 L 28 24 L 22 22 Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Path
        d={outline}
        stroke={gold}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={sepia}
        fillOpacity="0.18"
      />
      <Circle cx="30" cy="32" r="1.6" fill={gold} />
    </Svg>
  );
}
