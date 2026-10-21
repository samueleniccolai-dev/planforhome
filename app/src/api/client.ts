import type { Rule } from '@/task/recurrence';

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

function call(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<Response> {
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
export async function me(): Promise<{ displayName: string; personId: string } | undefined> {
  try {
    const response = await call('GET', '/api/me');
    return response.ok
      ? ((await response.json()) as { displayName: string; personId: string })
      : undefined;
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

export type Task = {
  id: string;
  familyId: string;
  familyTimeZone: string;
  title: string;
  notes: string | null;
  dueKind: 'DATE' | 'DATETIME' | null;
  due: string | null;
  criticality: 'LOW' | 'NORMAL' | 'HIGH';
  status: 'OPEN' | 'DONE' | 'CANCELLED';
  assigneePersonId: string | null;
  createdBy: string;
  completedBy: string | null;
  version: number;
  updatedAt: string;
  recurrence?: Rule | null;
  seriesId?: string | null;
};

export type WriteOutcome =
  | { status: 'ok'; value: Task }
  | { status: 'unauthorized' | 'notFound' | 'forbidden' | 'invalid' | 'changed' | 'error' }
  | { status: 'alreadyTaken'; assigneePersonId?: string; assigneeName?: string };

async function write(method: 'POST' | 'PUT', path: string, body: unknown): Promise<WriteOutcome> {
  try {
    const response = await call(method, path, body);
    if (response.ok) return { status: 'ok', value: (await response.json()) as Task };
    if (response.status === 401) return { status: 'unauthorized' };
    if (response.status === 403) return { status: 'forbidden' };
    if (response.status === 404) return { status: 'notFound' };
    if (response.status === 400) return { status: 'invalid' };
    if (response.status === 409) {
      const json = (await response.json().catch(() => ({}))) as {
        error?: string;
        assigneePersonId?: string;
        assigneeName?: string;
      };
      if (json.error === 'not_open' || json.error === 'not_done' || json.error === 'not_recurring')
        return { status: 'changed' };
      if (json.error === 'already_taken') {
        return {
          status: 'alreadyTaken',
          assigneePersonId: json.assigneePersonId,
          assigneeName: json.assigneeName,
        };
      }
    }
    return { status: 'error' };
  } catch {
    return { status: 'error' };
  }
}

const taskPath = (familyId: string) => `/api/families/${encodeURIComponent(familyId)}/tasks`;

/** The tasks of one family; 404 when the caller is not in it. */
export function familyTasks(familyId: string): Promise<Outcome<Task[]>> {
  return read<Task[]>(taskPath(familyId));
}

/** The tasks of every family of the signed-in person. */
export function myTasks(): Promise<Outcome<Task[]>> {
  return read<Task[]>('/api/tasks');
}

export function createTask(
  familyId: string,
  body: {
    id: string;
    mutationId: string;
    title: string;
    dueKind?: 'DATE' | 'DATETIME';
    due?: string;
    recurrence?: Rule;
  },
): Promise<WriteOutcome> {
  return write('POST', taskPath(familyId), body);
}

/** `assigneePersonId: null` puts the task back in the queue. */
export function assignTask(
  familyId: string,
  taskId: string,
  body: { mutationId: string; assigneePersonId: string | null },
): Promise<WriteOutcome> {
  return write('PUT', `${taskPath(familyId)}/${encodeURIComponent(taskId)}/assignee`, body);
}

export function takeTask(
  familyId: string,
  taskId: string,
  body: { mutationId: string },
): Promise<WriteOutcome> {
  return write('POST', `${taskPath(familyId)}/${encodeURIComponent(taskId)}/take`, body);
}

/** P11: moves an open task to another family of the caller; the server decides. */
export function forwardTask(
  familyId: string,
  taskId: string,
  body: { mutationId: string; toFamilyId: string },
): Promise<WriteOutcome> {
  return write('POST', `${taskPath(familyId)}/${encodeURIComponent(taskId)}/forward`, body);
}

function transition(familyId: string, taskId: string, action: string, mutationId: string) {
  return write('POST', `${taskPath(familyId)}/${encodeURIComponent(taskId)}/${action}`, {
    mutationId,
  });
}

export const completeTask = (familyId: string, taskId: string, body: { mutationId: string }) =>
  transition(familyId, taskId, 'done', body.mutationId);

export const reopenTask = (familyId: string, taskId: string, body: { mutationId: string }) =>
  transition(familyId, taskId, 'reopen', body.mutationId);

export const cancelTask = (familyId: string, taskId: string, body: { mutationId: string }) =>
  transition(familyId, taskId, 'cancel', body.mutationId);

export const endSeries = (familyId: string, taskId: string, body: { mutationId: string }) =>
  transition(familyId, taskId, 'end-series', body.mutationId);
