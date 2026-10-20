import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useT } from '@/i18n';

import {
  buildRule,
  DAYS,
  emptyRuleForm,
  parseDue,
  parseTime,
  toInstant,
  type Day,
  type Rule,
  type RuleKind,
} from './recurrence';

export type NewTaskInput = {
  title: string;
  dueKind?: 'DATE' | 'DATETIME';
  due?: string;
  recurrence?: Rule;
};

type Props = {
  /** The zone of the family: a DATETIME is the local time there, not on the device. */
  timeZone: string;
  busy: boolean;
  /** Resolves true when the server accepted the task: the form is emptied. */
  onSubmit: (input: NewTaskInput) => Promise<boolean>;
  /** A translation key for the alert of the section. */
  onProblem: (key: string) => void;
};

const KINDS: RuleKind[] = ['never', 'daily', 'everyN', 'weekly', 'monthly'];

function Choice({
  role,
  label,
  selected,
  onPress,
}: {
  role: 'radio' | 'checkbox';
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      role={role}
      aria-label={label}
      aria-checked={selected}
      onPress={onPress}
      style={[styles.choice, selected && styles.chosen]}
    >
      <Text style={selected ? styles.chosenText : undefined}>{label}</Text>
    </Pressable>
  );
}

/** Title, optional due date and time, and how the task repeats. */
export function NewTaskForm({ timeZone, busy, onSubmit, onProblem }: Props) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [time, setTime] = useState('');
  const [rule, setRule] = useState(emptyRuleForm);

  async function submit() {
    const clean = title.trim();
    if (!clean) return;
    const built = buildRule(rule);
    const date = due.trim() === '' ? undefined : parseDue(due);
    const clock = time.trim() === '' ? undefined : parseTime(time);
    if (
      'error' in built ||
      (due.trim() !== '' && !date) ||
      (time.trim() !== '' && (!clock || !date))
    ) {
      onProblem('task.invalid');
      return;
    }
    if (built.rule && !date) {
      onProblem('recurrence.needsDue');
      return;
    }
    const input: NewTaskInput = { title: clean };
    if (date && clock) {
      input.dueKind = 'DATETIME';
      input.due = toInstant(date, clock, timeZone).toISOString();
    } else if (date) {
      input.dueKind = 'DATE';
      input.due = date;
    }
    if (built.rule) input.recurrence = built.rule;
    if (await onSubmit(input)) {
      setTitle('');
      setDue('');
      setTime('');
      setRule(emptyRuleForm);
    }
  }

  const toggle = (day: Day) =>
    setRule((r) => ({
      ...r,
      days: r.days.includes(day) ? r.days.filter((d) => d !== day) : [...r.days, day],
    }));

  return (
    <View style={styles.form}>
      <TextInput
        aria-label={t('task.newTitle')}
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />
      <TextInput
        aria-label={t('task.dueInput')}
        value={due}
        onChangeText={setDue}
        style={styles.input}
      />
      <TextInput
        aria-label={t('task.timeInput')}
        value={time}
        onChangeText={setTime}
        style={styles.input}
      />
      <View role="radiogroup" aria-label={t('recurrence.repeats')} style={styles.row}>
        {KINDS.map((kind) => (
          <Choice
            key={kind}
            role="radio"
            label={t(`recurrence.${kind}`)}
            selected={rule.kind === kind}
            onPress={() => setRule((r) => ({ ...r, kind }))}
          />
        ))}
      </View>
      {rule.kind === 'everyN' ? (
        <TextInput
          aria-label={t('recurrence.interval')}
          value={rule.interval}
          onChangeText={(interval) => setRule((r) => ({ ...r, interval }))}
          style={styles.input}
        />
      ) : null}
      {rule.kind === 'weekly' ? (
        <View style={styles.row}>
          {DAYS.map((day) => (
            <Choice
              key={day}
              role="checkbox"
              label={t(`recurrence.day.${day}`)}
              selected={rule.days.includes(day)}
              onPress={() => toggle(day)}
            />
          ))}
        </View>
      ) : null}
      {rule.kind === 'monthly' ? (
        <TextInput
          aria-label={t('recurrence.dayOfMonth')}
          value={rule.dayOfMonth}
          onChangeText={(dayOfMonth) => setRule((r) => ({ ...r, dayOfMonth }))}
          style={styles.input}
        />
      ) : null}
      <Pressable
        role="button"
        aria-label={t('task.add')}
        disabled={busy || title.trim() === ''}
        onPress={submit}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{t('task.add')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 8, alignItems: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  input: { width: 280, borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 10 },
  choice: { borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 6 },
  chosen: { backgroundColor: '#1f5fbf' },
  chosenText: { color: '#fff' },
  button: {
    backgroundColor: '#1f5fbf',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
