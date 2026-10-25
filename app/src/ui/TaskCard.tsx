import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { FamilyMember, Task } from '@/api/client';
import { useT } from '@/i18n';
import { formatClock, formatDue } from '@/task/dates';
import { describe } from '@/task/recurrence';

import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { CriticalityBadge } from './CriticalityBadge';
import { FamilyTag } from './FamilyTag';
import { PersonBadge } from './PersonBadge';
import { Text } from './Text';
import { useTheme } from './theme';

export type TaskCardProps = {
  task: Task;
  people: Pick<FamilyMember, 'personId' | 'displayName'>[];
  /** The family name, in the aggregate views. */
  familyName?: string;
  /** The due date has passed (it is shown in the danger colour). */
  overdue?: boolean;
  /** A write is going on, or the task has queued changes: the controls are turned off. */
  disabled?: boolean;
  onToggle?: () => void;
  onTake?: () => void;
  /** The secondary actions of the row, under the meta line, across the whole card. */
  actions?: ReactNode;
};

/** One task (DESIGN §6.1). Not pressable as a whole: the checkbox and «Take» are the targets. */
export function TaskCard({
  task,
  people,
  familyName,
  overdue,
  disabled,
  onToggle,
  onTake,
  actions,
}: TaskCardProps) {
  const t = useT();
  const { colors, elevation, radius, space } = useTheme();
  const open = task.status === 'OPEN';
  const due = formatDue(task);
  const rule = task.recurrence ? describe(task.recurrence) : undefined;
  const assignee = task.assigneePersonId
    ? (people.find((p) => p.personId === task.assigneePersonId)?.displayName ?? '?')
    : undefined;
  return (
    <View
      style={{
        ...elevation,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: space.md,
        gap: space.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
        {task.status === 'CANCELLED' ? null : (
          <Checkbox
            label={t('task.card.doneLabel', { title: task.title })}
            checked={task.status === 'DONE'}
            disabled={disabled}
            onPress={open ? onToggle : undefined}
          />
        )}
        <View style={{ flex: 1, gap: space.sm, paddingTop: space.sm }}>
          <Text variant={open ? 'bodyStrong' : 'body'}>{task.title}</Text>
          {open && assignee && task.assigneePersonId ? (
            <PersonBadge
              personId={task.assigneePersonId}
              name={assignee}
              label={t('task.assignedTo', { name: assignee })}
            />
          ) : null}
          {open && !assignee ? <Text variant="meta">{t('task.queue')}</Text> : null}
          {due ? (
            <Text variant="meta" tone={overdue ? 'danger' : 'default'}>
              {t('task.due', { date: due })}
            </Text>
          ) : null}
          {rule ? (
            <Text variant="meta">
              {t(rule.key, {
                ...rule.params,
                days: rule.days.map((d) => t(`recurrence.dayInRule.${d}`)).join(', '),
              })}
            </Text>
          ) : null}
          {task.lastNudgedAt ? (
            <Text variant="meta">
              {t('task.nudgedAt', { time: formatClock(task.lastNudgedAt, task.familyTimeZone) })}
            </Text>
          ) : null}
          {task.criticality === 'LOW' ? (
            <Text variant="meta">{t('task.criticality.low')}</Text>
          ) : null}
          {task.status === 'DONE' ? <Text variant="meta">{t('task.done')}</Text> : null}
          {task.status === 'CANCELLED' ? <Text variant="meta">{t('task.cancelled')}</Text> : null}
          {familyName || task.criticality === 'HIGH' ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {familyName ? <FamilyTag name={familyName} /> : null}
              {task.criticality === 'HIGH' ? (
                <CriticalityBadge label={t('task.card.high')} />
              ) : null}
            </View>
          ) : null}
          {open && !assignee ? (
            <Button
              variant="secondary"
              large
              label={t('task.card.take')}
              disabled={disabled}
              onPress={onTake}
            />
          ) : null}
        </View>
      </View>
      {actions ? <View style={{ gap: space.sm }}>{actions}</View> : null}
    </View>
  );
}
