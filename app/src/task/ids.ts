/** Random bytes from the platform; never `Math.random()`. */
function platformRandom(count: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(count));
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * A UUID version 7 (RFC 9562): 48 bits of milliseconds, then random bits. The clock and the
 * random source are injectable so that tests are exact.
 */
export function uuidv7(
  nowMs: number = Date.now(),
  random: (count: number) => Uint8Array = platformRandom,
): string {
  const bytes = new Uint8Array(16);
  let rest = Math.floor(nowMs);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = rest % 256;
    rest = Math.floor(rest / 256);
  }
  bytes.set(random(10), 6);
  bytes[6] = 0x70 | (bytes[6] & 0x0f);
  bytes[8] = 0x80 | (bytes[8] & 0x3f);
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
