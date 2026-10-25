import type { BrowserContext, Page, Request } from '@playwright/test';

import { FakeApi, type Task } from './giro-047-fake-api';

export {
  CSRF,
  GATTO,
  GIULIA,
  MAMMA,
  MENSA,
  PRINCIPALE,
  SPESA,
  UUID_V7,
  type Task,
} from './giro-047-fake-api';

// Round 049, T14 part 1 (docs/lab/giri/049-piano.md): the fake API of round 047 plus the creation
// of a task, `POST /api/families/<f>/tasks`, answered like the server: 201 with the new task, 200
// with the same task for a replayed `mutationId`, 404 on a family the caller is not in, 400 on a
// blank title. Knobs: a scripted answer for the next creation (network error, 403) and a gate that
// holds the creations until the test releases it. Demo data invented (SPEC Appendix A).

/** Wednesday 28 October 2026, 10:00 in Rome (after the end of summer time on 25 October). */
export const NOW_049 = '2026-10-28T09:00:00Z';

export type CreateScript = 'abort' | { status: number; json?: unknown };

type Body = {
  id: string;
  mutationId: string;
  title: string;
  dueKind?: 'DATE' | 'DATETIME';
  due?: string;
  criticality?: 'LOW' | 'NORMAL' | 'HIGH';
  recurrence?: Task['recurrence'];
  template?: 'SHOPPING_LIST';
};

export class CreateApi {
  readonly base: FakeApi;
  readonly createScript: CreateScript[] = [];
  private readonly seen = new Map<string, Task>();
  private gate: Promise<void> | undefined;

  constructor(
    private readonly page: Page,
    context: BrowserContext,
  ) {
    this.base = new FakeApi(page, context);
  }

  /** Holds every creation until the returned function is called. */
  hold(): () => void {
    let release!: () => void;
    this.gate = new Promise<void>((done) => (release = done));
    return () => {
      this.gate = undefined;
      release();
    };
  }

  async install(): Promise<void> {
    await this.base.install();
    // Registered after the base: Playwright tries the last route first.
    await this.page.route('**/api/families/*/tasks', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.fallback();
      this.base.requests.push(request);
      const user = this.base.user;
      if (!user) return route.fulfill({ status: 401, json: { error: 'unauthorized' } });
      if (this.gate) await this.gate;
      const scripted = this.createScript.shift();
      if (scripted === 'abort') return route.abort('failed');
      if (scripted) return route.fulfill({ status: scripted.status, json: scripted.json ?? {} });

      const familyId = /\/api\/families\/([^/]+)\/tasks$/.exec(new URL(request.url()).pathname)![1];
      const family = this.base.mine(user, familyId);
      if (!family) return route.fulfill({ status: 404, json: { error: 'not_found' } });
      const body = request.postDataJSON() as Body;
      const replay = this.seen.get(body.mutationId);
      if (replay) return route.fulfill({ status: 200, json: replay });
      if (!body.title || body.title.trim() === '') {
        return route.fulfill({ status: 400, json: { error: 'invalid' } });
      }
      const created: Task = {
        id: body.id,
        familyId,
        familyTimeZone: family.timeZone,
        title: body.title,
        notes: null,
        dueKind: body.dueKind ?? null,
        due: body.due ?? null,
        criticality: body.criticality ?? 'NORMAL',
        status: 'OPEN',
        assigneePersonId: null,
        createdBy: user.personId,
        completedBy: null,
        version: 1,
        updatedAt: NOW_049,
        recurrence: body.recurrence ?? null,
        seriesId: body.recurrence ? body.id : null,
        template: body.template ?? 'NONE',
        lastNudgedAt: null,
      };
      this.base.tasks.push(created);
      this.seen.set(body.mutationId, created);
      return route.fulfill({ status: 201, json: created });
    });
  }

  /** The bodies of the creations sent to one family, in order. */
  creations(familyId: string): Request[] {
    return this.base.calls('POST', `/api/families/${familyId}/tasks`);
  }

  bodies(familyId: string): Record<string, unknown>[] {
    return this.creations(familyId).map((r) => r.postDataJSON() as Record<string, unknown>);
  }
}
