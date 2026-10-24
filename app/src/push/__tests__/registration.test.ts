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
