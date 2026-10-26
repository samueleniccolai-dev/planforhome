import { contrast, onPersonTint } from '../personTint';
import { colors, darkColors, elevation, makeElevation } from '../tokens';

const pairs = (c: typeof colors): [string, string, string][] => [
  ['text', c.text, c.bg],
  ['text', c.text, c.surface],
  ['textSecondary', c.textSecondary, c.bg],
  ['textSecondary', c.textSecondary, c.surface],
  ['textSecondary', c.textSecondary, c.tagBg],
  ['onAccent', c.onAccent, c.accent],
  ['accent', c.accent, c.surface],
  ['onAccentTonal', c.onAccentTonal, c.accentTonal],
  ['danger', c.danger, c.surface],
  ['danger', c.danger, c.dangerSoft],
  ['warning', c.warning, c.surface],
  ['success', c.success, c.surface],
  ['onNotice', c.onNotice, c.notice],
];

describe('token contrast (WCAG 2.x)', () => {
  it('dark: same keys as the light theme', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(colors).sort());
    expect(darkColors.person).toHaveLength(colors.person.length);
  });

  it('dark: body text at least 7:1', () => {
    for (const bg of [darkColors.bg, darkColors.surface]) {
      expect(contrast(darkColors.text, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(darkColors.textSecondary, bg)).toBeGreaterThanOrEqual(7);
    }
    expect(contrast(darkColors.textSecondary, darkColors.tagBg)).toBeGreaterThanOrEqual(7);
  });

  it('dark: every text pair at least 4.5:1', () => {
    for (const [name, fg, bg] of pairs(darkColors)) {
      expect([name, contrast(fg, bg) >= 4.5]).toEqual([name, true]);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('dark: borderStrong and person tints at least 3:1 on surface', () => {
    expect(contrast(darkColors.borderStrong, darkColors.surface)).toBeGreaterThanOrEqual(3);
    for (const tint of darkColors.person) {
      expect(contrast(tint, darkColors.surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it('light: the DESIGN 3.1 pairs and the chosen initials on each tint', () => {
    for (const [name, fg, bg] of pairs(colors)) {
      expect([name, contrast(fg, bg) >= 4.5]).toEqual([name, true]);
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(colors.borderStrong, colors.surface)).toBeGreaterThanOrEqual(3);
    colors.person.forEach((tint, i) => {
      expect(contrast(onPersonTint(i), tint)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('elevation follows the theme', () => {
    expect(elevation.borderColor).toBe(colors.border);
    expect(makeElevation(darkColors).borderColor).toBe('#3A434E');
  });
});
