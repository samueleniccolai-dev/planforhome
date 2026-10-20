import { uuidv7 } from '../ids';

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fill = (byte: number) => (n: number) => new Uint8Array(n).fill(byte);

describe('uuidv7', () => {
  it('has version 7 and the RFC variant, whatever the random bytes', () => {
    expect(uuidv7(1_700_000_000_000, fill(0x00))).toMatch(V7);
    expect(uuidv7(1_700_000_000_000, fill(0xff))).toMatch(V7);
  });

  it('puts the 48 bit milliseconds first', () => {
    expect(uuidv7(0x0192a3b4c5d6, fill(0)).startsWith('0192a3b4-c5d6-7')).toBe(true);
  });

  it('grows with the clock', () => {
    const a = uuidv7(1_700_000_000_000, fill(0xff));
    const b = uuidv7(1_700_000_000_001, fill(0x00));
    expect(a < b).toBe(true);
  });

  it('takes its randomness from the injected generator and never from Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    const asked: number[] = [];
    uuidv7(1, (n) => {
      asked.push(n);
      return new Uint8Array(n);
    });
    expect(asked.length).toBe(1);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('works with the default clock and generator', () => {
    expect(uuidv7()).toMatch(V7);
    expect(uuidv7()).not.toBe(uuidv7());
  });
});
