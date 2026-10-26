import { colors, darkColors } from '../tokens';
import { contrast, initials, onPersonTint, personTint } from '../personTint';

describe('personTint', () => {
  it('is stable and inside the eight tints', () => {
    const id = '0192a3b4-0000-7000-8000-0000000000a1';
    expect(personTint(id)).toBe(personTint(id));
    for (const x of ['a', 'b', id, '', 'zzzzzz']) {
      const i = personTint(x);
      expect(Number.isInteger(i) && i >= 0 && i < 8).toBe(true);
    }
  });

  it('is FNV-1a modulo 8', () => {
    // FNV-1a 32 bit of "a" is 0xE40C292C: low three bits are 100.
    expect(personTint('a')).toBe(4);
    expect(personTint('')).toBe(5); // offset basis 0x811C9DC5
  });

  it('spreads different ids over several tints', () => {
    const tints = new Set(
      Array.from({ length: 40 }, (_, k) => personTint(`0192a3b4-0000-7000-8000-${k}`)),
    );
    expect(tints.size).toBeGreaterThan(3);
  });
});

describe('onPersonTint', () => {
  it('gives at least 4.5:1 on each of the eight tints', () => {
    for (let i = 0; i < 8; i++) {
      expect(contrast(onPersonTint(i), colors.person[i])).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('initials', () => {
  it('takes the first letters of at most two words', () => {
    expect(initials('Marco')).toBe('M');
    expect(initials('anna maria rossi')).toBe('AM');
    expect(initials('  Leo  ')).toBe('L');
    expect(initials('')).toBe('?');
  });
});

describe('onPersonTint in the dark theme', () => {
  it('gives at least 4.5:1 on each tint, and person[7] is white', () => {
    expect(darkColors.person[7]).toBe('#FFFFFF');
    for (let i = 0; i < 8; i++) {
      expect(contrast(onPersonTint(i, darkColors), darkColors.person[i])).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});
