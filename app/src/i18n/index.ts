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
export function translate(locale: Locale, key: string, params?: Record<string, string>): string {
  let node: string | Dictionary | undefined = dictionaries[locale];
  for (const part of key.split('.')) {
    node = typeof node === 'object' ? node[part] : undefined;
  }
  if (typeof node !== 'string') return key;
  return node.replace(/\{(\w+)\}/g, (whole, name: string) => params?.[name] ?? whole);
}

const serverLocale = (): Locale => 'en';

let accountLocale: Locale | undefined;
let generation = 0;
const listeners = new Set<() => void>();

/** The language of the signed-in account; `undefined` goes back to the device (sign-out). */
export function setAccountLocale(tag: string | undefined): void {
  const next = tag === undefined ? undefined : resolveLocale(tag);
  if (tag === undefined) generation += 1;
  if (next === accountLocale) return;
  accountLocale = next;
  listeners.forEach((listener) => listener());
}

/** How many sign-outs happened; it never goes back. */
export function localeGeneration(): number {
  return generation;
}

/** The language on screen: the account's when known, otherwise the device's. */
export function currentLocale(): Locale {
  return accountLocale ?? deviceLocale();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `currentLocale()` for components, re-rendering when the language changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, currentLocale, serverLocale);
}

export function t(
  key: string,
  locale: Locale = currentLocale(),
  params?: Record<string, string>,
): string {
  return translate(locale, key, params);
}

/**
 * For screens: `const t = useT()`. The prerendered web page is English; on the client the first
 * render already uses the device language, and React swaps it in after hydration.
 */
export function useT(): (key: string, params?: Record<string, string>) => string {
  const locale = useLocale();
  return (key, params) => translate(locale, key, params);
}
