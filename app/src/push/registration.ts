import type { Credentials } from '@/api/tokenSession';

/** The part of `expo-notifications` used here (the real module fits it). */
export type RegistrationNotifications = {
  setNotificationChannelAsync(id: string, channel: { name: string; importance: number }): unknown;
  getPermissionsAsync(): Promise<{ granted: boolean; canAskAgain?: boolean }>;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  getDevicePushTokenAsync(): Promise<{ data: string }>;
  addPushTokenListener(listener: (token: { data: string }) => void): { remove(): void };
};

type Auth = {
  current(): Promise<Credentials | undefined>;
  http(request: { method: 'POST'; path: string; body: unknown }): Promise<{ status: number }>;
};

type Options = { notifications: RegistrationNotifications; auth: Auth; channelName: string };

export const CHANNEL_ID = 'reminders';
const IMPORTANCE_HIGH = 4;

/** Registers the FCM token of this phone for the signed-in person (`POST /api/me/devices`). */
export function createPushRegistration({ notifications, auth, channelName }: Options) {
  let asked = false;
  let done: string | undefined;
  let subscription: { remove(): void } | undefined;
  let tail: Promise<unknown> = Promise.resolve();

  async function post(person: string, token: string) {
    if (done === `${person}:${token}`) return;
    const { status } = await auth.http({
      method: 'POST',
      path: '/api/me/devices',
      body: { token, platform: 'ANDROID' },
    });
    if (status >= 200 && status < 300) done = `${person}:${token}`;
  }

  async function run(rotated?: string) {
    try {
      const credentials = await auth.current();
      if (!credentials) return;
      subscription ??= notifications.addPushTokenListener((t) => void enqueue(t.data));
      await notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: channelName,
        importance: IMPORTANCE_HIGH,
      });
      let permission = await notifications.getPermissionsAsync();
      if (!permission.granted) {
        if (asked || permission.canAskAgain === false) return;
        asked = true;
        permission = await notifications.requestPermissionsAsync();
        if (!permission.granted) return;
      }
      const token = rotated ?? (await notifications.getDevicePushTokenAsync()).data;
      await post(credentials.personId, token);
    } catch {
      // Never shown to the person: the next call tries again.
    }
  }

  /** One registration at a time: the last one belongs to the last user. */
  function enqueue(rotated?: string): Promise<unknown> {
    return (tail = tail.then(() => run(rotated)));
  }

  return {
    ensure: () => enqueue(),
    dispose() {
      subscription?.remove();
      subscription = undefined;
    },
  };
}
