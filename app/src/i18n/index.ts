import { useSyncExternalStore } from 'react';

import en from './en.json';
import it from './it.json';

export type Locale = 'it' | 'en';

type Dictionary = { [key: string]: string | Dictionary };

const dictionaries: Record<Locale, Dictionary> = { it, en };

/** Italian for any `it*` tag, English for everything else. */
export function resolveLocale(tag: string | undefined): Locale {
  return tag?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

/** The device language, from Intl (no expo-localization). */
export function deviceLocale(): Locale {
  try {
    return resolveLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'en';
  }
}

/** Looks a dotted key up in the dictionary of a language; a missing key comes back as itself. */
export function translate(locale: Locale, key: string): string {
  let node: string | Dictionary | undefined = dictionaries[locale];
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  return typeof node === 'string' ? node : key;
}

export function t(key: string, locale: Locale = deviceLocale()): string {
  return translate(locale, key);
}

const noSubscription = () => () => {};
const serverLocale = (): Locale => 'en';

/**
 * For screens: `const t = useT()`. The prerendered web page is English; on the client the first
 * render already uses the device language, and React swaps it in after hydration.
 */
export function useT(): (key: string) => string {
  const locale = useSyncExternalStore(noSubscription, deviceLocale, serverLocale);
  return (key) => translate(locale, key);
}
