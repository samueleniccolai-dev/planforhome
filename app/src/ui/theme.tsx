import { createContext, useContext, type ReactNode } from 'react';

import { colors, elevation, radius, size, space, type } from './tokens';

export const lightTheme = { colors, type, space, radius, size, elevation };
export type Theme = typeof lightTheme;

const ThemeContext = createContext<Theme>(lightTheme);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={lightTheme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/** Test multiplier for font sizes: 1 everywhere except in the gallery, which sets it from `?fs=`. */
export const FontScaleContext = createContext(1);

export function useFontScale(): number {
  return useContext(FontScaleContext);
}
