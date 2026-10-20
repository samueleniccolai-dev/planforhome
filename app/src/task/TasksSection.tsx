import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  assignTask,
  cancelTask,
  completeTask,
  createTask,
  reopenTask,
  takeTask,
  type FamilyMember,
  type Task,
  type WriteOutcome,
} from '@/api/client';
import { useT } from '@/i18n';

import { attemptFor, mergeTask, type Attempt } from './logic';
import { TaskSummary } from './TaskSummary';

type Props = {
  familyId: string;
  people: FamilyMember[];
  /** Undefined while loading. */
  tasks: Task[] | undefined;
  loadFailed: boolean;
  onTasks: (update: (list: Task[]) => Task[]) => void;
  /** A write answered 404: the screen reloads once and decides. */
  onStale: () => Promise<void>;
  onUnauthorized: () => void;
};

type Notice = { key: string; params?: Record<string, string> };

function Action({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      disabled={disabled}
      onPress={onPress}
      style={styles.button}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/** The "Tasks" section of a family: list, creation with the title only, assign, take. */
export function TasksSection({
  familyId,
  people,
  tasks,
  loadFailed,
  onTasks,
  onStale,
  onUnauthorized,
}: Props) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | undefined>();
  const [open, setOpen] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<string | undefined>();
  const inFlight = useRef(false);
  const creation = useRef<Attempt | undefined>(undefined);
  const mutation = useRef<Attempt | undefined>(undefined);
  const currentTaskId = useRef<string | undefined>(undefined);

  /** One write at a time; returns true when the server accepted it (200 or 201). */
  async function run(send: () => Promise<WriteOutcome>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      const outcome = await send();
      switch (outcome.status) {
        case 'ok':
          onTasks((list) => mergeTask(list, outcome.value));
          return true;
        case 'unauthorized':
          onUnauthorized();
          break;
        case 'forbidden':
          setNotice({ key: 'task.forbidden' });
          break;
        case 'notFound':
          await onStale();
          break;
        case 'changed':
          setNotice({ key: 'task.changed' });
          await onStale();
          break;
        case 'alreadyTaken': {
          const who = outcome.assigneePersonId;
          const name =
            people.find((p) => p.personId === who)?.displayName ?? outcome.assigneeName ?? '?';
          if (who) {
            onTasks((list) =>
              list.map((task) =>
                task.id === currentTaskId.current ? { ...task, assigneePersonId: who } : task,
              ),
            );
          }
          setNotice({ key: 'task.taken', params: { name } });
          break;
        }
        default:
          setNotice({ key: 'task.failed' });
      }
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function add() {
    const clean = title.trim();
    if (!clean || inFlight.current) return;
    const attempt = attemptFor(creation.current, `create:${clean}`);
    creation.current = attempt;
    const ok = await run(() =>
      createTask(familyId, {
        id: attempt.ids.id,
        mutationId: attempt.ids.mutationId,
        title: clean,
      }),
    );
    if (ok) {
      creation.current = undefined;
      setTitle('');
    }
  }

  async function assign(task: Task, assignee: string | null) {
    const attempt = attemptFor(mutation.current, `assign:${task.id}:${assignee}`);
    mutation.current = attempt;
    currentTaskId.current = task.id;
    const ok = await run(() =>
      assignTask(familyId, task.id, {
        mutationId: attempt.ids.mutationId,
        assigneePersonId: assignee,
      }),
    );
    if (ok) {
      mutation.current = undefined;
      setOpen(undefined);
    }
  }

  async function take(task: Task) {
    const attempt = attemptFor(mutation.current, `take:${task.id}`);
    mutation.current = attempt;
    currentTaskId.current = task.id;
    const ok = await run(() => takeTask(familyId, task.id, { mutationId: attempt.ids.mutationId }));
    if (ok) mutation.current = undefined;
  }

  /** Done, reopen and cancel: same retry rule as the other writes, one request at a time. */
  async function change(
    task: Task,
    action: 'done' | 'reopen' | 'cancel',
    send: typeof completeTask,
  ) {
    const attempt = attemptFor(mutation.current, `${action}:${task.id}`);
    mutation.current = attempt;
    currentTaskId.current = task.id;
    const ok = await run(() => send(familyId, task.id, { mutationId: attempt.ids.mutationId }));
    if (ok) {
      mutation.current = undefined;
      setConfirming(undefined);
      setOpen(undefined);
    }
  }

  return (
    <View style={styles.section}>
      <Text role="heading" aria-level={2} style={styles.subtitle}>
        {t('task.tasks')}
      </Text>
      <TextInput
        aria-label={t('task.newTitle')}
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />
      <Action label={t('task.add')} onPress={add} disabled={busy || title.trim() === ''} />
      {notice ? (
        <Text role="alert" style={styles.alert}>
          {t(notice.key, notice.params)}
        </Text>
      ) : null}
      {loadFailed ? <Text>{t('task.loadError')}</Text> : null}
      {tasks && tasks.length === 0 ? <Text>{t('task.none')}</Text> : null}
      {tasks && tasks.length > 0 ? (
        <View role="list" aria-label={t('task.list')} style={styles.list}>
          {tasks.map((task) => (
            <View key={task.id} role="listitem" style={styles.item}>
              <TaskSummary task={task} people={people} />
              {task.status === 'OPEN' ? (
                <View style={styles.row}>
                  {task.assigneePersonId === null ? (
                    <Action label={t('task.take')} onPress={() => take(task)} />
                  ) : null}
                  <Action
                    label={t('task.assign')}
                    onPress={() => setOpen(open === task.id ? undefined : task.id)}
                  />
                  <Action
                    label={t('task.markDone')}
                    disabled={busy}
                    onPress={() => change(task, 'done', completeTask)}
                  />
                  {confirming === task.id ? (
                    <>
                      <Action
                        label={t('task.confirmCancel')}
                        disabled={busy}
                        onPress={() => change(task, 'cancel', cancelTask)}
                      />
                      <Action label={t('task.keep')} onPress={() => setConfirming(undefined)} />
                    </>
                  ) : (
                    <Action label={t('task.cancel')} onPress={() => setConfirming(task.id)} />
                  )}
                </View>
              ) : null}
              {task.status === 'DONE' ? (
                <View style={styles.row}>
                  <Text>{t('task.done')}</Text>
                  <Action
                    label={t('task.reopen')}
                    disabled={busy}
                    onPress={() => change(task, 'reopen', reopenTask)}
                  />
                </View>
              ) : null}
              {task.status === 'CANCELLED' ? <Text>{t('task.cancelled')}</Text> : null}
              {open === task.id && task.status === 'OPEN' ? (
                <View style={styles.row}>
                  {people.map((p) => (
                    <Action
                      key={p.personId}
                      label={t('task.assignTo', { name: p.displayName })}
                      onPress={() => assign(task, p.personId)}
                    />
                  ))}
                  <Action label={t('task.requeue')} onPress={() => assign(task, null)} />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <Link href="/tasks">{t('task.all')}</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, alignItems: 'center' },
  subtitle: { fontSize: 20, fontWeight: '600' },
  input: { width: 280, borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 10 },
  alert: { color: '#b00020' },
  list: { gap: 10 },
  item: { gap: 4, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  button: {
    backgroundColor: '#1f5fbf',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
