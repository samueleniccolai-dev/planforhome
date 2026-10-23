import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { ANNA, PEOPLE } from './giro-026-fake-sync-server';

// Round 038, T10 (docs/lab/giri/038-piano.md): the Android channel «reminders» is created with
// high importance (`AndroidImportance.HIGH`, 6 in expo-notifications 58.x), so reminders ring and
// show a banner. Node only, no page: a fake `expo-notifications` and a fake signed-in session are
// handed to `src/push/registration.ts`, loaded at run time with exactly the options that
// `src/push/push.native.ts` passes (no importance option: the module decides it). Demo data:
// Anna of the round 026 fake, her phone token `fake-fcm-token-anna-033` (round 033).

const ANNA_PHONE = 'fake-fcm-token-anna-033';

type Channel = { name?: string; importance?: number };
type CreatePushRegistration = (options: {
  notifications: FakeNotifications;
  auth: FakeAuth;
  channelName: string;
}) => { ensure(): Promise<unknown>; dispose(): void };

/** A fake `expo-notifications`: every call is logged by name, in order. */
class FakeNotifications {
  readonly calls: string[] = [];
  readonly channels: { id: string; channel: Channel }[] = [];

  async setNotificationChannelAsync(id: string, channel: Channel) {
    this.calls.push('setNotificationChannelAsync');
    this.channels.push({ id, channel: { ...channel } });
    return { id, ...channel };
  }
  async getPermissionsAsync() {
    this.calls.push('getPermissionsAsync');
    return { granted: true, canAskAgain: true, status: 'granted' };
  }
  async requestPermissionsAsync() {
    this.calls.push('requestPermissionsAsync');
    return { granted: true, canAskAgain: true, status: 'granted' };
  }
  async getDevicePushTokenAsync() {
    this.calls.push('getDevicePushTokenAsync');
    return { type: 'android', data: ANNA_PHONE };
  }
  addPushTokenListener(_listener: (token: { data: string }) => void) {
    this.calls.push('addPushTokenListener');
    return { remove: () => undefined };
  }
}

/** Anna is signed in on the phone; POST /api/me/devices answers 204. */
class FakeAuth {
  readonly posts: { path: string; body: unknown }[] = [];
  async current() {
    return { token: 'fake-bearer-anna-038', personId: PEOPLE[ANNA].personId };
  }
  async http(request: { method: 'POST'; path: string; body: unknown }) {
    this.posts.push({ path: request.path, body: request.body });
    return { status: 204 };
  }
}

/** The value of `AndroidImportance.HIGH` in the installed expo-notifications. */
function installedHigh(): number {
  const source = readFileSync(
    join(
      __dirname,
      '../../node_modules/expo-notifications/build/NotificationChannelManager.types.js',
    ),
    'utf8',
  );
  const match = /AndroidImportance\["HIGH"\]\s*=\s*(\d+)/.exec(source);
  expect(match, 'expo-notifications defines AndroidImportance.HIGH').not.toBeNull();
  return Number(match![1]);
}

function channelName(locale: 'it' | 'en'): string {
  const dictionary = JSON.parse(
    readFileSync(join(__dirname, '../../src/i18n', `${locale}.json`), 'utf8'),
  ) as { push?: { channel?: string } };
  return dictionary.push?.channel ?? 'push.channel';
}

async function loadRegistration(): Promise<CreatePushRegistration> {
  const mod = await import('../../src/push/registration').catch(() => undefined);
  expect(
    mod?.createPushRegistration,
    'src/push/registration.ts exports createPushRegistration (no react-native or expo import at load time)',
  ).toBeInstanceOf(Function);
  return mod!.createPushRegistration as unknown as CreatePushRegistration;
}

async function signedInAnna() {
  const createPushRegistration = await loadRegistration();
  const notifications = new FakeNotifications();
  const auth = new FakeAuth();
  const push = createPushRegistration({ notifications, auth, channelName: channelName('it') });
  await push.ensure();
  push.dispose();
  return { notifications, auth };
}

test.describe('giro 038 — the channel «reminders» rings (high importance)', () => {
  test('C1 Anna signed in: «reminders» is created with importance 6 (HIGH), name «Promemoria», before the permission is read; her phone is registered', async () => {
    const { notifications, auth } = await signedInAnna();

    const reminders = notifications.channels.filter((c) => c.id === 'reminders');
    expect(reminders.length).toBeGreaterThanOrEqual(1);
    for (const { channel } of reminders) {
      expect(channel.name).toBe('Promemoria');
      expect(typeof channel.importance).toBe('number');
      expect(channel.importance, 'importance HIGH (6), not LOW (4)').toBe(6);
    }
    expect(notifications.calls.indexOf('setNotificationChannelAsync')).toBeGreaterThanOrEqual(0);
    expect(notifications.calls.indexOf('setNotificationChannelAsync')).toBeLessThan(
      notifications.calls.indexOf('getPermissionsAsync'),
    );
    expect(auth.posts).toEqual([
      { path: '/api/me/devices', body: { token: ANNA_PHONE, platform: 'ANDROID' } },
    ]);
  });

  test('C2 the importance used is AndroidImportance.HIGH of the installed expo-notifications', async () => {
    const high = installedHigh();
    expect(high).toBe(6);
    const { notifications } = await signedInAnna();
    const used = notifications.channels.find((c) => c.id === 'reminders')?.channel.importance;
    expect(used, 'the channel uses AndroidImportance.HIGH').toBe(high);
  });
});
