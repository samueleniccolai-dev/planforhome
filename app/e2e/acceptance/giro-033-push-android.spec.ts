import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import {
  ANNA,
  DEMO_PASSWORD,
  FAKE_BASE_URL,
  FakeSyncServer,
  LUCA,
  PEOPLE,
  json,
  type FetchInit,
  type HttpRequest,
  type HttpResponse,
} from './giro-026-fake-sync-server';

// Round 033, T10 part 3 (docs/lab/giri/033-piano.md, «Contratti per i test»): the Android phone
// registers its FCM token and opens the task from a notification. Node only, no page: fake fetch,
// fake timers, fake AppState, fake vault and a fake `expo-notifications` (FakeNotifications),
// handed to the production modules. They are loaded at run time, so that this file compiles before
// they exist; `src/push/registration.ts` and `src/push/open.ts` must not import react-native or
// expo modules at load time (`src/push/push.native.ts` wires the real module, `push.ts` is the
// empty web side). Demo data: the fake of round 026, Anna and Luca on the same phone; the device
// tokens are the invented strings of the plan.

type Http = (request: HttpRequest) => Promise<HttpResponse>;
type Fetch = (input: string, init?: FetchInit) => Promise<Response>;
type Credentials = { token: string; personId: string };
type LoginOutcome = 'ok' | 'invalid' | 'tooMany' | 'error';
type Timers = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};
type TokenSession = {
  login(email: string, password: string): Promise<LoginOutcome>;
  current(): Promise<Credentials | undefined>;
  http: Http;
  logout(): Promise<void>;
};
type SyncSession = {
  start(): Promise<void>;
  stop(): void;
  signIn(email: string, password: string): Promise<LoginOutcome>;
  signOut(): Promise<void>;
};

/** The part of `expo-notifications` the registration uses. */
type PushToken = { type: string; data: string };
type Permission = { granted: boolean; canAskAgain?: boolean; status?: string };
type Subscription = { remove(): void };
/** The part of `expo-notifications` the opener uses. */
type NotificationResponse = {
  actionIdentifier: string;
  notification: {
    date: number;
    request: {
      identifier: string;
      content: { title: string | null; body: string | null; data: Record<string, unknown> };
      trigger: { type: string } | null;
    };
  };
};

type PushRegistration = { ensure(): Promise<unknown>; dispose(): void };
type CreatePushRegistration = (options: {
  notifications: FakeNotifications;
  auth: TokenSession;
  channelName: string;
}) => PushRegistration;
type NotificationOpener = { ready(): Promise<void>; dispose(): void };
type CreateNotificationOpener = (options: {
  notifications: FakeNotifications;
  navigate: (href: string) => void;
}) => NotificationOpener;

const TIMEOUT_MS = 15_000;
const MINUTE = 60_000;
const ANNA_PHONE = 'fake-fcm-token-anna-033';
const ANNA_PHONE_NEW = 'fake-fcm-token-anna-033-b';
const DEVICES = `${FAKE_BASE_URL}/api/me/devices`;
/** «Spesa per Anna» of the plan (any UUIDv7 of a task works: the screen decides what it is). */
const SPESA_ID = '0192a3b4-0000-7000-8000-000000003104';
const PANE_ID = '0192a3b4-0000-7000-8000-000000003101';

async function settle(rounds = 40): Promise<void> {
  for (let i = 0; i < rounds; i++) await new Promise((resolve) => setImmediate(resolve));
}

class FakeTimers implements Timers {
  private now = 0;
  private nextId = 1;
  private readonly tasks = new Map<number, { at: number; fn: () => void; every?: number }>();

  readonly setTimeout = (fn: () => void, ms = 0): unknown => {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + Math.max(0, ms), fn });
    return id;
  };
  readonly clearTimeout = (handle: unknown): void => void this.tasks.delete(handle as number);
  readonly setInterval = (fn: () => void, ms = 0): unknown => {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + ms, fn, every: ms });
    return id;
  };
  readonly clearInterval = (handle: unknown): void => void this.tasks.delete(handle as number);

  async advance(ms: number): Promise<void> {
    const end = this.now + ms;
    await settle();
    for (;;) {
      let next: [number, { at: number; fn: () => void; every?: number }] | undefined;
      for (const entry of this.tasks) {
        if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
      }
      if (!next) break;
      const [id, task] = next;
      this.now = task.at;
      if (task.every) task.at += task.every;
      else this.tasks.delete(id);
      task.fn();
      await settle();
    }
    this.now = end;
    await settle();
  }
}

class FakeAppState {
  currentState: string | null = 'active';
  addEventListener(_type: 'change', _listener: (state: string) => void) {
    return { remove: () => undefined };
  }
}

class FakeVault {
  value: Credentials | null = null;
  async get(): Promise<Credentials | null> {
    return this.value ? { ...this.value } : null;
  }
  async set(credentials: Credentials): Promise<void> {
    this.value = { ...credentials };
  }
  async clear(): Promise<void> {
    this.value = null;
  }
}

/** A fake `expo-notifications`: every call is logged by name, in order. */
class FakeNotifications {
  readonly calls: string[] = [];
  readonly channels: { id: string; channel: { name?: string } }[] = [];
  permission: Permission = { granted: true, canAskAgain: true, status: 'granted' };
  /** What `requestPermissionsAsync` answers (and then becomes the permission). */
  answer: Permission = { granted: true, canAskAgain: true, status: 'granted' };
  token = ANNA_PHONE;
  /** How many of the next `getDevicePushTokenAsync` calls reject. */
  tokenFailures = 0;
  last: NotificationResponse | null = null;
  cleared = 0;
  private readonly tokenListeners = new Set<(token: PushToken) => void>();
  private readonly responseListeners = new Set<(response: NotificationResponse) => void>();

  async setNotificationChannelAsync(id: string, channel: { name?: string }) {
    this.calls.push('setNotificationChannelAsync');
    this.channels.push({ id, channel });
    return { id, ...channel };
  }
  async getPermissionsAsync(): Promise<Permission> {
    this.calls.push('getPermissionsAsync');
    return { ...this.permission };
  }
  async requestPermissionsAsync(): Promise<Permission> {
    this.calls.push('requestPermissionsAsync');
    this.permission = { ...this.answer };
    return { ...this.answer };
  }
  async getDevicePushTokenAsync(): Promise<PushToken> {
    this.calls.push('getDevicePushTokenAsync');
    if (this.tokenFailures > 0) {
      this.tokenFailures--;
      throw new Error('FIS_AUTH_ERROR (fake)');
    }
    return { type: 'android', data: this.token };
  }
  addPushTokenListener(listener: (token: PushToken) => void): Subscription {
    this.calls.push('addPushTokenListener');
    this.tokenListeners.add(listener);
    return { remove: () => void this.tokenListeners.delete(listener) };
  }
  /** FCM rotates the token of the phone. */
  rotate(token: string): void {
    this.token = token;
    for (const listener of [...this.tokenListeners]) listener({ type: 'android', data: token });
  }

  getLastNotificationResponse(): NotificationResponse | null {
    this.calls.push('getLastNotificationResponse');
    return this.last;
  }
  async getLastNotificationResponseAsync(): Promise<NotificationResponse | null> {
    this.calls.push('getLastNotificationResponseAsync');
    return this.last;
  }
  async clearLastNotificationResponseAsync(): Promise<void> {
    this.calls.push('clearLastNotificationResponseAsync');
    this.cleared++;
    this.last = null;
  }
  addNotificationResponseReceivedListener(
    listener: (response: NotificationResponse) => void,
  ): Subscription {
    this.calls.push('addNotificationResponseReceivedListener');
    this.responseListeners.add(listener);
    return { remove: () => void this.responseListeners.delete(listener) };
  }
  /** The person taps a notification while the app is running. */
  tap(response: NotificationResponse): void {
    for (const listener of [...this.responseListeners]) listener(response);
  }
  get responseListenerCount(): number {
    return this.responseListeners.size;
  }
}

function response(identifier: string, data: Record<string, unknown>): NotificationResponse {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: {
      date: Date.UTC(2031, 0, 6, 8, 0, 0),
      request: {
        identifier,
        content: { title: 'planforhome', body: 'Hai un promemoria', data },
        trigger: { type: 'push' },
      },
    },
  };
}

/** One POST /api/me/devices as it reached the fake server. */
type DeviceCall = {
  authorization: string;
  user: string | undefined;
  body: unknown;
  status: number;
};

/**
 * The fake server of round 026 with POST /api/me/devices in front of it: the token of the body
 * passes to the person of the Bearer token when the request is applied (`owners`); 204.
 */
class DeviceServer {
  readonly calls: DeviceCall[] = [];
  readonly owners = new Map<string, string>();
  private holds: Promise<void>[] = [];

  constructor(readonly server: FakeSyncServer) {}

  /** The next POST /api/me/devices waits, before it is applied, until released. */
  hold(): () => void {
    let release!: () => void;
    this.holds.push(new Promise<void>((resolve) => (release = resolve)));
    return release;
  }

  readonly fetch: Fetch = async (input, init = {}) => {
    if (String(input) !== DEVICES) return this.server.fetch(input, init);
    if (this.server.down) throw new TypeError('Network request failed (fake)');
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => (headers[key.toLowerCase()] = value));
    const gate = this.holds.shift();
    if (gate) await gate;
    const authorization = headers.authorization ?? '';
    const token = /^Bearer (.+)$/.exec(authorization)?.[1];
    const user = token === undefined ? undefined : this.server.tokens.get(token);
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    const call: DeviceCall = { authorization, user, body, status: 0 };
    this.calls.push(call);
    if ((init.method ?? 'GET').toUpperCase() !== 'POST') {
      call.status = 405;
      return json(405, { error: 'method_not_allowed' });
    }
    if (!user) {
      call.status = 401;
      return json(401, { error: 'unauthorized' });
    }
    const fcm = (body as { token?: unknown } | undefined)?.token;
    if (typeof fcm !== 'string' || !fcm) {
      call.status = 400;
      return json(400, { error: 'invalid_request' });
    }
    this.owners.set(fcm, user);
    call.status = 204;
    return json(204, null);
  };

  accepted(): DeviceCall[] {
    return this.calls.filter((c) => c.status === 204);
  }
}

async function importOrUndefined(path: string) {
  return import(path).catch(() => undefined);
}

async function loadRegistration(): Promise<CreatePushRegistration> {
  const mod = await importOrUndefined('../../src/push/registration');
  expect(
    mod?.createPushRegistration,
    'src/push/registration.ts exports createPushRegistration (no react-native or expo import at load time)',
  ).toBeInstanceOf(Function);
  return mod.createPushRegistration as CreatePushRegistration;
}

async function loadOpener(): Promise<CreateNotificationOpener> {
  const mod = await importOrUndefined('../../src/push/open');
  expect(
    mod?.createNotificationOpener,
    'src/push/open.ts exports createNotificationOpener (no react-native or expo import at load time)',
  ).toBeInstanceOf(Function);
  return mod.createNotificationOpener as CreateNotificationOpener;
}

function channelName(locale: 'it' | 'en'): string {
  const dictionary = JSON.parse(
    readFileSync(join(__dirname, '../../src/i18n', `${locale}.json`), 'utf8'),
  ) as { push?: { channel?: string } };
  return dictionary.push?.channel ?? 'push.channel';
}

/** Token session, engine and sync session wired as the Android runtime does, plus the push. */
async function setup() {
  const createPushRegistration = await loadRegistration();
  const tokenSession = await importOrUndefined('../../src/api/tokenSession');
  const engineMod = await importOrUndefined('../../src/sync/engine');
  const sessionMod = await importOrUndefined('../../src/sync/session');
  const memory = await importOrUndefined('../../src/sync/memoryStore');
  const server = new FakeSyncServer();
  const devices = new DeviceServer(server);
  const timers = new FakeTimers();
  const vault = new FakeVault();
  const notifications = new FakeNotifications();
  const auth: TokenSession = tokenSession.createTokenSession({
    vault,
    fetch: devices.fetch,
    baseUrl: FAKE_BASE_URL,
    timers,
    timeoutMs: TIMEOUT_MS,
  });
  const engine = engineMod.createSyncEngine({ store: memory.createMemoryStore(), http: auth.http });
  const push = createPushRegistration({ notifications, auth, channelName: channelName('it') });
  const session: SyncSession = sessionMod.createSyncSession({
    engine,
    auth,
    timers,
    appState: new FakeAppState(),
    onUnauthorized: () => undefined,
    push,
  });
  return { server, devices, timers, vault, notifications, auth, session, push };
}

function remembered(server: FakeSyncServer, vault: FakeVault, user: string) {
  vault.value = { token: server.issueToken(user), personId: PEOPLE[user].personId };
}

const bearerOf = (server: FakeSyncServer, user: string) =>
  [...server.tokens].filter(([, owner]) => owner === user).map(([token]) => `Bearer ${token}`);

test.describe('giro 033 — the phone registers its FCM token (R)', () => {
  test('R1 Anna signs in, permission granted: one POST /api/me/devices {token, platform ANDROID} with her Bearer, not repeated by later cycles', async () => {
    const { server, devices, timers, notifications, session } = await setup();
    expect(await session.signIn(ANNA, DEMO_PASSWORD)).toBe('ok');
    await timers.advance(3 * MINUTE);

    expect(devices.accepted()).toHaveLength(1);
    const [call] = devices.accepted();
    expect(call.body).toEqual({ token: ANNA_PHONE, platform: 'ANDROID' });
    expect(bearerOf(server, ANNA)).toContain(call.authorization);
    expect(devices.owners.get(ANNA_PHONE)).toBe(ANNA);
    // The channel «reminders» exists before the permission is read or asked (Android 13+).
    expect(notifications.channels.map((c) => c.id)).toContain('reminders');
    expect(notifications.calls.indexOf('setNotificationChannelAsync')).toBeLessThan(
      notifications.calls.indexOf('getPermissionsAsync'),
    );
    expect(notifications.calls.indexOf('getPermissionsAsync')).toBeGreaterThanOrEqual(0);
  });

  test('R2 the channel «reminders» has the translated name (it «Promemoria», en «Reminders»)', async () => {
    expect(channelName('it')).toBe('Promemoria');
    expect(channelName('en')).toBe('Reminders');
    const { session, timers, notifications } = await setup();
    await session.signIn(ANNA, DEMO_PASSWORD);
    await timers.advance(MINUTE);
    const reminders = notifications.channels.find((c) => c.id === 'reminders');
    expect(reminders?.channel.name).toBe('Promemoria');
  });

  test('R3 a session already saved (app restarted, no login): start() registers the phone with the saved Bearer', async () => {
    const { server, devices, timers, vault, session } = await setup();
    remembered(server, vault, ANNA);
    await session.start();
    await timers.advance(MINUTE);

    expect(devices.accepted()).toHaveLength(1);
    expect(devices.accepted()[0].authorization).toBe(`Bearer ${vault.value!.token}`);
    expect(devices.owners.get(ANNA_PHONE)).toBe(ANNA);
  });

  test('R4 permission denied: asked once, no token read, no POST, no error to the person', async () => {
    const { devices, timers, notifications, session } = await setup();
    notifications.permission = { granted: false, canAskAgain: true, status: 'undetermined' };
    notifications.answer = { granted: false, canAskAgain: false, status: 'denied' };

    expect(await session.signIn(ANNA, DEMO_PASSWORD)).toBe('ok');
    await timers.advance(5 * MINUTE);

    expect(notifications.calls.filter((c) => c === 'requestPermissionsAsync')).toHaveLength(1);
    expect(notifications.calls).not.toContain('getDevicePushTokenAsync');
    expect(devices.calls).toHaveLength(0);
  });

  test('R5 getDevicePushTokenAsync throws: signIn still ok, nothing sent; the next cycle registers', async () => {
    const { devices, timers, notifications, session } = await setup();
    notifications.tokenFailures = 1;

    expect(await session.signIn(ANNA, DEMO_PASSWORD)).toBe('ok');
    await settle();
    expect(devices.calls).toHaveLength(0);

    await timers.advance(MINUTE + 1_000);
    expect(devices.accepted()).toHaveLength(1);
    expect(devices.accepted()[0].body).toEqual({ token: ANNA_PHONE, platform: 'ANDROID' });
  });

  test('R6 offline at start with a saved session: nothing registered; when the network is back, the next cycle registers once', async () => {
    const { server, devices, timers, vault, session } = await setup();
    remembered(server, vault, ANNA);
    server.down = true;
    await session.start();
    await timers.advance(2 * MINUTE);
    expect(devices.accepted()).toHaveLength(0);

    server.down = false;
    await timers.advance(MINUTE + 1_000);
    expect(devices.accepted()).toHaveLength(1);
    await timers.advance(3 * MINUTE);
    expect(devices.accepted()).toHaveLength(1);
  });

  test('R7 FCM rotates the token: the new token is registered once', async () => {
    const { devices, timers, notifications, session } = await setup();
    await session.signIn(ANNA, DEMO_PASSWORD);
    await timers.advance(MINUTE);
    expect(devices.accepted()).toHaveLength(1);

    notifications.rotate(ANNA_PHONE_NEW);
    await timers.advance(MINUTE);
    const bodies = devices.accepted().map((c) => c.body);
    expect(bodies).toEqual([
      { token: ANNA_PHONE, platform: 'ANDROID' },
      { token: ANNA_PHONE_NEW, platform: 'ANDROID' },
    ]);
    expect(devices.owners.get(ANNA_PHONE_NEW)).toBe(ANNA);
  });

  test('R8 Anna and Luca on the same phone: Luca signs in while Anna’s registration is in flight; the token ends with Luca', async () => {
    const { server, devices, timers, session } = await setup();
    const release = devices.hold();
    expect(await session.signIn(ANNA, DEMO_PASSWORD)).toBe('ok');
    await settle();

    expect(await session.signIn(LUCA, DEMO_PASSWORD)).toBe('ok');
    await settle();
    release();
    await timers.advance(2 * MINUTE);

    expect(devices.owners.get(ANNA_PHONE)).toBe(LUCA);
    const last = devices.accepted().at(-1);
    expect(last && bearerOf(server, LUCA)).toContain(last?.authorization);
    expect(devices.accepted().filter((c) => c.user === LUCA)).toHaveLength(1);
  });

  test('R9 the push module of the web side does nothing (src/push/push.ts)', async () => {
    const web = await importOrUndefined('../../src/push/push');
    expect(web, 'src/push/push.ts exists (web side, empty)').toBeDefined();
    expect(web?.createPush?.() ?? web?.push ?? undefined).toBeUndefined();
  });
});

test.describe('giro 033 — the tap on a notification opens the task (O)', () => {
  test('O1 app closed: the last response waits for ready(), then one navigation to /tasks?task=<id> and the response is cleared', async () => {
    const createNotificationOpener = await loadOpener();
    const notifications = new FakeNotifications();
    notifications.last = response('n-1', { taskId: SPESA_ID });
    const hrefs: string[] = [];
    const opener = createNotificationOpener({ notifications, navigate: (h) => hrefs.push(h) });
    await settle();
    expect(hrefs).toEqual([]);

    await opener.ready();
    await settle();
    expect(hrefs).toEqual([`/tasks?task=${SPESA_ID}`]);
    expect(notifications.cleared).toBeGreaterThanOrEqual(1);
    opener.dispose();
  });

  test('O2 the same response from the listener and as last response: one navigation', async () => {
    const createNotificationOpener = await loadOpener();
    const notifications = new FakeNotifications();
    const tapped = response('n-2', { taskId: SPESA_ID });
    notifications.last = tapped;
    const hrefs: string[] = [];
    const opener = createNotificationOpener({ notifications, navigate: (h) => hrefs.push(h) });
    notifications.tap(tapped);
    await opener.ready();
    await settle();
    notifications.tap(tapped);
    await settle();
    expect(hrefs).toEqual([`/tasks?task=${SPESA_ID}`]);
    opener.dispose();
  });

  test('O3 app running: each new tap navigates at once; dispose() removes the listener', async () => {
    const createNotificationOpener = await loadOpener();
    const notifications = new FakeNotifications();
    const hrefs: string[] = [];
    const opener = createNotificationOpener({ notifications, navigate: (h) => hrefs.push(h) });
    await opener.ready();
    notifications.tap(response('n-3', { taskId: SPESA_ID }));
    await settle();
    notifications.tap(response('n-4', { taskId: PANE_ID }));
    await settle();
    expect(hrefs).toEqual([`/tasks?task=${SPESA_ID}`, `/tasks?task=${PANE_ID}`]);

    opener.dispose();
    expect(notifications.responseListenerCount).toBe(0);
  });

  test('O4 taskId missing, not a string or not a UUID: no navigation', async () => {
    const createNotificationOpener = await loadOpener();
    const notifications = new FakeNotifications();
    notifications.last = response('n-5', {});
    const hrefs: string[] = [];
    const opener = createNotificationOpener({ notifications, navigate: (h) => hrefs.push(h) });
    await opener.ready();
    notifications.tap(response('n-6', { taskId: 'not-a-uuid' }));
    notifications.tap(response('n-7', { taskId: 42 }));
    notifications.tap(response('n-8', { taskId: `${SPESA_ID}&family=x` }));
    await settle();
    expect(hrefs).toEqual([]);
    opener.dispose();
  });
});

test.describe('giro 033 — the build of the APK (A)', () => {
  const root = join(__dirname, '../..');
  const read = (file: string) => readFileSync(join(root, file), 'utf8');

  test('A1 app.json: expo-notifications plugin and android.googleServicesFile; the file is git-ignored; the dependency is the Expo 58 line', async () => {
    const app = JSON.parse(read('app.json')) as {
      expo: { plugins?: (string | [string, unknown])[]; android?: { googleServicesFile?: string } };
    };
    const plugins = (app.expo.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
    expect(plugins).toContain('expo-notifications');
    expect(app.expo.android?.googleServicesFile).toBe('./google-services.json');
    expect(
      read('../.gitignore')
        .split('\n')
        .map((l) => l.trim()),
    ).toContain('google-services.json');
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['expo-notifications']).toMatch(/^~58\./);
  });
});
