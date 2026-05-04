/**
 * SpadeMark — Texas Hold'em spade.
 *
 * Classic spade silhouette: pointed apex, two side lobes, short stem.
 * Stroked in gold and softly filled in sepia at low opacity to match
 * the inset-illumination of the page corner ornaments.
 */
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  gold: string;
  sepia: string;
}

export default function SpadeMark({ size = 60, gold, sepia }: Props) {
  // Spade body — apex at (30,8), curves down to lobes at y≈36, then
  // curls back inward to a small triangular stem at the base.
  const body =
    'M 30 8 ' +
    'C 30 18, 50 22, 50 34 ' +
    'C 50 42, 42 46, 35 42 ' +
    'L 40 52 ' +
    'L 20 52 ' +
    'L 25 42 ' +
    'C 18 46, 10 42, 10 34 ' +
    'C 10 22, 30 18, 30 8 Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <Path
        d={body}
        stroke={gold}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill={sepia}
        fillOpacity="0.18"
      />
    </Svg>
  );
}
