/**
 * Typography tokens for E-Cards.
 *
 * Two type families loaded via @expo-google-fonts at app launch:
 *   - Cinzel (display)        — caps-style Roman serif, used for
 *                               headers/titles/section names/button
 *                               labels/tile labels/numeric displays.
 *   - EB Garamond (body)      — classical book serif, used for body
 *                               text, form labels, list-row labels,
 *                               TextInput content.
 *
 * Token names map directly to the @expo-google-fonts export names so
 * any consumer can grep both directions. The weight is encoded in the
 * font-family name; do NOT also set fontWeight in styles — the named
 * variant is the weight.
 */
export const fonts = {
  display: 'Cinzel_600SemiBold',
  displayBold: 'Cinzel_700Bold',
  displayRegular: 'Cinzel_400Regular',
  body: 'EBGaramond_400Regular',
  bodyItalic: 'EBGaramond_400Regular_Italic',
  bodyBold: 'EBGaramond_700Bold',
} as const;
