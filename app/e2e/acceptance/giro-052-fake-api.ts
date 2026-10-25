import type { BrowserContext, Page, Request } from '@playwright/test';

// Round 052, T15 part 1 (docs/lab/giri/052-piano.md): a small fake API for the language of the
// account and the three screens made of the kit (/families, /me, /family). It lives in the browser
// (`page.route('**/api/**')`) and answers like the server: login with cookies, logout, `GET
// /api/me` with the `locale` of the account, families, members and tasks of a family. Knob: `hold
// FirstMe()` holds the next `GET /api/me` until the test releases it; the answer is decided when
// the request arrives, as the server would. Demo data invented (SPEC Appendix A, ids of round 047).

export const CSRF = 'csrf-finto-giro052';
const EXPIRES_AT = '2031-02-05T08:00:00Z';
const UPDATED_AT = '2026-10-20T08:00:00Z';

export const PRINCIPALE = '0192a3b4-0000-7000-8000-0000000000f1';
export const MAMMA = '0192a3b4-0000-7000-8000-0000000000f2';

export type Person = {
  personId: string;
  displayName: string;
  email?: string;
  password?: string;
  locale?: 'it' | 'en';
};

export const GIULIA: Person = {
  personId: '0192a3b4-0000-7000-8000-000000000004',
  displayName: 'Giulia',
  email: 'giulia@example.com',
  password: 'password-finta-giulia',
  locale: 'it',
};
export const OLIVER: Person = {
  personId: '0192a3b4-0000-7000-8000-000000052a01',
  displayName: 'Oliver',
  email: 'oliver@example.com',
  password: 'password-finta-oliver',
  locale: 'en',
};
export const MARCO: Person = {
  personId: '0192a3b4-0000-7000-8000-0000000000a1',
  displayName: 'Marco',
};
export const LEO: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a2', displayName: 'Leo' };
const ANNA: Person = { personId: '0192a3b4-0000-7000-8000-0000000000a4', displayName: 'Anna' };

type Role = 'MANAGER' | 'MEMBER';
type Member = { person: Person; role: Role; hasAccount: boolean; referentPersonId: string | null };
type Family = { id: string; name: string; timeZone: string; members: Member[] };

const account = (person: Person, role: Role): Member => ({
  person,
  role,
  hasAccount: true,
  referentPersonId: null,
});

/** Oliver belongs to no family: after the login he lands on /me. */
const FAMILIES: Family[] = [
  {
    id: PRINCIPALE,
    name: 'Famiglia Principale',
    timeZone: 'Europe/Rome',
    members: [
      account(GIULIA, 'MANAGER'),
      account(MARCO, 'MEMBER'),
      { person: LEO, role: 'MEMBER', hasAccount: false, referentPersonId: GIULIA.personId },
    ],
  },
  {
    id: MAMMA,
    name: 'Famiglia Mamma',
    timeZone: 'Europe/Rome',
    members: [account(ANNA, 'MANAGER'), account(GIULIA, 'MEMBER')],
  },
];

export const ZAINO = 'Preparare lo zaino';

const TASKS = [
  {
    id: '0192a3b4-0000-7000-8000-000000052c01',
    familyId: PRINCIPALE,
    familyTimeZone: 'Europe/Rome',
    title: ZAINO,
    notes: null,
    dueKind: null,
    due: null,
    criticality: 'NORMAL',
    status: 'OPEN',
    assigneePersonId: null,
    createdBy: GIULIA.personId,
    completedBy: null,
    version: 1,
    updatedAt: UPDATED_AT,
    recurrence: null,
    seriesId: null,
    template: 'NONE',
    lastNudgedAt: null,
  },
];

const byName = (a: { name: string }, b: { name: string }) => (a.name < b.name ? -1 : 1);
const byPerson = (a: Member, b: Member) => (a.person.displayName < b.person.displayName ? -1 : 1);

export class LocaleApi {
  user: Person | undefined;
  readonly requests: Request[] = [];
  private holdNext = false;
  private gate: Promise<void> | undefined;
  private release: (() => void) | undefined;

  constructor(
    private readonly page: Page,
    private readonly context: BrowserContext,
  ) {}

  /** The next `GET /api/me` waits until `releaseMe()`; the ones after it are answered at once. */
  holdFirstMe(): void {
    this.holdNext = true;
    this.gate = new Promise<void>((done) => (this.release = done));
  }

  releaseMe(): void {
    this.release?.();
  }

  async install(): Promise<void> {
    await this.page.route('**/api/**', async (route) => {
      const request = route.request();
      this.requests.push(request);
      const path = new URL(request.url()).pathname;
      const method = request.method();

      if (method === 'POST' && path === '/api/auth/login') {
        const body = request.postDataJSON() as { email?: string; password?: string };
        const who = [GIULIA, OLIVER].find(
          (p) => p.email === body.email && p.password === body.password,
        );
        if (!who) return route.fulfill({ status: 401, json: { error: 'invalid_credentials' } });
        await this.openSession(who);
        return route.fulfill({
          status: 200,
          json: { expiresAt: EXPIRES_AT, personId: who.personId },
        });
      }
      if (method === 'POST' && path === '/api/auth/logout') {
        this.user = undefined;
        return route.fulfill({ status: 204 });
      }
      if (method === 'GET' && path === '/api/me') {
        // Decided now, with the session of this moment; sent later if held.
        const who = this.user;
        const held = this.holdNext;
        this.holdNext = false;
        if (held && this.gate) await this.gate;
        if (!who) return route.fulfill({ status: 401 });
        return route.fulfill({
          status: 200,
          json: {
            personId: who.personId,
            email: who.email,
            displayName: who.displayName,
            locale: who.locale,
          },
        });
      }
      if (method === 'POST' && path === '/api/auth/refresh') {
        if (!this.user) return route.fulfill({ status: 401 });
        return route.fulfill({ status: 200, json: { expiresAt: EXPIRES_AT } });
      }
      if (!this.user) return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
      const user = this.user;

      if (method === 'GET' && path === '/api/families') {
        return route.fulfill({
          status: 200,
          json: this.familiesOf(user)
            .sort(byName)
            .map((f) => ({
              id: f.id,
              name: f.name,
              timeZone: f.timeZone,
              role: f.members.find((m) => m.person.personId === user.personId)!.role,
            })),
        });
      }
      if (method === 'GET' && path === '/api/tasks') {
        const mine = new Set(this.familiesOf(user).map((f) => f.id));
        return route.fulfill({ status: 200, json: TASKS.filter((t) => mine.has(t.familyId)) });
      }
      if (method === 'GET' && path === '/api/me/devices') {
        return route.fulfill({ status: 200, json: [] });
      }
      const members = /^\/api\/families\/([^/]+)\/members$/.exec(path);
      if (method === 'GET' && members) {
        const family = this.familiesOf(user).find((f) => f.id === members[1]);
        if (!family) return route.fulfill({ status: 404, json: { error: 'not_found' } });
        return route.fulfill({
          status: 200,
          json: [...family.members].sort(byPerson).map((m) => ({
            personId: m.person.personId,
            displayName: m.person.displayName,
            role: m.role,
            hasAccount: m.hasAccount,
            referentPersonId: m.referentPersonId,
          })),
        });
      }
      const list = /^\/api\/families\/([^/]+)\/tasks$/.exec(path);
      if (method === 'GET' && list) {
        if (!this.familiesOf(user).some((f) => f.id === list[1]))
          return route.fulfill({ status: 404, json: { error: 'not_found' } });
        return route.fulfill({ status: 200, json: TASKS.filter((t) => t.familyId === list[1]) });
      }
      return route.fulfill({ status: 404, json: { error: 'not_found' } });
    });
  }

  familiesOf(person: Person): Family[] {
    return FAMILIES.filter((f) => f.members.some((m) => m.person.personId === person.personId));
  }

  async openSession(person: Person): Promise<void> {
    this.user = person;
    await this.context.addCookies([
      { name: 'pfh_csrf', value: CSRF, domain: 'localhost', path: '/', sameSite: 'Lax' },
    ]);
  }

  calls(method: string, path: string): Request[] {
    return this.requests.filter((r) => r.method() === method && new URL(r.url()).pathname === path);
  }
}
