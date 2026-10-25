import { act } from 'react';
import { createRoot } from 'test-renderer';

import type { Task } from '@/api/client';

import { TaskCard } from '../TaskCard';

const base: Task = {
  id: 't1',
  familyId: 'f1',
  familyTimeZone: 'Europe/Rome',
  title: 'Paper',
  notes: null,
  dueKind: 'DATE',
  due: '2031-01-07',
  criticality: 'NORMAL',
  status: 'OPEN',
  assigneePersonId: null,
  createdBy: 'p1',
  completedBy: null,
  version: 1,
  updatedAt: '2031-01-01T00:00:00Z',
  recurrence: { type: 'WEEKLY', days: ['TUESDAY'] },
};

async function texts(task: Task) {
  const root = createRoot();
  await act(async () => {
    root.render(<TaskCard task={task} people={[]} />);
  });
  return root.container
    .queryAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join('|');
}

describe('TaskCard next occurrence', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2031-01-09T10:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  it('shows the next date for an open repeating task', async () => {
    expect(await texts(base)).toContain('14/01/2031');
  });

  it('does not show it for a done task', async () => {
    expect(await texts({ ...base, status: 'DONE' })).not.toContain('14/01/2031');
  });

  it('does not show it for a task that does not repeat', async () => {
    expect(await texts({ ...base, recurrence: null })).not.toContain('14/01/2031');
  });
});
