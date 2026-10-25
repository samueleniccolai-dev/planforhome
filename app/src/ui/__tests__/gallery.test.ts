import { isGalleryEnabled } from '../gallery';

describe('isGalleryEnabled', () => {
  it('is off in production on a public host', () => {
    expect(isGalleryEnabled({ dev: false, os: 'web', host: 'app.planforhome.com' })).toBe(false);
  });
  it('is off on Android without __DEV__', () => {
    expect(isGalleryEnabled({ dev: false, os: 'android' })).toBe(false);
  });
  it('is on for localhost and 127.0.0.1', () => {
    expect(isGalleryEnabled({ dev: false, os: 'web', host: 'localhost' })).toBe(true);
    expect(isGalleryEnabled({ dev: false, os: 'web', host: '127.0.0.1' })).toBe(true);
  });
  it('is off on another loopback address', () => {
    expect(isGalleryEnabled({ dev: false, os: 'web', host: '127.0.0.2' })).toBe(false);
  });
  it('is on in development', () => {
    expect(isGalleryEnabled({ dev: true, os: 'android' })).toBe(true);
  });
});
