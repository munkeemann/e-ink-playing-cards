/**
 * TomePageFrameDark — dark-register sibling of TomePageFrame.
 *
 * Geometry is intentionally identical to TomePageFrame: same outer
 * horizontal/top/bottom insets, same outer/inner gold rect positions
 * (14 / 18 from page edge), same 30×30 corner ornaments, same content
 * padding (28). Screens can swap one for the other without touching
 * layout math.
 *
 * Two and only two things differ from TomePageFrame:
 *   1. Page fill: bg.darkParchment instead of bg.parchment.
 *   2. (Reserved.) Gold tone on dark ground reads with lower perceived
 *      contrast than gold on bright parchment, achieving the "etched on
 *      vellum" feel naturally — so the gold strokes stay at full opacity
 *      accent.primary, matching Class A. If hardware test shows the
 *      gold lines read as too punchy on dark, the dimmer fallback is
 *      accent.dark.
 *
 * Every other inset/stroke-width/path is intentionally a copy of
 * TomePageFrame. If TomePageFrame's geometry changes, this file should
 * be updated in lockstep — they are sister components.
 */
import { useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../theme/colors';
import {
  CornerOrnament,
  PAGE_BORDER_INNER_INSET,
  PAGE_BORDER_OUTER_INSET,
  PAGE_BOTTOM_LEATHER_PAD,
  PAGE_CONTENT_INSET,
  PAGE_CORNER_SIZE,
  PAGE_HORIZONTAL_INSET,
  PAGE_TOP_LEATHER_PAD,
} from './TomePageFrame';

interface Props {
  children: ReactNode;
}

export default function TomePageFrameDark({ children }: Props) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  // SAM1-94: see TomePageFrame for rationale — sister components stay in lockstep.
  const headerHeight = useContext(HeaderHeightContext) ?? 0;
  const topInset = headerHeight > 0 ? 0 : insets.top;
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
          paddingTop: topInset + PAGE_TOP_LEATHER_PAD,
          paddingBottom: insets.bottom + PAGE_BOTTOM_LEATHER_PAD,
        },
      ]}
    >
      <View
        style={[styles.page, { backgroundColor: colors.bg.darkParchment }]}
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
