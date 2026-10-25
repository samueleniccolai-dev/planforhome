import { parseFontScale } from '../theme';

describe('parseFontScale', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['1.5', 1.5],
    ['3', 2],
    ['0.2', 1],
    ['abc', 1],
    ['', 1],
    [undefined, 1],
    [['2'], 1],
  ])('%p gives %p', (value, expected) => {
    expect(parseFontScale(value)).toBe(expected);
  });
});
