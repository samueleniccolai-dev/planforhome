import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import {
  colors,
  darkColors,
  elevation,
  makeElevation,
  radius,
  size,
  space,
  type,
  type Palette,
} from './tokens';

export const lightTheme = { colors, type, space, radius, size, elevation };
export type Theme = Omit<typeof lightTheme, 'colors'> & { colors: Palette };
export const darkTheme: Theme = {
  ...lightTheme,
  colors: darkColors,
  elevation: makeElevation(darkColors),
};

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The static export is prerendered in light: the server snapshot keeps the hydration in light and
  // React then re-renders with the real scheme (it does not patch mismatched styles).
  const scheme = useSyncExternalStore(
    (notify) => Appearance.addChangeListener(notify).remove,
    () => Appearance.getColorScheme(),
    () => 'light',
  );
  return (
    <ThemeContext.Provider value={scheme === 'dark' ? darkTheme : lightTheme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Test multiplier for font sizes: 1 everywhere except in the gallery, which sets it from `?fs=`. */
export const FontScaleContext = createContext(1);

export function useFontScale(): number {
  return useContext(FontScaleContext);
}

/** The `?fs=` of a test page: a number from 1 to 2, else 1. */
export function parseFontScale(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? Math.min(2, Math.max(1, n)) : 1;
}
