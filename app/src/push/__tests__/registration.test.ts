import type { Credentials } from '@/api/tokenSession';

import { createPushRegistration, type RegistrationNotifications } from '../registration';

// Hunt 040: the server forgets the device of a session at logout. The same person signing in
// again on the same phone, without restarting the app, must register the token again.

function phone() {
  let credentials: Credentials | undefined = { token: 'session-1', personId: 'marco' };
  const posts: { session?: string; body: unknown }[] = [];
  const notifications: RegistrationNotifications = {
    setNotificationChannelAsync: () => undefined,
    getPermissionsAsync: async () => ({ granted: true }),
    requestPermissionsAsync: async () => ({ granted: true }),
    getDevicePushTokenAsync: async () => ({ data: 'tok-marco' }),
    addPushTokenListener: () => ({ remove: () => undefined }),
  };
  const auth = {
    current: async () => credentials,
    http: async (request: { body: unknown }) => {
      posts.push({ session: credentials?.token, body: request.body });
      return { status: 204 };
    },
  };
  const push = createPushRegistration({ notifications, auth, channelName: 'Promemoria' });
  return {
    push,
    posts,
    signIn: (token: string) => {
      credentials = { token, personId: 'marco' };
    },
  };
}

describe('push registration', () => {
  it('registers once per session', async () => {
    const { push, posts } = phone();
    await push.ensure();
    await push.ensure();
    expect(posts).toEqual([
      { session: 'session-1', body: { token: 'tok-marco', platform: 'ANDROID' } },
    ]);
  });

  it('registers again when the same person signs in with a new session', async () => {
    const { push, posts, signIn } = phone();
    await push.ensure();
    signIn('session-2');
    await push.ensure();
    expect(posts.map((p) => p.session)).toEqual(['session-1', 'session-2']);
  });
});

describe('push registration token timeout', () => {
  function setup(getToken: () => Promise<{ data: string }>) {
    const posts: string[] = [];
    let listener: ((t: { data: string }) => void) | undefined;
    const notifications: RegistrationNotifications = {
      setNotificationChannelAsync: () => undefined,
      getPermissionsAsync: async () => ({ granted: true }),
      requestPermissionsAsync: async () => ({ granted: true }),
      getDevicePushTokenAsync: getToken,
      addPushTokenListener: (l) => {
        listener = l;
        return { remove: () => undefined };
      },
    };
    const auth = {
      current: async () => ({ token: 's', personId: 'anna' }) as Credentials,
      http: async (request: { body: unknown }) => {
        posts.push((request.body as { token: string }).token);
        return { status: 204 };
      },
    };
    const push = createPushRegistration({
      notifications,
      auth,
      channelName: 'P',
      tokenTimeoutMs: 200,
    });
    return { push, posts, rotate: (t: string) => listener?.({ data: t }) };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('retries on the next ensure after a call that never resolves, ignoring its late token', async () => {
    let calls = 0;
    let late: (v: { data: string }) => void = () => undefined;
    const { push, posts } = setup(() => {
      calls += 1;
      if (calls === 1) return new Promise((r) => (late = r));
      return Promise.resolve({ data: 'tok' });
    });
    const first = push.ensure();
    const second = push.ensure();
    await jest.advanceTimersByTimeAsync(250);
    await Promise.all([first, second]);
    expect(posts).toEqual(['tok']);
    late({ data: 'tok-late' });
    await jest.advanceTimersByTimeAsync(10);
    expect(posts).toEqual(['tok']);
  });

  it('a rotated token waits for the hanging run to time out', async () => {
    const { push, posts, rotate } = setup(() => new Promise(() => undefined));
    void push.ensure();
    await jest.advanceTimersByTimeAsync(10);
    rotate('tok-rot');
    await jest.advanceTimersByTimeAsync(100);
    expect(posts).toEqual([]);
    await jest.advanceTimersByTimeAsync(150);
    expect(posts).toEqual(['tok-rot']);
  });

  it('leaves no timer after an on-time token or a rejection', async () => {
    const ok = setup(async () => ({ data: 'tok' }));
    await ok.push.ensure();
    expect(jest.getTimerCount()).toBe(0);
    const ko = setup(() => Promise.reject(new Error('x')));
    await ko.push.ensure();
    expect(jest.getTimerCount()).toBe(0);
  });
});
