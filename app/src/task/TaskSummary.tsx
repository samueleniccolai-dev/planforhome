import { StyleSheet, Text, View } from 'react-native';

import type { FamilyMember, Task } from '@/api/client';
import { useT } from '@/i18n';

import { formatDue } from './dates';
import { nameOf } from './logic';

/** What a person reads about a task: title, (family), assignment, criticality, due date. */
export function TaskSummary({
  task,
  people,
  familyName,
}: {
  task: Task;
  people: Pick<FamilyMember, 'personId' | 'displayName'>[];
  familyName?: string;
}) {
  const t = useT();
  const due = formatDue(task);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{task.title}</Text>
      {familyName ? <Text>{familyName}</Text> : null}
      <Text>
        {task.assigneePersonId
          ? t('task.assignedTo', { name: nameOf(people, task.assigneePersonId) })
          : t('task.queue')}
      </Text>
      <Text>{t(`task.criticality.${task.criticality.toLowerCase()}`)}</Text>
      {due ? <Text>{t('task.due', { date: due })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 2 },
  title: { fontWeight: '600' },
});
