/**
 * parchment/DropCap — illuminated first-letter for an intro paragraph.
 *
 * Renders the first character in Cinzel display caps at a size sized
 * to span roughly three lines of the body text, with the rest of the
 * paragraph flowing in EB Garamond beside it. The cap and body share
 * the same `View` row, so once body text wraps inside its column it
 * does NOT flow back under the cap — that "true wrap-around" is not
 * possible in React Native flexbox without per-line padding tricks.
 *
 * Sizing: pass `bodySize` (defaults to 14). The cap is auto-derived
 * from `bodySize × 3 × lineHeightFactor` so a 14pt body gets a ~50pt
 * cap. Override via `capSize` if you need a specific point size.
 *
 * Use only on Class A parchment screens, on intro paragraphs that
 * actually lead a section. Do not apply to short hints, single-line
 * status text, or list rows — drop caps work only when there are
 * several lines of body text to balance the cap visually.
 */
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Register, registerTokens, useTheme } from '../../theme/colors';
import { fonts } from '../../theme/fonts';

interface Props {
  children: string;
  bodySize?: number;
  capSize?: number;
  bodyStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  register?: Register;
}

const LINE_HEIGHT_FACTOR = 1.45;

export default function DropCap({
  children,
  bodySize = 14,
  capSize,
  bodyStyle,
  containerStyle,
  register = 'parchment',
}: Props) {
  const colors = useTheme();
  const r = registerTokens(colors, register);
  if (!children) return null;
  const cap = children.charAt(0);
  const body = children.slice(1);
  const lineHeight = Math.round(bodySize * LINE_HEIGHT_FACTOR);
  const resolvedCapSize = capSize ?? Math.round(bodySize * 3.4);
  return (
    <View style={[styles.row, containerStyle]}>
      <Text
        style={[
          styles.cap,
          {
            color: colors.accent.primary,
            fontSize: resolvedCapSize,
            lineHeight: resolvedCapSize,
            marginRight: Math.max(6, Math.round(bodySize * 0.5)),
          },
        ]}
      >
        {cap}
      </Text>
      <Text
        style={[
          styles.body,
          {
            color: r.ink,
            fontSize: bodySize,
            lineHeight,
          },
          bodyStyle,
        ]}
      >
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cap: {
    fontFamily: fonts.displayBold,
    // Negative top margin pulls the cap up so its baseline aligns
    // closer to the first body line's baseline rather than its top.
    marginTop: -2,
  },
  body: {
    flex: 1,
    fontFamily: fonts.body,
  },
});
