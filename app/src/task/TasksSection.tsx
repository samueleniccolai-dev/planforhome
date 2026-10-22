import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  assignTask,
  cancelTask,
  completeTask,
  createTask,
  endSeries,
  forwardTask,
  nudgeTask,
  reopenTask,
  takeTask,
  type Family,
  type FamilyMember,
  type Task,
  type WriteOutcome,
} from '@/api/client';
import { useT } from '@/i18n';

import { attemptFor, mergeTask, newIds, type Attempt } from './logic';
import { ForwardDialog } from './ForwardDialog';
import { NewTaskForm, type NewTaskInput } from './NewTaskForm';
import { TaskSummary } from './TaskSummary';
import type { OfflineTasks } from './useOfflineTasks';

type Props = {
  familyId: string;
  timeZone: string;
  /** The caller manages this family: only then the nudge button shows (the server decides). */
  manager: boolean;
  people: FamilyMember[];
  /** Every family of the person: the forward needs at least two. */
  families: Family[];
  /** Undefined while loading. */
  tasks: Task[] | undefined;
  loadFailed: boolean;
  onTasks: (update: (list: Task[]) => Task[]) => void;
  /** A write answered 404: the screen reloads once and decides. */
  onStale: () => Promise<void>;
  /** Reloads the tasks of the family and merges them: the higher version wins. */
  onReload: () => Promise<void>;
  onUnauthorized: () => void;
  /** Android: take, done, assign, forward and create go through the queue. */
  offline?: OfflineTasks;
};

type Notice = { key: string; params?: Record<string, string> };

function Action({
  label,
  onPress,
  disabled,
  innerRef,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  innerRef?: (el: { focus?: () => void } | null) => void;
}) {
  return (
    <Pressable
      ref={innerRef as never}
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
  timeZone,
  manager,
  people,
  families,
  tasks,
  loadFailed,
  onTasks,
  onStale,
  onReload,
  onUnauthorized,
  offline,
}: Props) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | undefined>();
  const [open, setOpen] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<
    { id: string; kind: 'cancel' | 'end' } | undefined
  >();
  const [forwarding, setForwarding] = useState<string | undefined>();
  const triggers = useRef<Record<string, { focus?: () => void } | null>>({});
  const inFlight = useRef(false);
  const creation = useRef<Attempt | undefined>(undefined);
  const mutation = useRef<Attempt | undefined>(undefined);
  const currentTaskId = useRef<string | undefined>(undefined);

  /** One write at a time; returns true when the server accepted it (200 or 201). */
  async function run(
    send: () => Promise<WriteOutcome>,
    afterwards?: () => Promise<void>,
    forbiddenKey = 'task.forbidden',
  ): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setNotice(undefined);
    try {
      const outcome = await send();
      switch (outcome.status) {
        case 'ok':
          onTasks((list) => mergeTask(list, outcome.value));
          await afterwards?.();
          return true;
        case 'unauthorized':
          onUnauthorized();
          break;
        case 'forbidden':
          setNotice({ key: forbiddenKey });
          break;
        case 'notFound':
          await onStale();
          break;
        case 'tooSoon':
          setNotice({ key: 'task.nudgeTooSoon' });
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
  async function add(input: NewTaskInput): Promise<boolean> {
    if (offline) return offline.create(input);
    if (inFlight.current) return false;
    const key = `create:${input.title}|${input.dueKind}|${input.due}|${JSON.stringify(input.recurrence)}`;
    const attempt = attemptFor(creation.current, key);
    creation.current = attempt;
    const ok = await run(() =>
      createTask(familyId, { id: attempt.ids.id, mutationId: attempt.ids.mutationId, ...input }),
    );
    if (ok) creation.current = undefined;
    return ok;
  }

  async function assign(task: Task, assignee: string | null) {
    if (offline) return void ((await offline.assign(task.id, assignee)) && setOpen(undefined));
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
    if (offline) return void (await offline.take(task.id));
    const attempt = attemptFor(mutation.current, `take:${task.id}`);
    mutation.current = attempt;
    currentTaskId.current = task.id;
    const ok = await run(() => takeTask(familyId, task.id, { mutationId: attempt.ids.mutationId }));
    if (ok) mutation.current = undefined;
  }

  async function forward(task: Task, target: Family) {
    if (offline) {
      await offline.forward(task.id, target.id);
      return setForwarding(undefined);
    }
    const attempt = attemptFor(mutation.current, `forward:${task.id}:${target.id}`);
    mutation.current = attempt;
    currentTaskId.current = task.id;
    const ok = await run(
      () =>
        forwardTask(familyId, task.id, {
          mutationId: attempt.ids.mutationId,
          toFamilyId: target.id,
        }),
      async () => {
        onTasks((list) => list.filter((x) => x.id !== task.id));
        setNotice({ key: 'task.forward.done', params: { family: target.name } });
      },
      'task.forward.forbidden',
    );
    if (ok) mutation.current = undefined;
    setForwarding(undefined);
  }

  /** Every tap is a new mutation: the server answers 429 if it was too soon. */
  async function nudge(task: Task) {
    currentTaskId.current = task.id;
    await run(() => nudgeTask(familyId, task.id, { mutationId: newIds().mutationId }));
  }

  function cancelForward(task: Task) {
    setForwarding(undefined);
    triggers.current[task.id]?.focus?.();
  }

  /** The direct actions wait for the network and for the queue of the task. */
  const locked = (task: Task) => busy || offline?.blocked(task.id) === true;

  /** Done, reopen and cancel: same retry rule as the other writes, one request at a time. */
  async function change(
    task: Task,
    action: 'done' | 'reopen' | 'cancel' | 'endSeries',
    send: typeof completeTask,
  ) {
    if (offline && action === 'done') return void (await offline.complete(task.id));
    const attempt = attemptFor(mutation.current, `${action}:${task.id}`);
    mutation.current = attempt;
    currentTaskId.current = task.id;
    // The answer holds the task only: the next occurrence (or the others cancelled) comes by reload.
    const reload = task.recurrence && action !== 'reopen' ? onReload : undefined;
    const ok = await run(
      () => send(familyId, task.id, { mutationId: attempt.ids.mutationId }),
      reload,
    );
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
      {notice ? (
        <Text role="alert" style={styles.alert}>
          {t(notice.key, notice.params)}
        </Text>
      ) : null}
      {offline?.notice ? (
        <View style={styles.row}>
          <Text role="status" aria-live="polite" accessibilityLiveRegion="polite">
            {t(offline.notice.key, offline.notice.params)}
          </Text>
          <Action label={t('task.noticeClose')} onPress={offline.dismiss} />
        </View>
      ) : null}
      {loadFailed ? <Text>{t('task.loadError')}</Text> : null}
      {tasks && tasks.length === 0 ? <Text>{t('task.none')}</Text> : null}
      {tasks && tasks.length > 0 ? (
        <View role="list" aria-label={t('task.list')} style={styles.list}>
          {tasks.map((task) => (
            <View key={task.id} role="listitem" style={styles.item}>
              <TaskSummary task={task} people={people} />
              {task.template === 'SHOPPING_LIST' ? (
                <Link href={`/list?family=${familyId}&task=${task.id}`}>
                  {t('list.open', { title: task.title })}
                </Link>
              ) : null}
              {task.status === 'OPEN' ? (
                <View style={styles.row}>
                  {task.assigneePersonId === null ? (
                    <Action label={t('task.take')} onPress={() => take(task)} />
                  ) : null}
                  <Action
                    label={t('task.assign')}
                    onPress={() => setOpen(open === task.id ? undefined : task.id)}
                  />
                  {families.length >= 2 ? (
                    <Action
                      label={t('task.forward.action', { title: task.title })}
                      innerRef={(el) => (triggers.current[task.id] = el)}
                      onPress={() => setForwarding(task.id)}
                    />
                  ) : null}
                  {manager && task.assigneePersonId !== null ? (
                    <Action
                      label={t('task.nudge', { title: task.title })}
                      disabled={busy}
                      onPress={() => nudge(task)}
                    />
                  ) : null}
                  <Action
                    label={t('task.markDone')}
                    disabled={busy}
                    onPress={() => change(task, 'done', completeTask)}
                  />
                  {confirming?.id === task.id && confirming.kind === 'cancel' ? (
                    <>
                      <Action
                        label={t('task.confirmCancel')}
                        disabled={locked(task)}
                        onPress={() => change(task, 'cancel', cancelTask)}
                      />
                      <Action label={t('task.keep')} onPress={() => setConfirming(undefined)} />
                    </>
                  ) : (
                    <Action
                      label={t(task.recurrence ? 'task.cancelOnce' : 'task.cancel')}
                      disabled={locked(task)}
                      onPress={() => setConfirming({ id: task.id, kind: 'cancel' })}
                    />
                  )}
                  {task.recurrence && confirming?.id === task.id && confirming.kind === 'end' ? (
                    <>
                      <Action
                        label={t('task.confirmEndSeries')}
                        disabled={locked(task)}
                        onPress={() => change(task, 'endSeries', endSeries)}
                      />
                      <Action
                        label={t('task.keepSeries')}
                        onPress={() => setConfirming(undefined)}
                      />
                    </>
                  ) : task.recurrence ? (
                    <Action
                      label={t('task.endSeries')}
                      disabled={locked(task)}
                      onPress={() => setConfirming({ id: task.id, kind: 'end' })}
                    />
                  ) : null}
                </View>
              ) : null}
              {task.status === 'DONE' ? (
                <View style={styles.row}>
                  <Text>{t('task.done')}</Text>
                  <Action
                    label={t('task.reopen')}
                    disabled={locked(task)}
                    onPress={() => change(task, 'reopen', reopenTask)}
                  />
                </View>
              ) : null}
              {task.status === 'CANCELLED' ? <Text>{t('task.cancelled')}</Text> : null}
              {forwarding === task.id && task.status === 'OPEN' ? (
                <ForwardDialog
                  task={task}
                  assigneeName={
                    people.find((p) => p.personId === task.assigneePersonId)?.displayName
                  }
                  targets={families.filter((f) => f.id !== familyId)}
                  busy={busy}
                  loadMembers={offline?.loadMembers}
                  onConfirm={(target) => forward(task, target)}
                  onCancel={() => cancelForward(task)}
                />
              ) : null}
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
      <NewTaskForm
        timeZone={timeZone}
        busy={busy}
        onSubmit={add}
        onProblem={(key) => setNotice({ key })}
      />
      <Link href="/tasks">{t('task.all')}</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, alignItems: 'center' },
  subtitle: { fontSize: 20, fontWeight: '600' },
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
