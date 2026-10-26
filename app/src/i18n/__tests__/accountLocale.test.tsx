import { act, useEffect } from 'react';
import { createRoot } from 'test-renderer';

import { me } from '@/api/client';
import { currentLocale, deviceLocale, localeGeneration, setAccountLocale, t, useT } from '../index';

afterEach(() => setAccountLocale(undefined));

const shown: string[] = [];
function Probe() {
  const tr = useT();
  const text = tr('me.signOut');
  useEffect(() => {
    shown.push(text);
  });
  return <>{text}</>;
}

describe('account language', () => {
  it('wins over the device and undefined goes back', () => {
    const device = deviceLocale();
    const other = device === 'it' ? 'en' : 'it';
    setAccountLocale(other);
    expect(currentLocale()).toBe(other);
    setAccountLocale(undefined);
    expect(currentLocale()).toBe(device);
  });

  it('t() without a language uses the account one', () => {
    setAccountLocale('it');
    expect(t('me.signOut')).toBe('Esci');
    setAccountLocale('en');
    expect(t('me.signOut')).toBe('Sign out');
  });

  it('useT updates without remounting', async () => {
    const root = createRoot();
    setAccountLocale('en');
    await act(async () => {
      root.render(<Probe />);
    });
    await act(async () => {
      setAccountLocale('it');
    });
    expect(shown[shown.length - 1]).toBe('Esci');
  });

  it('the server snapshot stays English', () => {
    setAccountLocale('it');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { renderToString } = require('react-dom/server') as {
      renderToString: (element: React.ReactElement) => string;
    };
    expect(renderToString(<Probe />)).toContain('Sign out');
  });

  it('drops an old answer and the counter never goes back', async () => {
    let release: (r: Response) => void = () => {};
    global.fetch = jest.fn(
      () => new Promise<Response>((resolve) => (release = resolve)),
    ) as unknown as typeof fetch;
    const before = localeGeneration();
    const pending = me();
    setAccountLocale(undefined);
    expect(localeGeneration()).toBe(before + 1);
    release(new Response(JSON.stringify({ displayName: 'G', personId: 'p', locale: 'it' })));
    await pending;
    expect(currentLocale()).toBe(deviceLocale());
    setAccountLocale(undefined);
    expect(localeGeneration()).toBe(before + 2);
  });
});
