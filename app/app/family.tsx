import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  families,
  familyTasks,
  members,
  type Family,
  type FamilyMember,
  type Task,
} from '@/api/client';
import { FamilySwitch } from '@/family/FamilySwitch';
import { isFamilyId, roleLabel } from '@/family/logic';
import { useT } from '@/i18n';
import { TasksSection } from '@/task/TasksSection';

type Problem = 'notFound' | 'error';

export default function FamilyScreen() {
  const t = useT();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [list, setList] = useState<Family[] | undefined>();
  const [fetched, setFetched] = useState<
    { id: string | undefined; people?: FamilyMember[]; problem?: Problem } | undefined
  >();
  const [listProblem, setListProblem] = useState(false);
  const [taskState, setTaskState] = useState<
    { id: string | undefined; tasks?: Task[]; failed?: boolean } | undefined
  >();

  useEffect(() => {
    let alive = true;
    (async () => {
      const mine = await families();
      if (!alive) return;
      if (mine.status === 'unauthorized') router.replace('/login');
      else if (mine.status !== 'ok') setListProblem(true);
      else setList(mine.value);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const family = list?.find((f) => f.id === id);
  const known = family !== undefined && isFamilyId(id);

  useEffect(() => {
    if (!list) return;
    let alive = true;
    (async () => {
      if (!known) {
        setFetched({ id, problem: 'notFound' });
        return;
      }
      const outcome = await members(id as string);
      if (!alive) return;
      if (outcome.status === 'ok') setFetched({ id, people: outcome.value });
      else if (outcome.status === 'unauthorized') router.replace('/login');
      else setFetched({ id, problem: outcome.status });
    })();
    return () => {
      alive = false;
    };
  }, [list, id, known, router]);

  useEffect(() => {
    if (!known) return;
    let alive = true;
    (async () => {
      const outcome = await familyTasks(id as string);
      if (!alive) return;
      if (outcome.status === 'ok') setTaskState({ id, tasks: outcome.value });
      else if (outcome.status === 'unauthorized') router.replace('/login');
      else setTaskState({ id, failed: true });
    })();
    return () => {
      alive = false;
    };
  }, [known, id, router]);

  // A write answered 404: one reload of tasks and people; a second 404 means the family is gone.
  const onStale = useCallback(async () => {
    if (!isFamilyId(id)) return;
    const [again, mates] = await Promise.all([familyTasks(id), members(id)]);
    if (again.status === 'notFound' || mates.status === 'notFound') {
      setFetched({ id, problem: 'notFound' });
      return;
    }
    if (mates.status === 'ok') setFetched({ id, people: mates.value });
    setTaskState(again.status === 'ok' ? { id, tasks: again.value } : { id, failed: true });
  }, [id]);

  const onTasks = useCallback(
    (update: (list: Task[]) => Task[]) =>
      setTaskState((s) => (s && s.id === id && s.tasks ? { ...s, tasks: update(s.tasks) } : s)),
    [id],
  );

  const loadedTasks = taskState && taskState.id === id ? taskState : undefined;

  // A result for another id (the screen was reused) counts as not loaded yet.
  const current = fetched && fetched.id === id ? fetched : undefined;
  const people = current?.people;
  const problem = listProblem ? 'error' : current?.problem;

  if (problem) {
    return (
      <View style={styles.container}>
        <FamilySwitch families={list} />
        <Text role="alert">{t(problem === 'notFound' ? 'family.notFound' : 'family.error')}</Text>
      </View>
    );
  }
  if (!list || !family || !people) return null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <FamilySwitch families={list} />
      <Text role="heading" aria-level={1} style={styles.title}>
        {family.name}
      </Text>
      <Text role="heading" aria-level={2} style={styles.subtitle}>
        {t('family.people')}
      </Text>
      <View role="list" style={styles.list}>
        {people.map((person) => (
          <View key={person.personId} role="listitem" style={styles.item}>
            <Text>{person.displayName}</Text>
            <Text>{t(roleLabel(person))}</Text>
          </View>
        ))}
      </View>
      <TasksSection
        familyId={id as string}
        people={people}
        tasks={loadedTasks?.tasks}
        loadFailed={loadedTasks?.failed === true}
        onTasks={onTasks}
        onStale={onStale}
        onUnauthorized={() => router.replace('/login')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 20, fontWeight: '600' },
  list: { gap: 6 },
  item: { flexDirection: 'row', gap: 12 },
});
