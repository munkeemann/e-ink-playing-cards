/**
 * Shared UI palette for E-Cards. The app is locked to the ARCANE theme
 * (gold-on-walnut). Legacy stored values ('default', 'slate') are coerced
 * to 'arcane' by the loadSettings validator.
 *
 * Consumers read the active theme via useTheme() and wrap their
 * StyleSheet.create call in useMemo(() => StyleSheet.create({...}),
 * [colors]). ThemeProvider wraps the app in app/_layout.tsx; with a
 * single theme it's effectively a constant provider, but the hook
 * surface is preserved for future theming flexibility.
 *
 * MTG game-state colors (zones) live in src/mtg/zoneColors.ts; mana
 * letters (W/U/B/R/G) live inline in the in-game screen as game data.
 */
import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { loadSettings, saveSettings } from '../storage/deckStorage';

export type ThemeName = 'arcane';

export type Theme = {
  bg: { app: string; surface: string; elevated: string; parchment: string; parchmentDeep: string };
  text: { primary: string; secondary: string; muted: string; disabled: string; ink: string; inkSoft: string };
  accent: { primary: string; dark: string };
  border: string;
  divider: string;
  status: { warning: string; danger: string; success: string };
  overlay: {
    accent40: string;
    accent50: string;
    dark: string;
    darker: string;
    light: string;
  };
};

const ARCANE_THEME: Theme = {
  bg: { app: '#1A140E', surface: '#2B1F12', elevated: '#2B1F12', parchment: '#D9C9A8', parchmentDeep: '#B8A480' },
  text: { primary: '#E8DCC4', secondary: '#B8A989', muted: '#7A6E5A', disabled: '#5C523F', ink: '#1A140E', inkSoft: '#3D2E1C' },
  accent: { primary: '#C9A961', dark: '#8A7340' },
  border: '#C9A961',
  divider: '#3D2E1C',
  status: { warning: '#B8732E', danger: '#7A1E1E', success: '#5C7A3A' },
  overlay: {
    accent40: 'rgba(26,20,14,0.4)',
    accent50: 'rgba(26,20,14,0.5)',
    dark: 'rgba(26,20,14,0.6)',
    darker: 'rgba(15,11,7,0.92)',
    light: 'rgba(26,20,14,0.12)',
  },
};

export const THEMES: Record<ThemeName, Theme> = {
  arcane: ARCANE_THEME,
};

type ThemeCtx = {
  theme: Theme;
  themeName: ThemeName;
  setThemeName: (n: ThemeName) => Promise<void>;
};

const ThemeContext = createContext<ThemeCtx>({
  theme: ARCANE_THEME,
  themeName: 'arcane',
  setThemeName: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeName, setThemeNameState] = useState<ThemeName>('arcane');

  useEffect(() => {
    loadSettings().then(s => {
      if (s.theme && s.theme in THEMES) setThemeNameState(s.theme);
    });
  }, []);

  const setThemeName = async (n: ThemeName) => {
    const s = await loadSettings();
    await saveSettings({ ...s, theme: n });
    setThemeNameState(n);
  };

  const value = useMemo<ThemeCtx>(() => ({
    theme: THEMES[themeName],
    themeName,
    setThemeName,
  }), [themeName]);

  // createElement instead of JSX so this file stays .ts (no rename, no
  // import-path churn across the 15 consumer files).
  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeName(): ThemeName {
  return useContext(ThemeContext).themeName;
}

export function useSetThemeName(): (n: ThemeName) => Promise<void> {
  return useContext(ThemeContext).setThemeName;
}

/**
 * Backward-compatibility alias for code that still does
 * `import { colors } from '.../theme/colors'`. Now that the app is locked
 * to ARCANE, this is equivalent to useTheme() but accessible to
 * non-React-component code (helpers outside the component tree).
 */
export const colors = ARCANE_THEME;
