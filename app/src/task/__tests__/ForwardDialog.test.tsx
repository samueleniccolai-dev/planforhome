import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import type { Family, FamilyMember, Task } from '@/api/client';

import { ForwardDialog } from '../ForwardDialog';

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));
// The keys come back with their parameters, so the test reads which consequence was chosen.
jest.mock('@/i18n', () => ({
  deviceLocale: () => 'it',
  currentLocale: () => 'it',
  useT: () => (key: string, p?: Record<string, string>) =>
    p && key !== 'task.forward.sameRecurrence' ? `${key}|${p.family}|${p.name}` : key,
}));

const MAMMA: Family = { id: 'f-mamma', name: 'Mamma' } as Family;
const NONNI: Family = { id: 'f-nonni', name: 'Nonni' } as Family;
const people = (...ids: string[]) => ids.map((personId) => ({ personId }) as FamilyMember);

function task(over: Partial<Task>): Task {
  return { title: 'Foto', assigneePersonId: 'giulia', recurrence: null, ...over } as Task;
}

async function open(
  t: Task,
  loadMembers: (id: string) => Promise<FamilyMember[] | undefined>,
  targets = [MAMMA],
) {
  const root = createRoot();
  await act(async () => {
    root.render(
      <ForwardDialog
        task={t}
        assigneeName="Giulia"
        targets={targets}
        busy={false}
        onConfirm={() => {}}
        onCancel={() => {}}
        loadMembers={loadMembers}
      />,
    );
  });
  return root.container;
}

const radios = (view: TestInstance) =>
  view.queryAll((n) => n.props.role === 'radio', { matchDeepestOnly: true });
const text = (view: TestInstance) => JSON.stringify(view.toJSON());
const choose = (view: TestInstance, index: number) =>
  act(async () => {
    radios(view)[index].props.onClick({ stopPropagation() {}, preventDefault() {} });
  });

describe('ForwardDialog consequences', () => {
  it('starts with the reason and no consequence', async () => {
    const view = await open(task({}), async () => []);
    expect(text(view)).toContain('task.forward.choose');
    expect(text(view)).not.toContain('task.forward.staysAssigned');
  });

  it('keeps the assignee when they are in the family of arrival', async () => {
    const view = await open(task({}), async () => people('giulia'));
    await choose(view, 0);
    expect(text(view)).toContain('task.forward.staysAssigned|Mamma|Giulia');
  });

  it('keeps a task in the queue in the queue', async () => {
    const view = await open(task({ assigneePersonId: null }), async () => people('marco'));
    await choose(view, 0);
    expect(text(view)).toContain('task.forward.staysQueued|Mamma');
  });

  it('warns that the task goes to the queue when the assignee is not a member', async () => {
    const view = await open(task({}), async () => people('marco'));
    await choose(view, 0);
    expect(text(view)).toContain('task.forward.warningText|Mamma|Giulia');
    expect(text(view)).toContain('task.forward.warning');
  });

  it('says so when the members cannot be read', async () => {
    const view = await open(task({}), async () => undefined);
    await choose(view, 0);
    expect(text(view)).toContain('task.forward.unknown|Mamma|Giulia');
  });

  it('adds that the recurrence stays the same', async () => {
    const view = await open(task({ recurrence: {} as Task['recurrence'] }), async () =>
      people('giulia'),
    );
    await choose(view, 0);
    expect(text(view)).toContain('task.forward.sameRecurrence');
  });

  it('only the last choice counts when the first answer is slow', async () => {
    let release: (m: FamilyMember[]) => void = () => {};
    const slow = new Promise<FamilyMember[]>((resolve) => (release = resolve));
    const view = await open(
      task({}),
      (id) => (id === MAMMA.id ? slow : Promise.resolve(people('marco'))),
      [MAMMA, NONNI],
    );
    await choose(view, 0);
    await choose(view, 1);
    await act(async () => release(people('giulia')));
    expect(text(view)).toContain('task.forward.warningText|Nonni|Giulia');
    expect(text(view)).not.toContain('task.forward.staysAssigned');
  });
});
