/**
 * CahCardsMark — Cards Against Humanity black + white card pair.
 *
 * Two rounded-corner playing cards side by side: black on the left,
 * white on the right. Each card carries two stacked horizontal scribble
 * lines near the top (white on black, black on white) suggesting the
 * illegible cursive of a fill-in answer.
 */
import Svg, { G, Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  gold: string;
  sepia: string;
}

// Squiggle drawn from a left-anchor point; ~14 units wide, gently wavy.
const SCRIBBLE = 'M -7 0 q 1 -2 2 0 t 2 0 t 2 0 t 2 0 t 2 0 t 2 0 t 2 0';

export default function CahCardsMark({ size = 60, gold, sepia: _sepia }: Props) {
  const cardW = 22;
  const cardH = 32;
  const gap = 2;
  const groupW = cardW * 2 + gap;
  const x0 = (60 - groupW) / 2;
  const y0 = (60 - cardH) / 2;
  const leftCx = x0 + cardW / 2;
  const rightCx = x0 + cardW + gap + cardW / 2;
  const scribble1Y = y0 + 9;
  const scribble2Y = y0 + 15;

  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      {/* Black card */}
      <Rect
        x={x0}
        y={y0}
        width={cardW}
        height={cardH}
        rx={3}
        fill="#000000"
        stroke={gold}
        strokeWidth="1.2"
      />
      <G transform={`translate(${leftCx}, ${scribble1Y})`}>
        <Path d={SCRIBBLE} stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </G>
      <G transform={`translate(${leftCx}, ${scribble2Y})`}>
        <Path d={SCRIBBLE} stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </G>

      {/* White card */}
      <Rect
        x={x0 + cardW + gap}
        y={y0}
        width={cardW}
        height={cardH}
        rx={3}
        fill="#FFFFFF"
        stroke={gold}
        strokeWidth="1.2"
      />
      <G transform={`translate(${rightCx}, ${scribble1Y})`}>
        <Path d={SCRIBBLE} stroke="#000000" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </G>
      <G transform={`translate(${rightCx}, ${scribble2Y})`}>
        <Path d={SCRIBBLE} stroke="#000000" strokeWidth="1.1" strokeLinecap="round" fill="none" />
      </G>
    </Svg>
  );
}
