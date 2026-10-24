import { expect, test } from '@playwright/test';

import { ANNA, PEOPLE } from './giro-026-fake-sync-server';

// Round 042, T11 (docs/lab/giri/042-piano.md, defect 2 of hunt 040): if
// `getDevicePushTokenAsync()` never settles, the registration queue must not stay stuck. With the
// option `tokenTimeoutMs` the call is given up after that time, the queue goes on and the next
// `ensure()` (or the token rotated by the listener) registers the phone. A token that arrives after
// the timeout is ignored: no late POST. Node only, no page (as round 038): a fake
// `expo-notifications` and a fake signed-in session are handed to `src/push/registration.ts`,
// loaded at run time. Demo data: Anna of the round 026 fake, her phone token
// `fake-fcm-token-anna-042`.

const ANNA_PHONE = 'fake-fcm-token-anna-042';
const LATE_PHONE = 'fake-fcm-token-anna-042-late';
const TOKEN_TIMEOUT_MS = 200;
const WITHIN_MS = 3_000;

type Token = { type?: string; data: string };
type Listener = (token: { data: string }) => void;
type CreatePushRegistration = (options: {
  notifications: FakeNotifications;
  auth: FakeAuth;
  channelName: string;
  tokenTimeoutMs: number;
}) => { ensure(): Promise<unknown>; dispose(): void };

/** What each call of `getDevicePushTokenAsync` does, in order; the last one repeats. */
type Step = 'hang' | 'reject' | 'token';

/** A fake `expo-notifications` whose token calls follow the given steps. */
class FakeNotifications {
  readonly listeners: Listener[] = [];
  tokenCalls = 0;
  private readonly hung: ((token: Token) => void)[] = [];

  constructor(private readonly steps: Step[]) {}

  async setNotificationChannelAsync(id: string, channel: { name: string; importance: number }) {
    return { id, ...channel };
  }
  async getPermissionsAsync() {
    return { granted: true, canAskAgain: true, status: 'granted' };
  }
  async requestPermissionsAsync() {
    return { granted: true, canAskAgain: true, status: 'granted' };
  }
  getDevicePushTokenAsync(): Promise<Token> {
    const step = this.steps[Math.min(this.tokenCalls, this.steps.length - 1)];
    this.tokenCalls += 1;
    if (step === 'hang') {
      return new Promise<Token>((resolve) => this.hung.push(resolve));
    }
    if (step === 'reject') {
      return Promise.reject(new Error('giro 042: no token this time'));
    }
    return Promise.resolve({ type: 'android', data: ANNA_PHONE });
  }
  addPushTokenListener(listener: Listener) {
    this.listeners.push(listener);
    return {
      remove: () => {
        const at = this.listeners.indexOf(listener);
        if (at >= 0) this.listeners.splice(at, 1);
      },
    };
  }
  /** The token rotated by the system, as `expo-notifications` hands it to the listeners. */
  rotate(data: string) {
    for (const listener of [...this.listeners]) listener({ data });
  }
  /** Settles the calls still hanging, late, with another token. */
  settleLate(data: string) {
    for (const resolve of this.hung.splice(0)) resolve({ type: 'android', data });
  }
}

/** Anna is signed in on the phone; POST /api/me/devices answers 204. */
class FakeAuth {
  readonly posts: { path: string; body: unknown; at: number }[] = [];
  async current() {
    return { token: 'fake-bearer-anna-042', personId: PEOPLE[ANNA].personId };
  }
  async http(request: { method: 'POST'; path: string; body: unknown }) {
    this.posts.push({ path: request.path, body: request.body, at: Date.now() });
    return { status: 204 };
  }
}

async function loadRegistration(): Promise<CreatePushRegistration> {
  const mod = await import('../../src/push/registration').catch(() => undefined);
  expect(
    mod?.createPushRegistration,
    'src/push/registration.ts exports createPushRegistration (no react-native or expo import at load time)',
  ).toBeInstanceOf(Function);
  return mod!.createPushRegistration as unknown as CreatePushRegistration;
}

async function signedInAnna(steps: Step[]) {
  const createPushRegistration = await loadRegistration();
  const notifications = new FakeNotifications(steps);
  const auth = new FakeAuth();
  const push = createPushRegistration({
    notifications,
    auth,
    channelName: 'Promemoria',
    tokenTimeoutMs: TOKEN_TIMEOUT_MS,
  });
  return { notifications, auth, push };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function tokensPosted(auth: FakeAuth): unknown[] {
  return auth.posts
    .filter((p) => p.path === '/api/me/devices')
    .map((p) => (p.body as { token?: unknown }).token);
}

/** Waits until `ready()` holds, at most {@link WITHIN_MS}. */
async function within(ready: () => boolean): Promise<void> {
  const deadline = Date.now() + WITHIN_MS;
  while (!ready() && Date.now() < deadline) await sleep(20);
}

test.describe('giro 042 — a token call that never settles does not stop the registration', () => {
  test('B1 the first token call hangs: a second ensure() registers the phone within 3 s, and the late token is ignored', async () => {
    const { notifications, auth, push } = await signedInAnna(['hang', 'token']);
    try {
      void push.ensure();
      void push.ensure();

      await within(() => tokensPosted(auth).includes(ANNA_PHONE));
      expect(tokensPosted(auth), 'POST /api/me/devices within 3 s').toEqual([ANNA_PHONE]);
      expect(auth.posts[0].body).toEqual({ token: ANNA_PHONE, platform: 'ANDROID' });

      notifications.settleLate(LATE_PHONE);
      await sleep(TOKEN_TIMEOUT_MS + 200);
      expect(tokensPosted(auth), 'no POST with the token that came after the timeout').toEqual([
        ANNA_PHONE,
      ]);
    } finally {
      push.dispose();
    }
  });

  test('B2 the first token call hangs and the listener hands the token: it waits for the timeout, then the POST goes out within 3 s', async () => {
    const { notifications, auth, push } = await signedInAnna(['hang']);
    try {
      void push.ensure();
      await within(() => notifications.listeners.length > 0 && notifications.tokenCalls > 0);
      expect(notifications.listeners.length, 'the token listener is installed').toBeGreaterThan(0);

      const rotatedAt = Date.now();
      notifications.rotate(ANNA_PHONE);

      await within(() => tokensPosted(auth).includes(ANNA_PHONE));
      expect(tokensPosted(auth), 'POST /api/me/devices within 3 s').toEqual([ANNA_PHONE]);
      expect(
        auth.posts[0].at - rotatedAt,
        'the rotated token waits for the run in the queue (no jump ahead)',
      ).toBeGreaterThanOrEqual(TOKEN_TIMEOUT_MS / 2);
    } finally {
      push.dispose();
    }
  });

  test('B3 the first token call fails: the second ensure() registers the phone once', async () => {
    const { auth, push } = await signedInAnna(['reject', 'token']);
    try {
      await push.ensure();
      expect(tokensPosted(auth), 'nothing posted after a failed token call').toEqual([]);
      await push.ensure();
      await push.ensure();
      expect(tokensPosted(auth), 'one POST for the session').toEqual([ANNA_PHONE]);
    } finally {
      push.dispose();
    }
  });
});
