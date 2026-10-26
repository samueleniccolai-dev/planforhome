import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

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
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { EmptyState } from '@/ui/EmptyState';
import { InlineNotice, type NoticeTone } from '@/ui/InlineNotice';
import { LoadingState } from '@/ui/LoadingState';
import { Sheet } from '@/ui/Sheet';
import { TaskCard } from '@/ui/TaskCard';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

import { ForwardDialog } from './ForwardDialog';
import { keepAttempt, attemptFor, mergeTask, newIds, type Attempt, type Ids } from './logic';
import { NewTaskForm, type NewTaskInput, type SubmitResult } from './NewTaskForm';
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
  /** The errors go to the caller (the open sheet) instead of the notice of the section. */
  report?: (key: string) => void;
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
  const { space, colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Last | undefined>();
  const [open, setOpen] = useState<string | undefined>();
  const [confirming, setConfirming] = useState<
    { id: string; kind: 'cancel' | 'end' } | undefined
  >();
  const [forwarding, setForwarding] = useState<string | undefined>();
  const triggers = useRef<Record<string, unknown>>({});
  const [creating, setCreating] = useState(false);
  const newTask = useRef<unknown>(null);
  const sheet = useRef({ open: false, id: 0, refocus: false });
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
      const say = (tone: NoticeTone, key: string) =>
        spec.report ? spec.report(key) : setLast({ tone, key });
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
          say('danger', spec.forbiddenKey ?? 'task.forbidden');
          break;
        case 'notFound':
          await onStale();
          break;
        case 'tooSoon':
          setLast({ tone: 'notice', key: 'task.nudgeTooSoon' });
          break;
        case 'changed':
          say('notice', 'task.changed');
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
          if (spec.report) spec.report('task.failed');
          else setLast({ tone: 'danger', key: 'task.failed', undo: spec.undo });
      }
      return undefined;
    });
  }

  function openSheet() {
    sheet.current = { ...sheet.current, open: true, id: sheet.current.id + 1 };
    setCreating(true);
  }

  function closeSheet() {
    sheet.current = { ...sheet.current, open: false, refocus: true };
    setCreating(false);
  }

  /** After a confirmation is gone, the focus goes back to the button that opened it. */
  const askedBy = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (confirming || !askedBy.current) return;
    const key = askedBy.current;
    askedBy.current = undefined;
    (triggers.current[key] as { focus?: () => void } | null)?.focus?.();
  }, [confirming]);

  function ask(task: Task, kind: 'cancel' | 'end') {
    askedBy.current = `${kind}:${task.id}`;
    setConfirming({ id: task.id, kind });
  }

  /** After the sheet is gone, the focus goes to «New task», whoever opened it. */
  useEffect(() => {
    if (creating || !sheet.current.refocus) return;
    sheet.current.refocus = false;
    (newTask.current as { focus?: () => void } | null)?.focus?.();
  }, [creating]);

  /** An error goes into the sheet that sent the task; if it was closed, into the section. */
  async function add(input: NewTaskInput): Promise<SubmitResult> {
    const from = sheet.current.id;
    let key = '';
    const report = (k: string) => (key = k);
    if (offline) {
      const queued = await exclusive(() => offline.create(input));
      if (queued) return { ok: true };
      if (queued === false) report('task.failed');
    } else {
      const id = `create:${input.title}|${input.dueKind}|${input.due}|${JSON.stringify(input.recurrence)}|${input.criticality}|${input.template}`;
      const saved = await run({
        key: id,
        report,
        send: (ids) => createTask(familyId, { id: ids.id, mutationId: ids.mutationId, ...input }),
      });
      if (saved) return { ok: true };
    }
    if (key && !(sheet.current.open && sheet.current.id === from)) {
      setLast({ tone: 'danger', key });
      return { ok: false, key: '' };
    }
    return { ok: false, key };
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

  function cancelForward() {
    setForwarding(undefined);
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
    // The dialog of a cancel or an end of series closes anyway: the notice is in the section.
    setConfirming(undefined);
    if (saved) setOpen(undefined);
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
          <Link href={`/list?family=${familyId}&task=${task.id}`} style={{ color: colors.accent }}>
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
            <Button
              variant="text"
              label={t(task.recurrence ? 'task.cancelOnce' : 'task.cancel')}
              disabled={locked(task)}
              innerRef={(el) => void (triggers.current[`cancel:${task.id}`] = el)}
              onPress={() => ask(task, 'cancel')}
            />
            {task.recurrence ? (
              <Button
                variant="text"
                label={t('task.endSeries')}
                disabled={locked(task)}
                innerRef={(el) => void (triggers.current[`end:${task.id}`] = el)}
                onPress={() => ask(task, 'end')}
              />
            ) : null}
            {asking ? (
              <ConfirmDialog
                title={
                  asking === 'end'
                    ? t('task.endSeriesTitle', { title: task.title })
                    : t(task.recurrence ? 'task.cancelOnceTitle' : 'task.cancelTitle', {
                        title: task.title,
                      })
                }
                consequence={t(
                  asking === 'end'
                    ? 'task.endSeriesConsequence'
                    : task.recurrence
                      ? 'task.cancelOnceConsequence'
                      : 'task.cancelConsequence',
                  { title: task.title },
                )}
                confirmLabel={t(asking === 'end' ? 'task.confirmEndSeries' : 'task.confirmCancel')}
                cancelLabel={t(asking === 'end' ? 'task.keepSeries' : 'task.keep')}
                busy={locked(task)}
                onConfirm={() =>
                  void (asking === 'end'
                    ? change(task, 'endSeries', endSeries)
                    : change(task, 'cancel', cancelTask))
                }
                onCancel={() => setConfirming(undefined)}
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
            onCancel={cancelForward}
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
      {!tasks && !loadFailed ? <LoadingState /> : null}
      {tasks && tasks.length === 0 ? (
        <EmptyState
          title={t('task.empty.title')}
          hint={t('task.empty.hint')}
          action={{ label: t('task.empty.add'), onPress: openSheet }}
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
      <Button
        label={t('task.new')}
        innerRef={(el) => void (newTask.current = el)}
        onPress={openSheet}
      />
      {creating ? (
        <Sheet title={t('task.new')} onClose={closeSheet}>
          <NewTaskForm
            timeZone={timeZone}
            now={now}
            busy={busy}
            onSubmit={add}
            onDone={closeSheet}
          />
        </Sheet>
      ) : null}
      <Link href="/tasks" style={{ color: colors.accent }}>
        {t('task.all')}
      </Link>
    </View>
  );
}
