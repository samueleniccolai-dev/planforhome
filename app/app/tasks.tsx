import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import {
  families,
  me,
  members,
  myTasks,
  type Family,
  type FamilyMember,
  type Task,
} from '@/api/client';
import { FamilySwitch } from '@/family/FamilySwitch';
import { useT } from '@/i18n';
import { applyFilter, FILTERS, type Filter } from '@/task/filters';
import { quickBlocked } from '@/task/quickBlocked';
import { TaskSectionList } from '@/task/TaskSectionList';
import { useQuickActions, useQueue } from '@/task/useQuickActions';
import { EmptyState } from '@/ui/EmptyState';
import { FilterTabs } from '@/ui/FilterTabs';
import { InlineNotice } from '@/ui/InlineNotice';
import { Region } from '@/ui/Region';
import { Screen } from '@/ui/Screen';
import { TaskCard } from '@/ui/TaskCard';
import { Text } from '@/ui/Text';

type Loaded = { list: Family[]; tasks: Task[]; people: FamilyMember[]; personId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FILTER_KEYS: Record<Filter, string> = {
  all: 'task.filterAll',
  mine: 'task.filterMine',
  queue: 'task.filterQueue',
  dueSoon: 'task.filterDueSoon',
};

/** The tasks of all the families of the signed-in person, each with the zone of its family. */
export default function AllTasks() {
  const t = useT();
  const router = useRouter();
  const { task: taskParam } = useLocalSearchParams<{ task?: string }>();
  const [loaded, setLoaded] = useState<Loaded | undefined>();
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const queue = useQueue();

  useEffect(() => {
    let alive = true;
    (async () => {
      const [tasks, mine, who] = await Promise.all([myTasks(), families(), me()]);
      if (!alive) return;
      if (tasks.status === 'unauthorized' || mine.status === 'unauthorized') {
        router.replace('/login');
        return;
      }
      if (!who) return router.replace('/login');
      if (tasks.status !== 'ok' || mine.status !== 'ok') return setFailed(true);
      const crews = await Promise.all(mine.value.map((f) => members(f.id)));
      if (!alive) return;
      const people: FamilyMember[] = [];
      for (const crew of crews) {
        if (crew.status === 'unauthorized') return router.replace('/login');
        if (crew.status !== 'ok') return setFailed(true);
        people.push(...crew.value);
      }
      setLoaded({ list: mine.value, tasks: tasks.value, people, personId: who.personId });
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const setTasks = useCallback((update: (list: Task[]) => Task[]) => {
    setLoaded((current) => (current ? { ...current, tasks: update(current.tasks) } : current));
  }, []);

  /** Asks again and replaces the list: a task that is gone must go. */
  const reload = useCallback(async () => {
    const again = await myTasks();
    if (again.status === 'ok') setTasks(() => again.value);
    if (again.status === 'unauthorized') router.replace('/login');
  }, [router, setTasks]);

  const onUnauthorized = useCallback(() => router.replace('/login'), [router]);
  const quick = useQuickActions({
    people: loaded?.people ?? [],
    setTasks,
    reload,
    onUnauthorized,
  });

  if (failed) {
    return (
      <Screen>
        <InlineNotice tone="danger">{t('task.loadError')}</InlineNotice>
      </Screen>
    );
  }
  if (!loaded) return null;

  const wanted = typeof taskParam === 'string' && UUID.test(taskParam) ? taskParam : undefined;
  const opened = wanted ? loaded.tasks.find((task) => task.id === wanted) : undefined;
  const now = new Date();
  const shown = applyFilter(filter, loaded.tasks, loaded.personId, now);
  const familyName = (task: Task) => loaded.list.find((f) => f.id === task.familyId)?.name;
  const card = (task: Task, overdue: boolean) => (
    <TaskCard
      task={task}
      people={loaded.people}
      familyName={familyName(task)}
      overdue={overdue}
      disabled={quick.busy || quickBlocked(task.id, queue)}
      onToggle={() => void quick.done(task)}
      onTake={() => void quick.take(task)}
    />
  );
  const notice = quick.notice;
  const goAdd = () =>
    router.push(loaded.list.length === 1 ? `/family?id=${loaded.list[0].id}` : '/families');

  return (
    <Screen>
      <FamilySwitch families={loaded.list} />
      <Text variant="title" heading={1}>
        {t('task.all')}
      </Text>
      {wanted && !opened ? <InlineNotice>{t('task.notAvailable')}</InlineNotice> : null}
      {notice ? (
        <InlineNotice
          tone={notice.tone}
          action={
            notice.undo
              ? {
                  label: t('task.card.undo'),
                  onPress: () => void quick.undo(),
                  disabled: quick.busy,
                }
              : undefined
          }
        >
          {t(notice.key, notice.params)}
        </InlineNotice>
      ) : null}
      {opened ? <Region label={t('task.fromNotification')}>{card(opened, false)}</Region> : null}
      <FilterTabs
        label={t('task.filter')}
        options={FILTERS.map((f) => ({ key: f, label: t(FILTER_KEYS[f]) }))}
        value={filter}
        onChange={setFilter}
      />
      {loaded.tasks.length === 0 ? (
        <EmptyState
          title={t('task.empty.title')}
          hint={t('task.empty.hint')}
          action={{ label: t('task.empty.add'), onPress: goAdd }}
        />
      ) : null}
      {loaded.tasks.length > 0 && shown.length === 0 ? (
        <EmptyState title={t('task.empty.filter')} />
      ) : null}
      <TaskSectionList
        label={t('task.allList')}
        tasks={shown}
        now={now}
        renderCard={(task, section) => card(task, section === 'overdue')}
      />
    </Screen>
  );
}
