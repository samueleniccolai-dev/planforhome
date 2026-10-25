import { colors } from './tokens';

/** FNV-1a (32 bit) of the id, modulo 8: the tint of a person, with no field to store. */
export function personTint(personId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < personId.length; i++) {
    hash ^= personId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0) % colors.person.length;
}

function luminance(hex: string): number {
  const channel = (at: number) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or black initials, whichever has the higher contrast on the tint. */
export function onPersonTint(index: number): string {
  const tint = colors.person[index];
  return contrast(colors.onPersonLight, tint) >= contrast(colors.onPersonDark, tint)
    ? colors.onPersonLight
    : colors.onPersonDark;
}

/** The first letters of at most two words of a name. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0].toUpperCase());
  return letters.length ? letters.join('') : '?';
}
