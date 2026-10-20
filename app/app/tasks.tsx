import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { TaskSummary } from '@/task/TaskSummary';

type Loaded = { list: Family[]; tasks: Task[]; people: FamilyMember[]; personId: string };

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
  const [loaded, setLoaded] = useState<Loaded | undefined>();
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

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

  if (failed) {
    return (
      <View style={styles.container}>
        <Text role="alert">{t('task.loadError')}</Text>
      </View>
    );
  }
  if (!loaded) return null;

  const shown = applyFilter(filter, loaded.tasks, loaded.personId, new Date());

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <FamilySwitch families={loaded.list} />
      <Text role="heading" aria-level={1} style={styles.title}>
        {t('task.all')}
      </Text>
      <View role="group" aria-label={t('task.filter')} style={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            role="button"
            aria-label={t(FILTER_KEYS[f])}
            aria-pressed={filter === f}
            onPress={() => setFilter(f)}
            style={[styles.filter, filter === f && styles.filterOn]}
          >
            <Text>{t(FILTER_KEYS[f])}</Text>
          </Pressable>
        ))}
      </View>
      {loaded.tasks.length === 0 ? <Text>{t('task.none')}</Text> : null}
      {loaded.tasks.length > 0 && shown.length === 0 ? <Text>{t('task.filterEmpty')}</Text> : null}
      <View role="list" aria-label={t('task.allList')} style={styles.list}>
        {shown.map((task) => (
          <View key={task.id} role="listitem" style={styles.item}>
            <TaskSummary
              task={task}
              people={loaded.people}
              familyName={loaded.list.find((f) => f.id === task.familyId)?.name}
            />
            {task.status === 'DONE' ? <Text>{t('task.done')}</Text> : null}
            {task.status === 'CANCELLED' ? <Text>{t('task.cancelled')}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  list: { gap: 10 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: { borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 6 },
  filterOn: { backgroundColor: '#cfe0ff' },
  item: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 },
});
