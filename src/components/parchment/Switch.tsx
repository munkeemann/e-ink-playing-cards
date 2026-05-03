/**
 * parchment/Switch — RN Switch with the ARCANE parchment palette baked in.
 *
 *   trackColor:
 *     off → text.inkSoft (#3D2E1C dark ink rail)
 *     on  → accent.dark  (#8A7340 antique gold rail)
 *   thumbColor: bg.parchment (cream pip, constant in both states)
 *
 * Use anywhere a normal RN Switch would appear inside a parchment page.
 */
import { Switch as RNSwitch } from 'react-native';
import { useTheme } from '../../theme/colors';

interface Props {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function Switch({ value, onValueChange, disabled }: Props) {
  const colors = useTheme();
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.text.inkSoft, true: colors.accent.dark }}
      thumbColor={colors.bg.parchment}
    />
  );
}
