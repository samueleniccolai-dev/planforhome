import { useState } from 'react';
import { View } from 'react-native';

import type { FamilyMember, Task } from '@/api/client';
import { useT } from '@/i18n';
import { CriticalityBadge } from '@/ui/CriticalityBadge';
import { EmptyState } from '@/ui/EmptyState';
import { FamilyTag } from '@/ui/FamilyTag';
import { FilterTabs } from '@/ui/FilterTabs';
import { InlineNotice } from '@/ui/InlineNotice';
import { PersonBadge } from '@/ui/PersonBadge';
import { Screen } from '@/ui/Screen';
import { TaskCard } from '@/ui/TaskCard';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

import { TaskSectionList } from './TaskSectionList';

// Invented data (SPEC Appendix A). The «now» of the gallery is fixed, so the sections never move.
const NOW = new Date('2026-11-03T03:00:00Z');
const ROME = 'Europe/Rome';
const NEW_YORK = 'America/New_York';

const PEOPLE: Pick<FamilyMember, 'personId' | 'displayName'>[] = [
  { personId: '0192a3b4-0000-7000-8000-0000000000a1', displayName: 'Marco' },
  { personId: '0192a3b4-0000-7000-8000-000000000004', displayName: 'Giulia' },
  { personId: '0192a3b4-0000-7000-8000-0000000000a2', displayName: 'Leo' },
  { personId: '0192a3b4-0000-7000-8000-0000000000a3', displayName: 'Sofia' },
];
const [MARCO, GIULIA] = PEOPLE.map((p) => p.personId);

let counter = 0;
function make(title: string, fields: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `gallery-${counter}`,
    familyId: 'gallery-family',
    familyTimeZone: ROME,
    title,
    notes: null,
    dueKind: null,
    due: null,
    criticality: 'NORMAL',
    status: 'OPEN',
    assigneePersonId: null,
    createdBy: MARCO,
    completedBy: null,
    version: 1,
    updatedAt: '2026-10-20T08:00:00Z',
    ...fields,
  };
}

const date = (due: string) => ({ dueKind: 'DATE' as const, due });
const at = (due: string) => ({ dueKind: 'DATETIME' as const, due });

function sample(t: (key: string) => string): { label: string; task: Task; overdue?: boolean }[] {
  const name = (key: string) => t(`gallery.list.titles.${key}`);
  const label = (key: string) => t(`gallery.list.cardLabels.${key}`);
  return [
    {
      label: label('assigned'),
      task: make(name('foto'), { assigneePersonId: GIULIA, ...date('2026-11-03') }),
    },
    { label: label('queue'), task: make(name('spesa')) },
    {
      label: label('overdue'),
      overdue: true,
      task: make(name('zaino'), {
        assigneePersonId: PEOPLE[2].personId,
        ...at('2026-11-02T17:30:00Z'),
      }),
    },
    {
      label: label('high'),
      task: make(name('pranzo'), { criticality: 'HIGH', ...date('2026-12-20') }),
    },
    {
      label: label('low'),
      task: make(name('libri'), {
        assigneePersonId: GIULIA,
        criticality: 'LOW',
        ...date('2026-11-04'),
      }),
    },
    {
      label: label('recurring'),
      task: make(name('carta'), {
        assigneePersonId: MARCO,
        recurrence: { type: 'WEEKLY', days: ['TUESDAY'] },
        ...date('2026-11-03'),
      }),
    },
    {
      label: label('nudged'),
      task: make(name('mensa'), {
        assigneePersonId: GIULIA,
        lastNudgedAt: '2026-11-02T16:42:00Z',
        ...at('2026-11-03T16:00:00Z'),
      }),
    },
    {
      label: label('done'),
      task: make(name('bici'), {
        assigneePersonId: GIULIA,
        status: 'DONE',
        completedBy: GIULIA,
        ...date('2026-11-01'),
      }),
    },
    { label: label('cancelled'), task: make(name('divano'), { status: 'CANCELLED' }) },
    {
      label: label('long'),
      task: make(t('gallery.list.long'), { assigneePersonId: MARCO, ...date('2026-11-13') }),
    },
  ];
}

function listTasks(t: (key: string) => string): Task[] {
  const name = (key: string) => t(`gallery.list.titles.${key}`);
  const mamma = { familyTimeZone: NEW_YORK };
  return [
    make(name('zaino'), { assigneePersonId: PEOPLE[2].personId, ...at('2026-11-02T17:30:00Z') }),
    make(name('foto'), {
      ...mamma,
      assigneePersonId: GIULIA,
      criticality: 'HIGH',
      ...date('2026-11-02'),
    }),
    make(name('libri'), {
      ...mamma,
      assigneePersonId: GIULIA,
      criticality: 'LOW',
      ...date('2026-11-02'),
    }),
    make(name('mensa'), { assigneePersonId: GIULIA, ...at('2026-11-03T16:00:00Z') }),
    make(name('regalo'), { ...mamma, assigneePersonId: GIULIA, ...date('2026-11-03') }),
    make(name('pranzo'), { ...mamma, criticality: 'HIGH', ...date('2026-12-20') }),
    make(name('spesa')),
    make(name('bici'), { status: 'DONE', assigneePersonId: GIULIA, ...date('2026-11-01') }),
    make(name('divano'), { ...mamma, status: 'CANCELLED' }),
  ];
}

type Tab = 'all' | 'mine' | 'queue' | 'dueSoon';

/** The kit of the list with invented data: every card state, local actions, no network. */
export function TaskListGallery() {
  const t = useT();
  const { space } = useTheme();
  const [tab, setTab] = useState<Tab>('all');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [taken, setTaken] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ key: string; id: string; title: string }>();
  const [cards] = useState(() => sample(t));
  const [list] = useState(() => listTasks(t));

  const apply = (task: Task): Task => ({
    ...task,
    status: done[task.id] ? 'DONE' : task.status,
    assigneePersonId: taken[task.id] ? GIULIA : task.assigneePersonId,
  });
  const toggle = (task: Task) => {
    setDone((d) => ({ ...d, [task.id]: true }));
    setNotice({ key: 'task.card.doneNotice', id: task.id, title: task.title });
  };
  const take = (task: Task) => {
    setTaken((d) => ({ ...d, [task.id]: true }));
    setNotice({ key: 'task.card.takenNotice', id: task.id, title: task.title });
  };
  const undo = () => {
    if (!notice) return;
    if (notice.key === 'task.card.doneNotice') setDone((d) => ({ ...d, [notice.id]: false }));
    else setTaken((d) => ({ ...d, [notice.id]: false }));
    setNotice(undefined);
  };
  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: t('task.filterAll') },
    { key: 'mine', label: t('task.filterMine') },
    { key: 'queue', label: t('task.filterQueue') },
    { key: 'dueSoon', label: t('task.filterDueSoon') },
  ];
  return (
    <Screen>
      <Text variant="title" heading={1}>
        {t('gallery.list.title')}
      </Text>

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.list.people')}
      </Text>
      {PEOPLE.map((p) => (
        <PersonBadge key={p.personId} personId={p.personId} name={p.displayName} />
      ))}

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.list.family')}
      </Text>
      <FamilyTag name={t('gallery.list.familyName')} />
      <CriticalityBadge label={t('task.card.high')} />

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.list.filters')}
      </Text>
      <FilterTabs label={t('task.filter')} options={tabs} value={tab} onChange={setTab} />

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.list.empty')}
      </Text>
      <EmptyState
        title={t('task.empty.title')}
        hint={t('task.empty.hint')}
        action={{ label: t('task.empty.add'), onPress: () => {} }}
      />
      <EmptyState title={t('task.empty.filter')} />

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.list.cards')}
      </Text>
      {notice ? (
        <InlineNotice tone="success" action={{ label: t('task.card.undo'), onPress: undo }}>
          {t(notice.key, { title: notice.title })}
        </InlineNotice>
      ) : null}
      {cards.map(({ label, task, overdue }) => (
        <View key={task.id} style={{ gap: space.xs }}>
          <Text variant="caption" tone="secondary">
            {label}
          </Text>
          <TaskCard
            task={apply(task)}
            people={PEOPLE}
            familyName={t('gallery.list.familyName')}
            overdue={overdue}
            onToggle={() => toggle(task)}
            onTake={() => take(task)}
          />
        </View>
      ))}
      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.list.list')}
      </Text>
      <TaskSectionList
        label={t('gallery.list.region')}
        tasks={list.map(apply)}
        now={NOW}
        renderCard={(task, section) => (
          <TaskCard
            task={task}
            people={PEOPLE}
            familyName={t('gallery.list.familyName')}
            overdue={section === 'overdue'}
            onToggle={() => toggle(task)}
            onTake={() => take(task)}
          />
        )}
      />
    </Screen>
  );
}
