/**
 * CardsMark — Cards Against Humanity fanned-cards stack.
 *
 * Three tarot-proportioned rectangles fanned around a common pivot at
 * the bottom-center. The back two cards sit lower in the stack with
 * sepia accents to suggest depth; the front card is fully gold.
 */
import Svg, { G, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  gold: string;
  sepia: string;
}

export default function CardsMark({ size = 60, gold, sepia }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <G transform="translate(30, 50)">
        <G transform="rotate(-18)">
          <Rect
            x="-9"
            y="-36"
            width="18"
            height="36"
            rx="2"
            stroke={sepia}
            strokeWidth="1.4"
            fill={sepia}
            fillOpacity="0.18"
          />
        </G>
        <G transform="rotate(18)">
          <Rect
            x="-9"
            y="-36"
            width="18"
            height="36"
            rx="2"
            stroke={sepia}
            strokeWidth="1.4"
            fill={sepia}
            fillOpacity="0.18"
          />
        </G>
        <Rect
          x="-9"
          y="-36"
          width="18"
          height="36"
          rx="2"
          stroke={gold}
          strokeWidth="1.4"
          fill={sepia}
          fillOpacity="0.18"
        />
      </G>
    </Svg>
  );
}
