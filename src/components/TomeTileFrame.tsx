/**
 * TomeTileFrame — illuminated card-style tile chrome at 4:5 aspect.
 * Visual anatomy mirrors TomePageFrame at a smaller scale:
 *   - parchmentDeep fill (one shade darker than the page parchment).
 *   - Double-line gold border (outer + inner).
 *   - Four corner ornaments (the same vine-curl motif, scaled down).
 *   - 1px inner-shadow ring (divider color at 0.35 stroke opacity)
 *     just inside the inner gold line — fakes the recess effect since
 *     React Native has no native inset shadow.
 *
 * Pressed state lightens the fill from parchmentDeep to parchment so
 * the tile reads as "lifting toward the page surface." Border / inner
 * shadow stay constant.
 *
 * Children render absolute on top of the SVG chrome, padded inside
 * the inner-shadow ring.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../theme/colors';
import { CornerOrnament } from './TomePageFrame';

const TILE_BORDER_OUTER_INSET = 4;
const TILE_BORDER_INNER_INSET = 7;
const TILE_INNER_SHADOW_INSET = 9;
const TILE_CORNER_SIZE = 18;
const TILE_CONTENT_PADDING = 14;

interface Props {
  pressed?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export default function TomeTileFrame({ pressed = false, style, children }: Props) {
  const colors = useTheme();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.w !== width || size.h !== height) {
      setSize({ w: width, h: height });
    }
  };

  const fill = pressed ? colors.bg.parchment : colors.bg.parchmentDeep;

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: fill },
        style,
      ]}
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
            x={TILE_BORDER_OUTER_INSET}
            y={TILE_BORDER_OUTER_INSET}
            width={size.w - 2 * TILE_BORDER_OUTER_INSET}
            height={size.h - 2 * TILE_BORDER_OUTER_INSET}
            stroke={colors.accent.primary}
            strokeWidth="1"
            fill="none"
          />
          {/* inner gold rect */}
          <Rect
            x={TILE_BORDER_INNER_INSET}
            y={TILE_BORDER_INNER_INSET}
            width={size.w - 2 * TILE_BORDER_INNER_INSET}
            height={size.h - 2 * TILE_BORDER_INNER_INSET}
            stroke={colors.accent.primary}
            strokeWidth="1"
            fill="none"
          />
          {/* inner shadow ring (recess) */}
          <Rect
            x={TILE_INNER_SHADOW_INSET}
            y={TILE_INNER_SHADOW_INSET}
            width={size.w - 2 * TILE_INNER_SHADOW_INSET}
            height={size.h - 2 * TILE_INNER_SHADOW_INSET}
            stroke={colors.divider}
            strokeOpacity="0.35"
            strokeWidth="1"
            fill="none"
          />
          {/* corner ornaments anchored at outer-rect corners */}
          <CornerOrnament
            cornerX={TILE_BORDER_OUTER_INSET}
            cornerY={TILE_BORDER_OUTER_INSET}
            sx={1} sy={1}
            size={TILE_CORNER_SIZE}
            gold={colors.accent.primary}
          />
          <CornerOrnament
            cornerX={size.w - TILE_BORDER_OUTER_INSET}
            cornerY={TILE_BORDER_OUTER_INSET}
            sx={-1} sy={1}
            size={TILE_CORNER_SIZE}
            gold={colors.accent.primary}
          />
          <CornerOrnament
            cornerX={size.w - TILE_BORDER_OUTER_INSET}
            cornerY={size.h - TILE_BORDER_OUTER_INSET}
            sx={-1} sy={-1}
            size={TILE_CORNER_SIZE}
            gold={colors.accent.primary}
          />
          <CornerOrnament
            cornerX={TILE_BORDER_OUTER_INSET}
            cornerY={size.h - TILE_BORDER_OUTER_INSET}
            sx={1} sy={-1}
            size={TILE_CORNER_SIZE}
            gold={colors.accent.primary}
          />
        </Svg>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    aspectRatio: 4 / 5,
    overflow: 'hidden',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    padding: TILE_CONTENT_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
