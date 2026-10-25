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

type Options = {
  notifications: RegistrationNotifications;
  auth: Auth;
  channelName: string;
  /** After this long a token call that never answers is abandoned (default 10 s). */
  tokenTimeoutMs?: number;
};

export const CHANNEL_ID = 'reminders';
// Same value as `AndroidImportance.HIGH` in expo-notifications 58.x (sound and heads-up banner).
// Not imported: this module must load in Node without expo.
const IMPORTANCE_HIGH = 6;

/** Registers the FCM token of this phone for the signed-in person (`POST /api/me/devices`). */
export function createPushRegistration({
  notifications,
  auth,
  channelName,
  tokenTimeoutMs = 10_000,
}: Options) {
  let asked = false;
  let done: string | undefined;
  let subscription: { remove(): void } | undefined;
  let tail: Promise<unknown> = Promise.resolve();

  // Once per session: the server forgets the device of a session at logout (hunt 040).
  async function post(credentials: Credentials, token: string) {
    const key = `${credentials.personId}:${credentials.token}:${token}`;
    if (done === key) return;
    const { status } = await auth.http({
      method: 'POST',
      path: '/api/me/devices',
      body: { token, platform: 'ANDROID' },
    });
    if (status >= 200 && status < 300) done = key;
  }

  /** The token, or undefined if the call does not answer in time (its late answer is ignored). */
  async function tokenInTime(): Promise<string | undefined> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), tokenTimeoutMs);
    });
    try {
      return await Promise.race([
        notifications.getDevicePushTokenAsync().then((t) => t.data),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
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
      const token = rotated ?? (await tokenInTime());
      if (!token) return;
      await post(credentials, token);
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
