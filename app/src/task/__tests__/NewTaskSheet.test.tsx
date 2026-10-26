import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import { createTaskMutation } from '../queued';
import { TasksSection } from '../TasksSection';

const mockCreate = jest.fn();

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));
jest.mock('@/i18n', () => ({
  deviceLocale: () => 'it',
  currentLocale: () => 'it',
  useT: () => (key: string) => key,
}));
jest.mock('@/api/client', () => ({
  createTask: (...args: unknown[]) => mockCreate(...args),
}));

const F1 = '0192f0a0-0000-7000-8000-0000000000f1';

const byLabel = (root: TestInstance, label: string) =>
  root.queryAll((n) => n.props.accessibilityLabel === label, { matchDeepestOnly: true });
const tap = (root: TestInstance, label: string) =>
  act(async () => {
    const target = byLabel(root, label)[0];
    if (!target) throw new Error(`no control labelled ${label}`);
    target.props.onClick({ stopPropagation() {}, preventDefault() {} });
  });
const type = (root: TestInstance, text: string) =>
  act(async () => {
    root.queryAll((n) => typeof n.props.onChangeText === 'function')[0].props.onChangeText(text);
  });
const texts = (root: TestInstance) => JSON.stringify(root.toJSON());

type Offline = Parameters<typeof TasksSection>[0]['offline'];

async function open(offline?: Offline) {
  const root = createRoot();
  await act(async () => {
    root.render(
      <TasksSection
        familyId={F1}
        timeZone="Europe/Rome"
        manager
        people={[]}
        families={[]}
        tasks={[]}
        loadFailed={false}
        onTasks={() => {}}
        onStale={async () => {}}
        onReload={async () => {}}
        onUnauthorized={() => {}}
        offline={offline}
      />,
    );
  });
  return root.container;
}

describe('createTaskMutation criticality', () => {
  const base = { familyId: F1, taskId: 't1', me: 'p1', title: 'Pane' };

  it('sends it only when it is not Normal, and the local row carries the chosen one', () => {
    const high = createTaskMutation({ ...base, criticality: 'HIGH' });
    expect(high.body).toEqual({ id: 't1', title: 'Pane', criticality: 'HIGH' });
    expect(high.patch).toMatchObject({ criticality: 'HIGH' });
    for (const input of [base, { ...base, criticality: 'NORMAL' as const }]) {
      const normal = createTaskMutation(input);
      expect(normal.body).toEqual({ id: 't1', title: 'Pane' });
      expect(normal.patch).toMatchObject({ criticality: 'NORMAL' });
    }
  });
});

describe('new task sheet in the section', () => {
  beforeEach(() => mockCreate.mockReset());

  it('a new criticality after a network error is a new task; the same one is a retry', async () => {
    mockCreate.mockResolvedValue({ status: 'error' });
    const root = await open();
    await tap(root, 'task.new');
    await type(root, 'Pane');
    await tap(root, 'task.add');
    await tap(root, 'task.add');
    await tap(root, 'task.level.high');
    await tap(root, 'task.add');
    const ids = mockCreate.mock.calls.map((c) => (c[1] as { mutationId: string }).mutationId);
    expect(ids).toHaveLength(3);
    expect(ids[1]).toBe(ids[0]);
    expect(ids[2]).not.toBe(ids[0]);
    expect(mockCreate.mock.calls[2][1]).toMatchObject({ criticality: 'HIGH' });
    expect(texts(root)).toContain('task.failed');
  });

  it('two quick taps on Android queue one task', async () => {
    const create = jest.fn(
      () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 0)),
    );
    const root = await open({ create, blocked: () => false, refresh: async () => {} } as never);
    await tap(root, 'task.new');
    await type(root, 'Pane');
    await act(async () => {
      const add = byLabel(root, 'task.add')[0];
      add.props.onClick({ stopPropagation() {} });
      add.props.onClick({ stopPropagation() {} });
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('a failure after the sheet was closed goes to the section and does not reopen it', async () => {
    let release!: () => void;
    mockCreate.mockImplementation(
      () => new Promise((resolve) => (release = () => resolve({ status: 'error' }))),
    );
    const root = await open();
    await tap(root, 'task.new');
    await type(root, 'Pane');
    await tap(root, 'task.add');
    await tap(root, 'common.close');
    expect(byLabel(root, 'task.add')).toHaveLength(0);
    await act(async () => release());
    expect(byLabel(root, 'task.add')).toHaveLength(0);
    expect(root.queryAll((n) => n.props.role === 'alert')).toHaveLength(1);
    expect(texts(root)).toContain('task.failed');
  });
});
