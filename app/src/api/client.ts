const CSRF_COOKIE = 'pfh_csrf';

/** One cookie from a `document.cookie`-style string. */
export function readCookie(jar: string, name: string): string | undefined {
  for (const part of jar.split(';')) {
    const at = part.indexOf('=');
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
}

/** The anti-CSRF header for unsafe requests, from the readable `pfh_csrf` cookie. */
export function csrfHeaders(jar: string): Record<string, string> {
  const value = readCookie(jar, CSRF_COOKIE);
  return value ? { 'X-CSRF-Token': value } : {};
}

function jar(): string {
  return typeof document === 'undefined' ? '' : document.cookie;
}

function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') Object.assign(headers, csrfHeaders(jar()));
  return fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export type LoginOutcome = 'ok' | 'invalid' | 'tooMany' | 'error';

/** Web sign-in: the session comes back as cookies, never in the body. */
export async function login(email: string, password: string): Promise<LoginOutcome> {
  try {
    const response = await call('POST', '/api/auth/login', { email, password, client: 'web' });
    if (response.ok) return 'ok';
    if (response.status === 401) return 'invalid';
    if (response.status === 429) return 'tooMany';
    return 'error';
  } catch {
    return 'error';
  }
}

/** The signed-in person, or undefined without a session. */
export async function me(): Promise<{ displayName: string } | undefined> {
  try {
    const response = await call('GET', '/api/me');
    return response.ok ? ((await response.json()) as { displayName: string }) : undefined;
  } catch {
    return undefined;
  }
}

export async function refresh(): Promise<void> {
  try {
    await call('POST', '/api/auth/refresh');
  } catch {
    // The session simply keeps its current expiry.
  }
}

export async function logout(): Promise<void> {
  try {
    await call('POST', '/api/auth/logout');
  } catch {
    // Leaving the page is enough on the client side.
  }
}

export type Outcome<T> =
  | { status: 'ok'; value: T }
  | { status: 'unauthorized' }
  | { status: 'notFound' }
  | { status: 'error' };

export type Family = { id: string; name: string; timeZone: string; role: 'MANAGER' | 'MEMBER' };

export type FamilyMember = {
  personId: string;
  displayName: string;
  role: 'MANAGER' | 'MEMBER';
  hasAccount: boolean;
  referentPersonId: string | null;
};

async function read<T>(path: string): Promise<Outcome<T>> {
  try {
    const response = await call('GET', path);
    if (response.ok) return { status: 'ok', value: (await response.json()) as T };
    if (response.status === 401) return { status: 'unauthorized' };
    if (response.status === 404) return { status: 'notFound' };
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

/** The families of the signed-in person, in the order of the server. */
export function families(): Promise<Outcome<Family[]>> {
  return read<Family[]>('/api/families');
}

/** The people of one family; 404 when the caller is not in it. */
export function members(familyId: string): Promise<Outcome<FamilyMember[]>> {
  return read<FamilyMember[]>(`/api/families/${encodeURIComponent(familyId)}/members`);
}
