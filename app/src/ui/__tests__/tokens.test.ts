import { colors, radius, size, space, type } from '../tokens';

describe('tokens (DESIGN §3)', () => {
  it('colours', () => {
    expect(colors.bg).toBe('#F3F5F7');
    expect(colors.text).toBe('#14181D');
    expect(colors.accent).toBe('#1849A9');
    expect(colors.danger).toBe('#991B1B');
    expect(colors.person).toHaveLength(8);
  });
  it('typography', () => {
    expect([type.title.fontSize, type.title.lineHeight, type.title.fontWeight]).toEqual([
      24,
      30,
      '700',
    ]);
    expect([type.body.fontSize, type.body.lineHeight]).toEqual([18, 25]);
    expect([type.meta.fontSize, type.meta.lineHeight]).toEqual([16, 21]);
    expect([type.caption.fontSize, type.caption.lineHeight]).toEqual([14, 19]);
  });
  it('space, radius, size', () => {
    expect(Object.values(space)).toEqual([4, 8, 12, 16, 20, 24, 32]);
    expect(Object.values(radius)).toEqual([8, 12, 16]);
    expect([size.touch, size.touchPrimary, size.checkbox, size.avatar]).toEqual([48, 56, 28, 36]);
  });
});
