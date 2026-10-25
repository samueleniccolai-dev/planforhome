import { act } from 'react';
import { Platform } from 'react-native';
import { createRoot, type TestInstance } from 'test-renderer';

import type { SyncResult } from '@/sync/types';

import FamilyScreen from '../../../app/family';

const mockReplace = jest.fn();
const mockApiCall = jest.fn();
let mockRuntime: ReturnType<typeof fakeRuntime>;

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ id: '0192f0a0-0000-7000-8000-0000000000f1' }),
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/i18n', () => ({
  useT: () => (key: string, params?: Record<string, string>) =>
    params?.name ? `${key}:${params.name}` : key,
}));
jest.mock('@/sync/runtime', () => ({ getRuntime: () => Promise.resolve(mockRuntime) }));
jest.mock('@/api/client', () => ({
  families: (...args: unknown[]) => mockApiCall('families', ...args),
  members: (...args: unknown[]) => mockApiCall('members', ...args),
  familyTasks: (...args: unknown[]) => mockApiCall('familyTasks', ...args),
  reopenTask: (...args: unknown[]) => mockApiCall('reopenTask', ...args),
  cancelTask: (...args: unknown[]) => mockApiCall('cancelTask', ...args),
  endSeries: (...args: unknown[]) => mockApiCall('endSeries', ...args),
}));

const F1 = '0192f0a0-0000-7000-8000-0000000000f1';
const ANNA = 'p1';
const family = { id: F1, name: 'Rossi', timeZone: 'Europe/Rome', role: 'MANAGER' as const };
const directory = {
  family,
  members: [{ personId: ANNA, displayName: 'Anna', role: 'MANAGER' as const }],
};
const row = (id: string, data: Record<string, unknown>) => ({
  entity: 'task' as const,
  id,
  familyId: F1,
  taskId: null,
  data: { id, familyId: F1, title: `Task ${id}`, status: 'OPEN', assigneePersonId: null, ...data },
});

function fakeRuntime(queue: { taskId: string }[] = [], enqueue?: () => Promise<unknown>) {
  const listeners = new Set<(result: SyncResult) => void>();
  return {
    engine: {
      rows: jest.fn(async () => [row('a', {}), row('b', { status: 'DONE', completedBy: ANNA })]),
      directory: jest.fn(async () => directory),
      families: jest.fn(async () => [family]),
      queue: jest.fn(async () => queue),
      enqueue: jest.fn(enqueue ?? (async () => ({}))),
    },
    auth: { current: async () => ({ token: 't', personId: ANNA }) },
    session: { afterWrite: jest.fn() },
    subscribe: (listener: (result: SyncResult) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    emit: (result: SyncResult) => listeners.forEach((l) => l(result)),
  };
}

const byLabel = (root: TestInstance, label: string) =>
  root.queryAll((n) => n.props.accessibilityLabel === label, { matchDeepestOnly: true });
const isDisabled = (n: TestInstance) => n.props.accessibilityState?.disabled === true;
const texts = (root: TestInstance) => JSON.stringify(root.toJSON());

async function press(root: TestInstance, label: string, times = 1) {
  const target = byLabel(root, label)[0];
  if (!target) throw new Error(`no control labelled ${label}`);
  await act(async () => {
    for (let i = 0; i < times; i++) {
      target.props.onClick({ stopPropagation() {}, preventDefault() {} });
    }
  });
}

async function open() {
  const root = createRoot();
  await act(async () => {
    root.render(<FamilyScreen />);
  });
  return root;
}

describe('family screen on Android with the local runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'android');
    mockRuntime = fakeRuntime();
  });
  afterEach(() => jest.restoreAllMocks());

  it('opens from the local data and calls no API', async () => {
    const root = await open();
    expect(mockApiCall).not.toHaveBeenCalled();
    expect(texts(root.container)).toContain('Task a');
    expect(texts(root.container)).toContain('Rossi');
  }, 30000); // cold Jest cache: the first render loads the whole screen

  it('a network error disables reopen and never goes to /login', async () => {
    const root = await open();
    expect(byLabel(root.container, 'task.reopen').every(isDisabled)).toBe(false);
    await act(async () => {
      mockRuntime.emit({ status: 'offline', notices: [] });
    });
    expect(byLabel(root.container, 'task.reopen').every(isDisabled)).toBe(true);
    expect(byLabel(root.container, 'task.cancel').every(isDisabled)).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockApiCall).not.toHaveBeenCalled();
  });

  it('take and done are queued, not sent to the API', async () => {
    const root = await open();
    await press(root.container, 'task.card.take');
    await press(root.container, 'task.card.doneLabel');
    const queued = mockRuntime.engine.enqueue.mock.calls.map((c) => (c as unknown[])[0]);
    expect(queued).toMatchObject([
      { entity: 'task', entityId: 'a', taskId: 'a', path: expect.stringMatching(/\/take$/) },
      { entity: 'task', entityId: 'a', taskId: 'a', path: expect.stringMatching(/\/done$/) },
    ]);
    expect(mockRuntime.session.afterWrite).toHaveBeenCalledTimes(2);
    expect(mockApiCall).not.toHaveBeenCalled();
  });

  it('cancel is disabled while a change of the task waits in the queue, network up', async () => {
    mockRuntime = fakeRuntime([{ taskId: 'a' }]);
    const root = await open();
    await act(async () => {
      mockRuntime.emit({ status: 'ok', notices: [] });
    });
    expect(byLabel(root.container, 'task.cancel').every(isDisabled)).toBe(true);
    expect(byLabel(root.container, 'task.reopen').some(isDisabled)).toBe(false);
  });

  it('two quick taps on done queue one change', async () => {
    mockRuntime = fakeRuntime([], () => new Promise((resolve) => setTimeout(resolve, 0)));
    const root = await open();
    await press(root.container, 'task.card.doneLabel', 2);
    expect(mockRuntime.engine.enqueue).toHaveBeenCalledTimes(1);
  });

  it('shows a discreet notice: status role, polite live region on both platforms', async () => {
    const root = await open();
    await act(async () => {
      mockRuntime.emit({
        status: 'ok',
        notices: [
          {
            kind: 'conflict',
            familyId: F1,
            entity: 'task',
            entityId: 'a',
            mutationId: 'm1',
            path: `/api/families/${F1}/tasks/a/take`,
            detail: { error: 'already_taken', assigneePersonId: 'p2', assigneeName: 'Luca Rossi' },
          },
        ],
      });
    });
    const status = root.container.queryAll((n) => n.props.role === 'status');
    expect(status).toHaveLength(1);
    expect(status[0].props['aria-live']).toBe('polite');
    expect(status[0].props.accessibilityLiveRegion).toBe('polite');
    expect(texts(status[0])).toContain('task.taken:Luca Rossi');
    expect(root.container.queryAll((n) => n.props.role === 'alert')).toHaveLength(0);
    await press(root.container, 'task.noticeClose');
    expect(root.container.queryAll((n) => n.props.role === 'status')).toHaveLength(0);
  });

  it('undo of done goes to the network, then asks for a sync and reads the rows again', async () => {
    const root = await open();
    await press(root.container, 'task.card.doneLabel');
    mockApiCall.mockResolvedValueOnce({
      status: 'ok',
      value: { id: 'a', title: 'Task a', version: 3 },
    });
    const syncs = mockRuntime.session.afterWrite.mock.calls.length;
    const reads = mockRuntime.engine.rows.mock.calls.length;
    await press(root.container, 'task.card.undo');
    expect(mockApiCall).toHaveBeenCalledWith(
      'reopenTask',
      F1,
      'a',
      expect.objectContaining({ mutationId: expect.any(String) }),
    );
    expect(mockRuntime.session.afterWrite.mock.calls.length).toBe(syncs + 1);
    expect(mockRuntime.engine.rows.mock.calls.length).toBeGreaterThan(reads);
  });

  it('the notice of a write has one writer at a time: a second tap during the first is dropped', async () => {
    mockRuntime = fakeRuntime([], () => new Promise((resolve) => setTimeout(resolve, 0)));
    const root = await open();
    await act(async () => {
      byLabel(root.container, 'task.card.take')[0].props.onClick({ stopPropagation() {} });
      byLabel(root.container, 'task.card.doneLabel')[0].props.onClick({ stopPropagation() {} });
    });
    expect(mockRuntime.engine.enqueue).toHaveBeenCalledTimes(1);
  });
});
