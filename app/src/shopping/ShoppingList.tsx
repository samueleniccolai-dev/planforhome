import { useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  reorderItems,
  restoreItem,
  type FamilyMember,
  type Item,
  type ItemOutcome,
  type Task,
} from '@/api/client';
import { useT } from '@/i18n';
import { newIds } from '@/task/logic';

import { useOfflineList } from './useOfflineList';

import {
  applyOrderAnswer,
  canClearChecked,
  canRemoveStruck,
  groupItems,
  mergeItems,
  moveItem,
  orderOf,
  whoAdded,
} from './logic';

type Loaded = {
  task: Task;
  people: FamilyMember[];
  role: 'MANAGER' | 'MEMBER';
  me: string;
  items: Item[];
};

const mutation = () => ({ mutationId: newIds().mutationId });

type Focusable = { focus?: () => void };

function Action({
  label,
  onPress,
  disabled,
  nodeRef,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  nodeRef?: (node: Focusable | null) => void;
}) {
  return (
    <Pressable
      ref={nodeRef as never}
      role="button"
      aria-label={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled ? styles.disabled : null]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** One shopping list: three lists (to get, checked, removed) and the quick add. */
export function ShoppingList({ familyId, taskId }: { familyId: string; taskId: string }) {
  const t = useT();
  const router = useRouter();
  const offline = useOfflineList(familyId, taskId);
  const [data, setData] = useState<Loaded | undefined>();
  const [problem, setProblem] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [text, setText] = useState('');
  const field = useRef<Focusable>(null);
  const items = useRef<Item[]>([]);
  const flying = useRef(false);
  const before = useRef<Item[]>([]);
  const view = offline.active ? offline.view : data;
  const shownProblem = problem ?? (offline.active ? offline.problem : undefined);
  const shownNotice = notice ?? (offline.active ? offline.notice : undefined);
  const [focusAt, setFocusAt] = useState({ key: '', n: 0 });
  const moveButtons = useRef<Record<string, Focusable | null>>({});

  // A tap on «Sposta» asks for the focus once (the browser drops it when React moves the nodes).
  useEffect(() => {
    if (focusAt.n > 0) moveButtons.current[focusAt.key]?.focus?.();
  }, [focusAt]);

  const fetchItems = useCallback(
    async (gone?: string) => {
      if (offline.active) return offline.after();
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
    [familyId, taskId, router, offline],
  );

  useEffect(() => {
    if (offline.active) return;
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
  }, [familyId, taskId, router, offline.active]);

  /** Runs a write and applies its answer; a list out of date is reloaded with an alert. */
  async function write<T>(
    send: () => Promise<ItemOutcome<T>>,
    apply: (value: T) => Item[] | ((l: Item[]) => Item[]),
    target?: string,
  ): Promise<ItemOutcome<T>['status']> {
    setNotice(undefined);
    const outcome = await send();
    switch (outcome.status) {
      case 'ok': {
        if (offline.active) {
          void offline.after();
          break;
        }
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
    return outcome.status;
  }

  /** Sends the local order; at most one in flight, the taps meanwhile only change the screen. */
  async function sendOrder() {
    flying.current = true;
    const sent = orderOf(items.current);
    const status = await write(
      () => reorderItems(familyId, taskId, { ...mutation(), itemIds: sent }),
      (answer) => (local) => applyOrderAnswer(local, answer, sent),
    );
    flying.current = false;
    if (status === 'ok') {
      if (orderOf(items.current).join() !== sent.join()) {
        // The server accepted `sent`: a failure of the next send must not go back past it.
        // (the local list is already ahead of it: rebuild it from the order sent).
        before.current = items.current
          .filter((i) => sent.includes(i.id))
          .map((i) => ({ ...i, position: sent.indexOf(i.id) }));
        await sendOrder();
      }
    } else if (status === 'error' || status === 'forbidden') {
      const back = before.current;
      setData((d) =>
        d
          ? {
              ...d,
              items: d.items.map((i) => {
                const old = back.find((b) => b.id === i.id);
                return old ? { ...i, position: old.position } : i;
              }),
            }
          : d,
      );
    }
  }

  function move(id: string, direction: 'up' | 'down') {
    const next = moveItem(items.current, id, direction);
    if (!next) return;
    if (!flying.current) before.current = items.current;
    const moved = [...next, ...items.current.filter((i) => i.deletedAt)];
    // The focus stays on the button just pressed, or goes to the other one when it is now disabled.
    const toGet = groupItems(moved).toGet;
    const at = toGet.findIndex((i) => i.id === id);
    const blocked = direction === 'up' ? at === 0 : at === toGet.length - 1;
    const target = blocked ? (direction === 'up' ? 'down' : 'up') : direction;
    setFocusAt((f) => ({ key: `${id}:${target}`, n: f.n + 1 }));
    items.current = moved;
    setNotice(undefined);
    setData((d) => (d ? { ...d, items: moved } : d));
    if (!flying.current) void sendOrder();
  }

  useLayoutEffect(() => {
    if (view) items.current = view.items;
  }, [view]);

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
    if (offline.active) {
      void offline.add(clean);
      return;
    }
    const ids = newIds();
    void write(
      () => addItem(familyId, taskId, { id: ids.id, mutationId: ids.mutationId, text: clean }),
      replace,
    );
  }

  if (shownProblem) {
    return (
      <View style={styles.container}>
        <Text role="alert">{t(shownProblem)}</Text>
      </View>
    );
  }
  if (!view) return null;

  const { task, people, role } = view;
  const groups = groupItems(view.items);
  const nameOf = (id: string) =>
    people.find((p) => p.personId === id)?.displayName ?? t('list.someone');
  const removeButton = (item: Item) => (
    <Action
      label={t('list.remove', { item: item.text })}
      disabled={offline.blocked}
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
      {offline.blocked ? <Text role="status">{t('list.waiting')}</Text> : null}
      {shownNotice ? (
        <Text role="alert" style={styles.alert}>
          {t(shownNotice)}
        </Text>
      ) : null}
      {[
        ['list.toGet', groups.toGet],
        ['list.checked', groups.checked],
        // eslint-disable-next-line react-hooks/refs -- handlers read refs only when pressed
      ].map(([key, rows]) =>
        rows.length > 0 || key === 'list.toGet' ? (
          <View key={key as string} role="list" aria-label={t(key as string)} style={styles.list}>
            {rows.length === 0 ? <Text>{t('list.empty')}</Text> : null}
            {(rows as Item[]).map((item, index) => {
              const by = whoAdded(item, task, people);
              return (
                <View key={item.id} role="listitem" style={styles.row}>
                  <Pressable
                    role="checkbox"
                    aria-label={item.text}
                    aria-checked={item.checked}
                    onPress={() =>
                      offline.active
                        ? void offline.toggle(item)
                        : void write(
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
                  {key === 'list.toGet'
                    ? (['up', 'down'] as const).map((direction) => (
                        <Action
                          key={direction}
                          label={t(direction === 'up' ? 'list.moveUp' : 'list.moveDown', {
                            item: item.text,
                          })}
                          disabled={
                            offline.blocked ||
                            (direction === 'up' ? index === 0 : index === rows.length - 1)
                          }
                          nodeRef={(node) => {
                            moveButtons.current[`${item.id}:${direction}`] = node;
                          }}
                          onPress={() => move(item.id, direction)}
                        />
                      ))
                    : null}
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
                disabled={offline.blocked}
                onPress={() =>
                  void write(
                    () => restoreItem(familyId, taskId, item.id, mutation()),
                    replace,
                    item.id,
                  )
                }
              />
              {canRemoveStruck(task, view.me, role) ? removeButton(item) : null}
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
      {canClearChecked(task, view.me, role) ? (
        <Action
          label={t('list.clear')}
          disabled={offline.blocked}
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
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
