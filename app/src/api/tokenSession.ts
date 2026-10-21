import type { Http } from '@/sync/types';

export type Credentials = { token: string; personId: string };

export type TokenVault = {
  get(): Promise<Credentials | null>;
  set(credentials: Credentials): Promise<void>;
  clear(): Promise<void>;
};

export type Timers = {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
};

export type LoginOutcome = 'ok' | 'invalid' | 'tooMany' | 'error';

type FetchInit = {
  method: string;
  headers: Record<string, string>;
  body?: string;
  credentials: 'omit';
  signal: AbortSignal;
};

type Options = {
  vault: TokenVault;
  fetch: (input: string, init?: FetchInit) => Promise<Response>;
  baseUrl: string;
  timers: Timers;
  timeoutMs: number;
};

export type TokenSession = {
  login(email: string, password: string): Promise<LoginOutcome>;
  current(): Promise<Credentials | undefined>;
  http: Http;
  /** Discards every request now in flight (as `logout()` does), without touching the vault. */
  invalidate(): void;
  logout(): Promise<void>;
};

/** Android session: an opaque token in a vault, Bearer requests, no cookies and no CSRF. */
export function createTokenSession({
  vault,
  fetch,
  baseUrl,
  timers,
  timeoutMs,
}: Options): TokenSession {
  // Bumped by `logout()`: an answer that comes back after it is discarded.
  let generation = 0;

  async function current(): Promise<Credentials | undefined> {
    try {
      return (await vault.get()) ?? undefined;
    } catch {
      await vault.clear().catch(() => undefined);
      return undefined;
    }
  }

  function invalidate() {
    generation++;
  }

  /** Rejects on network error or timeout only; any answer is `{ status, body }`. */
  async function send(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body: unknown,
    token?: string,
  ): Promise<{ status: number; body: unknown }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const controller = new AbortController();
    const timer = timers.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'omit',
        signal: controller.signal,
      });
      const json: unknown = await response.json().catch(() => null);
      return { status: response.status, body: json };
    } finally {
      timers.clearTimeout(timer);
    }
  }

  return {
    current,

    async login(email, password) {
      try {
        const r = await send('POST', '/api/auth/login', { email, password, client: 'android' });
        if (r.status === 401) return 'invalid';
        if (r.status === 429) return 'tooMany';
        const body = r.body as Partial<Credentials> | null;
        if (r.status < 200 || r.status >= 300 || !body?.token || !body.personId) return 'error';
        await vault.set({ token: body.token, personId: body.personId });
        return 'ok';
      } catch {
        return 'error';
      }
    },

    http: async ({ method, path, body }) => {
      const born = generation;
      const credentials = await current();
      if (born !== generation) throw new Error('signed out');
      if (!credentials) return { status: 401, body: null };
      const answer = await send(method, path, body, credentials.token);
      if (born !== generation) throw new Error('signed out');
      return answer;
    },

    invalidate,

    /** Clears the vault at once; the server is told, but never waited for. */
    async logout() {
      invalidate();
      const credentials = await current();
      await vault.clear().catch(() => undefined);
      if (credentials)
        send('POST', '/api/auth/logout', undefined, credentials.token).catch(() => {});
    },
  };
}
