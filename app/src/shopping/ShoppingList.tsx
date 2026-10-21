import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  addItem,
  checkItem,
  clearChecked,
  families,
  familyTasks,
  listItems,
  me,
  members,
  removeItem,
  restoreItem,
  type FamilyMember,
  type Item,
  type ItemOutcome,
  type Task,
} from '@/api/client';
import { useT } from '@/i18n';
import { newIds } from '@/task/logic';

import { canClearChecked, canRemoveStruck, groupItems, mergeItems, whoAdded } from './logic';

type Loaded = {
  task: Task;
  people: FamilyMember[];
  role: 'MANAGER' | 'MEMBER';
  me: string;
  items: Item[];
};

const mutation = () => ({ mutationId: newIds().mutationId });

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable role="button" aria-label={label} onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** One shopping list: three lists (to get, checked, removed) and the quick add. */
export function ShoppingList({ familyId, taskId }: { familyId: string; taskId: string }) {
  const t = useT();
  const router = useRouter();
  const [data, setData] = useState<Loaded | undefined>();
  const [problem, setProblem] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [text, setText] = useState('');
  const field = useRef<{ focus?: () => void }>(null);

  const fetchItems = useCallback(
    async (gone?: string) => {
      const outcome = await listItems(familyId, taskId);
      if (outcome.status === 'unauthorized') router.replace('/login');
      else if (outcome.status === 'notFound') setProblem('list.notFound');
      else if (outcome.status !== 'ok') setProblem('list.failed');
      else {
        const fresh = outcome.value;
        setData((d) =>
          d
            ? {
                ...d,
                items: mergeItems(
                  d.items.filter((i) => i.id !== gone),
                  fresh,
                ),
              }
            : d,
        );
      }
    },
    [familyId, taskId, router],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [mine, who, people, tasks, items] = await Promise.all([
        families(),
        me(),
        members(familyId),
        familyTasks(familyId),
        listItems(familyId, taskId),
      ]);
      if (!alive) return;
      if ([mine, people, tasks, items].some((o) => o.status === 'unauthorized') || !who) {
        router.replace('/login');
        return;
      }
      const task = tasks.status === 'ok' ? tasks.value.find((x) => x.id === taskId) : undefined;
      const family = mine.status === 'ok' ? mine.value.find((f) => f.id === familyId) : undefined;
      if (!task || !family || people.status !== 'ok' || items.status !== 'ok') {
        const gone = [people, tasks, items].some((o) => o.status === 'notFound') || !task;
        setProblem(gone ? 'list.notFound' : 'list.failed');
        return;
      }
      setData({
        task,
        people: people.value,
        role: family.role,
        me: who.personId,
        items: items.value,
      });
    })();
    return () => {
      alive = false;
    };
  }, [familyId, taskId, router]);

  /** Runs a write and applies its answer; a list out of date is reloaded with an alert. */
  async function write<T>(
    send: () => Promise<ItemOutcome<T>>,
    apply: (value: T) => Item[] | ((l: Item[]) => Item[]),
    target?: string,
  ) {
    setNotice(undefined);
    const outcome = await send();
    switch (outcome.status) {
      case 'ok': {
        const next = apply(outcome.value);
        setData((d) =>
          d ? { ...d, items: typeof next === 'function' ? next(d.items) : next } : d,
        );
        break;
      }
      case 'unauthorized':
        router.replace('/login');
        break;
      case 'stale':
      case 'notFound':
        setNotice('list.stale');
        await fetchItems(outcome.status === 'notFound' ? target : undefined);
        break;
      case 'closed':
        setNotice('list.closed');
        await fetchItems();
        break;
      case 'forbidden':
        setNotice('list.forbidden');
        break;
      default:
        setNotice('list.failed');
    }
  }

  const replace = (item: Item) => (items: Item[]) =>
    item.deletedAt
      ? items.filter((i) => i.id !== item.id)
      : items.some((i) => i.id === item.id)
        ? items.map((i) => (i.id === item.id ? item : i))
        : [...items, item];

  function submit() {
    const clean = text.trim();
    if (!clean) return;
    setText('');
    field.current?.focus?.();
    const ids = newIds();
    void write(
      () => addItem(familyId, taskId, { id: ids.id, mutationId: ids.mutationId, text: clean }),
      replace,
    );
  }

  if (problem) {
    return (
      <View style={styles.container}>
        <Text role="alert">{t(problem)}</Text>
      </View>
    );
  }
  if (!data) return null;

  const { task, people, role } = data;
  const groups = groupItems(data.items);
  const nameOf = (id: string) =>
    people.find((p) => p.personId === id)?.displayName ?? t('list.someone');
  const removeButton = (item: Item) => (
    <Action
      label={t('list.remove', { item: item.text })}
      onPress={() =>
        void write(() => removeItem(familyId, taskId, item.id, mutation()), replace, item.id)
      }
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text role="heading" aria-level={1} style={styles.title}>
        {task.title}
      </Text>
      {notice ? (
        <Text role="alert" style={styles.alert}>
          {t(notice)}
        </Text>
      ) : null}
      {[
        ['list.toGet', groups.toGet],
        ['list.checked', groups.checked],
      ].map(([key, rows]) =>
        rows.length > 0 || key === 'list.toGet' ? (
          <View key={key as string} role="list" aria-label={t(key as string)} style={styles.list}>
            {rows.length === 0 ? <Text>{t('list.empty')}</Text> : null}
            {(rows as Item[]).map((item) => {
              const by = whoAdded(item, task, people);
              return (
                <View key={item.id} role="listitem" style={styles.row}>
                  <Pressable
                    role="checkbox"
                    aria-label={item.text}
                    aria-checked={item.checked}
                    onPress={() =>
                      void write(
                        () =>
                          checkItem(familyId, taskId, item.id, {
                            ...mutation(),
                            checked: !item.checked,
                          }),
                        replace,
                        item.id,
                      )
                    }
                  >
                    <Text>{`${item.checked ? '[x]' : '[ ]'} ${item.text}`}</Text>
                  </Pressable>
                  {by !== undefined ? (
                    <Text>{t('list.addedBy', { name: by ?? t('list.someone') })}</Text>
                  ) : null}
                  {removeButton(item)}
                </View>
              );
            })}
          </View>
        ) : null,
      )}
      {groups.removed.length > 0 ? (
        <View role="list" aria-label={t('list.removed')} style={styles.list}>
          {groups.removed.map((item) => (
            <View key={item.id} role="listitem" style={styles.row}>
              <Text style={styles.struck}>{item.text}</Text>
              <Text>{t('list.removedBy', { name: nameOf(item.removedBy as string) })}</Text>
              <Action
                label={t('list.restore', { item: item.text })}
                onPress={() =>
                  void write(
                    () => restoreItem(familyId, taskId, item.id, mutation()),
                    replace,
                    item.id,
                  )
                }
              />
              {canRemoveStruck(task, data.me, role) ? removeButton(item) : null}
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        ref={field as never}
        aria-label={t('list.newItem')}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        submitBehavior="submit"
        // react-native-web ignores submitBehavior and blurs a single-line field on Enter.
        blurOnSubmit={false}
        style={styles.input}
      />
      {canClearChecked(task, data.me, role) ? (
        <Action
          label={t('list.clear')}
          onPress={() =>
            void write(
              () => clearChecked(familyId, taskId, mutation()),
              (items) => items,
            )
          }
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  alert: { color: '#b00020' },
  list: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  struck: { textDecorationLine: 'line-through' },
  input: { width: 280, borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 10 },
  button: {
    backgroundColor: '#1f5fbf',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
