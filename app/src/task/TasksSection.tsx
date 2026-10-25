import { Link } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { View, type TextInput } from 'react-native';

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
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { InlineNotice, type NoticeTone } from '@/ui/InlineNotice';
import { TaskCard } from '@/ui/TaskCard';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

import { ForwardDialog } from './ForwardDialog';
import { keepAttempt, attemptFor, mergeTask, newIds, type Attempt, type Ids } from './logic';
import { NewTaskForm, type NewTaskInput } from './NewTaskForm';
import { TaskSectionList } from './TaskSectionList';
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

/** The one notice of the section; it may carry the «Undo» of the write it tells about. */
type Last = {
  tone: NoticeTone;
  key: string;
  params?: Record<string, string>;
  undo?: { kind: 'done' | 'take'; task: Task };
};

type RunSpec = {
  /** Same key and a network error before: the retry reuses the identifiers. */
  key: string;
  taskId?: string;
  send: (ids: Ids) => Promise<WriteOutcome>;
  afterwards?: () => Promise<void>;
  forbiddenKey?: string;
  /** The «Undo» that stays on the notice if this write (an undo) fails on the network. */
  undo?: Last['undo'];
};

/** The "Tasks" section of a family: list by section, creation, quick and secondary actions. */
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
  const { space } = useTheme();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Last | undefined>();
  const [open, setOpen] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<
    { id: string; kind: 'cancel' | 'end' } | undefined
  >();
  const [forwarding, setForwarding] = useState<string | undefined>();
  const triggers = useRef<Record<string, unknown>>({});
  const titleField = useRef<ComponentRef<typeof TextInput>>(null);
  const inFlight = useRef(false);
  const attempt = useRef<Attempt | undefined>(undefined);

  /** The one lock of the section: a write waits for the one before, whatever its task. */
  async function exclusive<T>(body: () => Promise<T>): Promise<T | undefined> {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setBusy(true);
    setLast(undefined);
    try {
      return await body();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  /** One write at a time; returns the task the server answered when it accepted the write. */
  async function run(spec: RunSpec): Promise<Task | undefined> {
    return exclusive(async () => {
      attempt.current = attemptFor(attempt.current, spec.key);
      const outcome = await spec.send(attempt.current.ids);
      attempt.current = keepAttempt(attempt.current, outcome.status);
      switch (outcome.status) {
        case 'ok':
          onTasks((list) => mergeTask(list, outcome.value));
          if (offline) await offline.refresh();
          await spec.afterwards?.();
          return outcome.value;
        case 'unauthorized':
          onUnauthorized();
          break;
        case 'forbidden':
          setLast({ tone: 'danger', key: spec.forbiddenKey ?? 'task.forbidden' });
          break;
        case 'notFound':
          await onStale();
          break;
        case 'tooSoon':
          setLast({ tone: 'notice', key: 'task.nudgeTooSoon' });
          break;
        case 'changed':
          setLast({ tone: 'notice', key: 'task.changed' });
          await onStale();
          break;
        case 'alreadyTaken': {
          const who = outcome.assigneePersonId;
          const name =
            people.find((p) => p.personId === who)?.displayName ?? outcome.assigneeName ?? '?';
          if (who) {
            onTasks((list) =>
              list.map((task) =>
                task.id === spec.taskId ? { ...task, assigneePersonId: who } : task,
              ),
            );
          }
          setLast({ tone: 'notice', key: 'task.taken', params: { name } });
          await onReload();
          break;
        }
        default:
          setLast({ tone: 'danger', key: 'task.failed', undo: spec.undo });
      }
      return undefined;
    });
  }

  async function add(input: NewTaskInput): Promise<boolean> {
    if (offline) return offline.create(input);
    const key = `create:${input.title}|${input.dueKind}|${input.due}|${JSON.stringify(input.recurrence)}`;
    const saved = await run({
      key,
      send: (ids) => createTask(familyId, { id: ids.id, mutationId: ids.mutationId, ...input }),
    });
    return saved !== undefined;
  }

  async function assign(task: Task, assignee: string | null, undo?: Last['undo']) {
    if (offline) {
      const queued = await exclusive(() => offline.assign(task.id, assignee));
      if (queued) setOpen(undefined);
      return;
    }
    const saved = await run({
      key: `assign:${task.id}:${assignee}`,
      taskId: task.id,
      send: (ids) =>
        assignTask(familyId, task.id, {
          mutationId: ids.mutationId,
          assigneePersonId: assignee,
        }),
      undo,
    });
    if (saved) setOpen(undefined);
  }

  async function take(task: Task) {
    if (offline) {
      const queued = await exclusive(() => offline.take(task.id));
      if (queued) {
        setLast({
          tone: 'success',
          key: 'task.card.takenNotice',
          params: { title: task.title },
          undo: { kind: 'take', task },
        });
      }
      return;
    }
    const saved = await run({
      key: `take:${task.id}`,
      taskId: task.id,
      send: (ids) => takeTask(familyId, task.id, { mutationId: ids.mutationId }),
    });
    if (saved) {
      setLast({
        tone: 'success',
        key: 'task.card.takenNotice',
        params: { title: task.title },
        undo: { kind: 'take', task: saved },
      });
    }
  }

  async function forward(task: Task, target: Family) {
    if (offline) {
      await exclusive(() => offline.forward(task.id, target.id));
      return setForwarding(undefined);
    }
    await run({
      key: `forward:${task.id}:${target.id}`,
      taskId: task.id,
      send: (ids) =>
        forwardTask(familyId, task.id, { mutationId: ids.mutationId, toFamilyId: target.id }),
      afterwards: async () => {
        onTasks((list) => list.filter((x) => x.id !== task.id));
        setLast({ tone: 'success', key: 'task.forward.done', params: { family: target.name } });
      },
      forbiddenKey: 'task.forward.forbidden',
    });
    setForwarding(undefined);
  }

  /** Every tap is a new mutation: the server answers 429 if it was too soon. */
  async function nudge(task: Task) {
    await run({
      key: `nudge:${task.id}:${newIds().mutationId}`,
      taskId: task.id,
      send: (ids) => nudgeTask(familyId, task.id, { mutationId: ids.mutationId }),
    });
  }

  function cancelForward(task: Task) {
    setForwarding(undefined);
    (triggers.current[task.id] as { focus?: () => void } | null)?.focus?.();
  }

  /** The direct actions wait for the network and for the queue of the task. */
  const locked = (task: Task) => busy || offline?.blocked(task.id) === true;

  /** Done, reopen, cancel and end of the series: the saved task, or undefined if it failed. */
  async function change(
    task: Task,
    action: 'done' | 'reopen' | 'cancel' | 'endSeries',
    send: typeof completeTask,
    undo?: Last['undo'],
  ): Promise<Task | undefined> {
    if (offline && action === 'done') {
      const queued = await exclusive(() => offline.complete(task.id));
      if (queued) {
        setLast({
          tone: 'success',
          key: 'task.card.doneNotice',
          params: { title: task.title },
          undo: { kind: 'done', task },
        });
      }
      return queued ? task : undefined;
    }
    // The answer holds the task only: the next occurrence (or the others cancelled) comes by reload.
    const reload = task.recurrence && action !== 'reopen' ? onReload : undefined;
    const saved = await run({
      key: `${action}:${task.id}`,
      taskId: task.id,
      send: (ids) => send(familyId, task.id, { mutationId: ids.mutationId }),
      afterwards: reload,
      undo,
    });
    if (saved) {
      setConfirming(undefined);
      setOpen(undefined);
    }
    return saved;
  }

  async function done(task: Task) {
    const saved = await change(task, 'done', completeTask);
    if (saved) {
      setLast({
        tone: 'success',
        key: 'task.card.doneNotice',
        params: { title: task.title },
        undo: { kind: 'done', task: saved },
      });
    }
  }

  async function undo() {
    const target = last?.undo;
    if (!target) return;
    if (target.kind === 'take') {
      if (offline) return void (await exclusive(() => offline.assign(target.task.id, null)));
      return assign(target.task, null, target);
    }
    // Android has no «reopen» in the queue: the undo of «done» goes to the network.
    await change(target.task, 'reopen', reopenTask, target);
  }

  const undoBlocked = last?.undo ? locked(last.undo.task) : false;

  function actionsOf(task: Task) {
    const asking = confirming?.id === task.id ? confirming.kind : undefined;
    return (
      <>
        {task.template === 'SHOPPING_LIST' ? (
          <Link href={`/list?family=${familyId}&task=${task.id}`}>
            {t('list.open', { title: task.title })}
          </Link>
        ) : null}
        {task.status === 'OPEN' ? (
          <>
            <Button
              variant="secondary"
              label={t('task.assign')}
              onPress={() => setOpen(open === task.id ? undefined : task.id)}
            />
            {open === task.id
              ? [
                  ...people.map((p) => (
                    <Button
                      key={p.personId}
                      variant="text"
                      label={t('task.assignTo', { name: p.displayName })}
                      disabled={busy}
                      onPress={() => assign(task, p.personId)}
                    />
                  )),
                  <Button
                    key="requeue"
                    variant="text"
                    label={t('task.requeue')}
                    disabled={busy}
                    onPress={() => assign(task, null)}
                  />,
                ]
              : null}
            {families.length >= 2 ? (
              <Button
                variant="secondary"
                label={t('task.forward.action', { title: task.title })}
                innerRef={(el) => void (triggers.current[task.id] = el)}
                onPress={() => setForwarding(task.id)}
              />
            ) : null}
            {manager && task.assigneePersonId !== null ? (
              <Button
                variant="secondary"
                label={t('task.nudge', { title: task.title })}
                disabled={busy}
                onPress={() => nudge(task)}
              />
            ) : null}
            {asking === 'cancel' ? (
              <>
                <Button
                  variant="destructive"
                  label={t('task.confirmCancel')}
                  disabled={locked(task)}
                  onPress={() => change(task, 'cancel', cancelTask)}
                />
                <Button
                  variant="text"
                  label={t('task.keep')}
                  onPress={() => setConfirming(undefined)}
                />
              </>
            ) : (
              <Button
                variant="text"
                label={t(task.recurrence ? 'task.cancelOnce' : 'task.cancel')}
                disabled={locked(task)}
                onPress={() => setConfirming({ id: task.id, kind: 'cancel' })}
              />
            )}
            {task.recurrence && asking === 'end' ? (
              <>
                <Button
                  variant="destructive"
                  label={t('task.confirmEndSeries')}
                  disabled={locked(task)}
                  onPress={() => change(task, 'endSeries', endSeries)}
                />
                <Button
                  variant="text"
                  label={t('task.keepSeries')}
                  onPress={() => setConfirming(undefined)}
                />
              </>
            ) : task.recurrence ? (
              <Button
                variant="text"
                label={t('task.endSeries')}
                disabled={locked(task)}
                onPress={() => setConfirming({ id: task.id, kind: 'end' })}
              />
            ) : null}
          </>
        ) : null}
        {task.status === 'DONE' ? (
          <Button
            variant="secondary"
            label={t('task.reopen')}
            disabled={locked(task)}
            onPress={() => change(task, 'reopen', reopenTask)}
          />
        ) : null}
        {forwarding === task.id && task.status === 'OPEN' ? (
          <ForwardDialog
            task={task}
            assigneeName={people.find((p) => p.personId === task.assigneePersonId)?.displayName}
            targets={families.filter((f) => f.id !== familyId)}
            busy={busy}
            loadMembers={offline?.loadMembers}
            onConfirm={(target) => forward(task, target)}
            onCancel={() => cancelForward(task)}
          />
        ) : null}
      </>
    );
  }

  const now = new Date();
  return (
    <View style={{ gap: space.md }}>
      <Text variant="title" heading={2}>
        {t('task.tasks')}
      </Text>
      {last ? (
        <InlineNotice
          tone={last.tone}
          action={
            last.undo
              ? {
                  label: t('task.card.undo'),
                  onPress: () => void undo(),
                  disabled: busy || undoBlocked,
                }
              : undefined
          }
        >
          {t(last.key, last.params)}
        </InlineNotice>
      ) : null}
      {offline?.notice ? (
        <InlineNotice
          role="status"
          action={{ label: t('task.noticeClose'), onPress: offline.dismiss }}
        >
          {t(offline.notice.key, offline.notice.params)}
        </InlineNotice>
      ) : null}
      {loadFailed ? (
        <InlineNotice tone="danger" role="status">
          {t('task.loadError')}
        </InlineNotice>
      ) : null}
      {tasks && tasks.length === 0 ? (
        <EmptyState
          title={t('task.empty.title')}
          hint={t('task.empty.hint')}
          action={{ label: t('task.empty.add'), onPress: () => titleField.current?.focus() }}
        />
      ) : null}
      {tasks && tasks.length > 0 ? (
        <TaskSectionList
          label={t('task.list')}
          tasks={tasks}
          now={now}
          renderCard={(task, section) => (
            <TaskCard
              task={task}
              people={people}
              overdue={section === 'overdue'}
              disabled={busy}
              onToggle={() => void done(task)}
              onTake={() => void take(task)}
              actions={actionsOf(task)}
            />
          )}
        />
      ) : null}
      <NewTaskForm
        timeZone={timeZone}
        busy={busy}
        onSubmit={add}
        onProblem={(key) => setLast({ tone: 'danger', key })}
        titleRef={titleField}
      />
      <Link href="/tasks">{t('task.all')}</Link>
    </View>
  );
}
