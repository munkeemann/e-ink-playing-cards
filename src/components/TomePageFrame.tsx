/**
 * TomePageFrame — full-screen parchment page wrapper. Mounts as the
 * primary visual surface of a screen, rendering the parchment fill plus
 * the double-line gold ornamental border and four corner ornaments.
 *
 * Insets:
 *   - Horizontal: 8px each side (leather strip visible at left/right).
 *   - Top:    safe-area top    + 12px (status bar zone shows leather).
 *   - Bottom: safe-area bottom +  8px (home indicator zone shows leather).
 *
 * Border geometry:
 *   - Outer gold rect: 14px from page edge.
 *   - Inner gold rect: 18px from page edge (~3-4px gap = parchment).
 *   - Corner ornaments: 30×30 each, anchored at the outer-rect corners.
 *
 * Parchment is uniformly bright across the page — no atmospheric
 * darkening; that lives outside the page on the leather backdrop.
 *
 * Children render on top of the parchment in a content View padded
 * inside the inner gold border.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme/colors';

export const PAGE_HORIZONTAL_INSET = 8;
export const PAGE_TOP_LEATHER_PAD = 12;
export const PAGE_BOTTOM_LEATHER_PAD = 8;
export const PAGE_BORDER_OUTER_INSET = 14;
export const PAGE_BORDER_INNER_INSET = 18;
export const PAGE_CONTENT_INSET = 28;
export const PAGE_CORNER_SIZE = 30;

/**
 * Reusable corner ornament — Candidate B vine curl + inner droplet.
 * Drawn for top-left orientation in a `size × size` box with the page
 * corner at local (0,0). For other corners, mirror via sx/sy:
 *   TL: sx= 1, sy= 1     TR: sx=-1, sy= 1
 *   BL: sx= 1, sy=-1     BR: sx=-1, sy=-1
 */
export function CornerOrnament({
  cornerX, cornerY, sx, sy, size, gold,
}: {
  cornerX: number;
  cornerY: number;
  sx: 1 | -1;
  sy: 1 | -1;
  size: number;
  gold: string;
}) {
  const transform = `translate(${cornerX}, ${cornerY}) scale(${sx}, ${sy})`;
  // Outer arc: from local (0, 0.86s) curving up to (0.86s, 0).
  // Inner droplet curl: small secondary arc with terminal dot.
  const outerD = `M 0 ${size * 0.86} C 0 ${size * 0.4}, ${size * 0.4} 0, ${size * 0.86} 0`;
  const innerD = `M ${size * 0.46} ${size * 0.53} C ${size * 0.46} ${size * 0.4}, ${size * 0.6} ${size * 0.26}, ${size * 0.73} ${size * 0.4}`;
  const dotCx = size * 0.73;
  const dotCy = size * 0.46;
  return (
    <G transform={transform}>
      <Path d={outerD} stroke={gold} strokeWidth="1.2" fill="none" />
      <Path d={innerD} stroke={gold} strokeWidth="0.8" fill="none" />
      <Circle cx={dotCx} cy={dotCy} r="0.8" fill={gold} />
    </G>
  );
}

interface Props {
  children: ReactNode;
}

export default function TomePageFrame({ children }: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) {
      setSize({ w: width, h: height });
    }
  };

  return (
    <View
      style={[
        styles.outer,
        {
          paddingHorizontal: PAGE_HORIZONTAL_INSET,
          paddingTop: insets.top + PAGE_TOP_LEATHER_PAD,
          paddingBottom: insets.bottom + PAGE_BOTTOM_LEATHER_PAD,
        },
      ]}
    >
      <View
        style={[styles.page, { backgroundColor: colors.bg.parchment }]}
        onLayout={onLayout}
      >
        {size && (
          <Svg
            width={size.w}
            height={size.h}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {/* outer gold rect */}
            <Rect
              x={PAGE_BORDER_OUTER_INSET}
              y={PAGE_BORDER_OUTER_INSET}
              width={size.w - 2 * PAGE_BORDER_OUTER_INSET}
              height={size.h - 2 * PAGE_BORDER_OUTER_INSET}
              stroke={colors.accent.primary}
              strokeWidth="1"
              fill="none"
            />
            {/* inner gold rect */}
            <Rect
              x={PAGE_BORDER_INNER_INSET}
              y={PAGE_BORDER_INNER_INSET}
              width={size.w - 2 * PAGE_BORDER_INNER_INSET}
              height={size.h - 2 * PAGE_BORDER_INNER_INSET}
              stroke={colors.accent.primary}
              strokeWidth="1"
              fill="none"
            />
            {/* four corner ornaments, anchored at outer-rect corners */}
            <CornerOrnament
              cornerX={PAGE_BORDER_OUTER_INSET}
              cornerY={PAGE_BORDER_OUTER_INSET}
              sx={1} sy={1}
              size={PAGE_CORNER_SIZE}
              gold={colors.accent.primary}
            />
            <CornerOrnament
              cornerX={size.w - PAGE_BORDER_OUTER_INSET}
              cornerY={PAGE_BORDER_OUTER_INSET}
              sx={-1} sy={1}
              size={PAGE_CORNER_SIZE}
              gold={colors.accent.primary}
            />
            <CornerOrnament
              cornerX={size.w - PAGE_BORDER_OUTER_INSET}
              cornerY={size.h - PAGE_BORDER_OUTER_INSET}
              sx={-1} sy={-1}
              size={PAGE_CORNER_SIZE}
              gold={colors.accent.primary}
            />
            <CornerOrnament
              cornerX={PAGE_BORDER_OUTER_INSET}
              cornerY={size.h - PAGE_BORDER_OUTER_INSET}
              sx={1} sy={-1}
              size={PAGE_CORNER_SIZE}
              gold={colors.accent.primary}
            />
          </Svg>
        )}
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1 },
  page: { flex: 1, overflow: 'hidden' },
  content: { flex: 1, padding: PAGE_CONTENT_INSET },
});
