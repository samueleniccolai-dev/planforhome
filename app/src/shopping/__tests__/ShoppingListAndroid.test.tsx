import { act } from 'react';
import { Platform } from 'react-native';
import { createRoot, type TestInstance } from 'test-renderer';

import type { SyncResult } from '@/sync/types';

const mockReplace = jest.fn();
const mockListItems = jest.fn();
const mockApiCall = jest.fn();
let mockRuntime: ReturnType<typeof fakeRuntime>;

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock('@/i18n', () => ({
  useT: () => (key: string, params?: Record<string, string>) =>
    params?.item ? `${key}:${params.item}` : key,
}));
jest.mock('@/sync/runtime', () => ({ getRuntime: () => Promise.resolve(mockRuntime) }));
jest.mock('@/api/client', () => ({
  listItems: (...args: unknown[]) => mockListItems(...args),
  families: (...args: unknown[]) => mockApiCall('families', ...args),
  me: (...args: unknown[]) => mockApiCall('me', ...args),
  members: (...args: unknown[]) => mockApiCall('members', ...args),
  familyTasks: (...args: unknown[]) => mockApiCall('familyTasks', ...args),
  addItem: (...args: unknown[]) => mockApiCall('addItem', ...args),
  checkItem: (...args: unknown[]) => mockApiCall('checkItem', ...args),
  clearChecked: (...args: unknown[]) => mockApiCall('clearChecked', ...args),
  removeItem: (...args: unknown[]) => mockApiCall('removeItem', ...args),
  reorderItems: (...args: unknown[]) => mockApiCall('reorderItems', ...args),
  restoreItem: (...args: unknown[]) => mockApiCall('restoreItem', ...args),
}));

// eslint-disable-next-line import/first
import { ShoppingList } from '../ShoppingList';

const task = { id: 't1', title: 'Spesa sabato', createdBy: 'p1' };
const item = (id: string, text: string, position: number) => ({
  entity: 'shopping_item' as const,
  id,
  familyId: 'f1',
  taskId: 't1',
  data: { id, taskId: 't1', text, checked: false, position, version: 1, createdBy: 'p1' },
});

function fakeRuntime(queue: { taskId: string }[] = []) {
  const listeners = new Set<(result: SyncResult) => void>();
  return {
    engine: {
      rows: jest.fn(async () => [
        { entity: 'task' as const, id: 't1', familyId: 'f1', taskId: null, data: task },
        item('i1', 'Latte', 0),
        item('i2', 'Pane', 1),
      ]),
      queue: jest.fn(async () => queue),
      enqueue: jest.fn(async () => ({})),
    },
    auth: { current: async () => ({ token: 't', personId: 'p1' }) },
    session: { afterWrite: jest.fn() },
    subscribe: (listener: (result: SyncResult) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    emit: (result: SyncResult) => listeners.forEach((l) => l(result)),
  };
}

const byLabel = (root: TestInstance, prefix: string) =>
  root.queryAll(
    (n) =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(prefix),
    { matchDeepestOnly: false },
  );
const isDisabled = (n: TestInstance) => n.props.accessibilityState?.disabled === true;
const texts = (root: TestInstance) => JSON.stringify(root.toJSON());

async function open() {
  const root = createRoot();
  await act(async () => {
    root.render(<ShoppingList familyId="f1" taskId="t1" />);
  });
  return root;
}

describe('shopping list on Android with the local runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'android');
    mockRuntime = fakeRuntime();
  });
  afterEach(() => jest.restoreAllMocks());

  it('reads the local rows and calls no list API when opened', async () => {
    const root = await open();
    expect(mockListItems).not.toHaveBeenCalled();
    expect(mockApiCall).not.toHaveBeenCalled();
    expect(mockRuntime.engine.rows).toHaveBeenCalledWith('f1');
    expect(texts(root.container)).toContain('Latte');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('a network error disables the direct buttons and never goes to /login', async () => {
    const root = await open();
    const buttons = () => [
      ...byLabel(root.container, 'list.remove:'),
      ...byLabel(root.container, 'list.moveUp:'),
      ...byLabel(root.container, 'list.moveDown:'),
    ];
    expect(buttons().length).toBeGreaterThan(0);
    expect(byLabel(root.container, 'list.remove:').some(isDisabled)).toBe(false);
    await act(async () => {
      mockRuntime.emit({ status: 'offline', notices: [] });
    });
    expect(buttons().every(isDisabled)).toBe(true);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockListItems).not.toHaveBeenCalled();
  });

  it('disables the direct buttons while a change of the task waits in the queue', async () => {
    mockRuntime = fakeRuntime([{ taskId: 't1' }]);
    const root = await open();
    expect(byLabel(root.container, 'list.remove:').every(isDisabled)).toBe(true);
  });

  it('shows the forbidden notice when the server refused a change of this family', async () => {
    const root = await open();
    await act(async () => {
      mockRuntime.emit({
        status: 'ok',
        notices: [
          {
            kind: 'forbidden',
            familyId: 'f1',
            entity: 'shopping_item',
            entityId: 'i1',
            mutationId: 'm1',
          },
        ],
      });
    });
    expect(texts(root.container)).toContain('list.forbidden');
  });
});
