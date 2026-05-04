/**
 * parchment/Switch — RN Switch with the ARCANE parchment palette baked in.
 *
 *   register='parchment' (default)
 *     trackColor: off → text.inkSoft (#3D2E1C dark ink rail)
 *                 on  → accent.dark  (#8A7340 antique gold rail)
 *     thumbColor: bg.parchment (cream pip)
 *
 *   register='dark'
 *     trackColor: off → text.disabled (#5C523F faint brown rail)
 *                 on  → accent.dark   (same antique gold rail)
 *     thumbColor: bg.parchment (same cream pip — pops on dark ground)
 */
import { Switch as RNSwitch } from 'react-native';
import { Register, registerTokens, useTheme } from '../../theme/colors';

interface Props {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  register?: Register;
}

export default function Switch({ value, onValueChange, disabled, register = 'parchment' }: Props) {
  const colors = useTheme();
  const r = registerTokens(colors, register);
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: r.hairline, true: colors.accent.dark }}
      thumbColor={colors.bg.parchment}
    />
  );
}
