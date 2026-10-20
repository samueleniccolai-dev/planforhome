import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  families,
  members,
  myTasks,
  type Family,
  type FamilyMember,
  type Task,
} from '@/api/client';
import { FamilySwitch } from '@/family/FamilySwitch';
import { useT } from '@/i18n';
import { TaskSummary } from '@/task/TaskSummary';

type Loaded = { list: Family[]; tasks: Task[]; people: FamilyMember[] };

/** The tasks of all the families of the signed-in person, each with the zone of its family. */
export default function AllTasks() {
  const t = useT();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [tasks, mine] = await Promise.all([myTasks(), families()]);
      if (!alive) return;
      if (tasks.status === 'unauthorized' || mine.status === 'unauthorized') {
        router.replace('/login');
        return;
      }
      if (tasks.status !== 'ok' || mine.status !== 'ok') return setFailed(true);
      const crews = await Promise.all(mine.value.map((f) => members(f.id)));
      if (!alive) return;
      const people: FamilyMember[] = [];
      for (const crew of crews) {
        if (crew.status === 'unauthorized') return router.replace('/login');
        if (crew.status !== 'ok') return setFailed(true);
        people.push(...crew.value);
      }
      setLoaded({ list: mine.value, tasks: tasks.value, people });
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

  return (
    <View style={styles.container}>
      <FamilySwitch families={loaded.list} />
      <Text role="heading" aria-level={1} style={styles.title}>
        {t('task.all')}
      </Text>
      {loaded.tasks.length === 0 ? <Text>{t('task.none')}</Text> : null}
      <View role="list" aria-label={t('task.allList')} style={styles.list}>
        {loaded.tasks.map((task) => (
          <View key={task.id} role="listitem" style={styles.item}>
            <TaskSummary
              task={task}
              people={loaded.people}
              familyName={loaded.list.find((f) => f.id === task.familyId)?.name}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  list: { gap: 10 },
  item: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 },
});
