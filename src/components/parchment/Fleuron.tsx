/**
 * parchment/Fleuron — horizontal section divider with a centered
 * floral-trefoil ornament in gold, flanked by thin sepia rules.
 *
 * Use at meaningful section breaks on parchment (Class A) screens —
 * not as a default rule. The trefoil reads as a deliberate beat,
 * which gets diluted if the divider is repeated across every gap.
 *
 * Geometry is keyed off `width`. The ornament sits in a fixed-width
 * (~28px) gap at center; rules fill the remaining space on each side
 * with a 4px outer margin so it doesn't bleed into adjacent borders.
 */
import { View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../theme/colors';

interface Props {
  width?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Fleuron({ width = 220, style }: Props) {
  const colors = useTheme();
  const gold = colors.accent.primary;
  const sepia = colors.divider;
  const cx = width / 2;
  const cy = 7;
  const halfGap = 14;
  const leftEnd = cx - halfGap;
  const rightStart = cx + halfGap;
  return (
    <View style={[{ width, height: 14, alignItems: 'center' }, style]}>
      <Svg width={width} height={14} viewBox={`0 0 ${width} 14`}>
        {/* left rule */}
        <Path d={`M 4 ${cy} L ${leftEnd} ${cy}`} stroke={sepia} strokeWidth="0.6" />
        {/* right rule */}
        <Path d={`M ${rightStart} ${cy} L ${width - 4} ${cy}`} stroke={sepia} strokeWidth="0.6" />
        {/* ornament: side flourishes + central diamond + dots */}
        <Path
          d={`M ${cx - 11} ${cy} Q ${cx - 8} ${cy - 3}, ${cx - 5} ${cy} Q ${cx - 8} ${cy + 3}, ${cx - 11} ${cy}`}
          stroke={gold}
          strokeWidth="0.8"
          fill="none"
        />
        <Path
          d={`M ${cx + 11} ${cy} Q ${cx + 8} ${cy - 3}, ${cx + 5} ${cy} Q ${cx + 8} ${cy + 3}, ${cx + 11} ${cy}`}
          stroke={gold}
          strokeWidth="0.8"
          fill="none"
        />
        <Path
          d={`M ${cx} ${cy - 4} L ${cx + 3} ${cy} L ${cx} ${cy + 4} L ${cx - 3} ${cy} Z`}
          stroke={gold}
          strokeWidth="0.9"
          fill={gold}
          fillOpacity="0.35"
        />
        <Circle cx={cx - 5} cy={cy} r="0.7" fill={gold} />
        <Circle cx={cx + 5} cy={cy} r="0.7" fill={gold} />
      </Svg>
    </View>
  );
}
