/**
 * AmpersandMark — D&D ampersand glyph.
 *
 * Rendered as SVG <Text> using the Cinzel display family so it sits
 * inside the same gold-leaf vocabulary as the page chrome rather than
 * pulling in another typeface. A thin sepia drop-shadow offset gives
 * it the same illuminated-letter feel as the landing-page corner
 * ornaments.
 */
import Svg, { Text as SvgText } from 'react-native-svg';
import { fonts } from '../../theme/fonts';

interface Props {
  size?: number;
  gold: string;
  sepia: string;
}

export default function AmpersandMark({ size = 60, gold, sepia }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60">
      <SvgText
        x="31"
        y="46"
        fontFamily={fonts.displayBold}
        fontSize="48"
        textAnchor="middle"
        fill={sepia}
        fillOpacity={0.35}
      >
        &amp;
      </SvgText>
      <SvgText
        x="30"
        y="45"
        fontFamily={fonts.displayBold}
        fontSize="48"
        textAnchor="middle"
        fill={gold}
      >
        &amp;
      </SvgText>
    </Svg>
  );
}
