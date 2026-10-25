import { useEffect, useId, useRef, useState, type ComponentRef } from 'react';
import { type TextInput } from 'react-native';

import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { CheckRow } from '@/ui/CheckRow';
import { DateField } from '@/ui/DateField';
import { InlineNotice } from '@/ui/InlineNotice';
import { RadioGroup, RadioRow } from '@/ui/RadioRow';
import { SheetBody, SheetFooter } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

import { dayIn } from './filters';
import {
  buildRule,
  DAYS,
  emptyRuleForm,
  parseTime,
  toInstant,
  type Day,
  type Rule,
  type RuleKind,
} from './recurrence';

export type Criticality = 'LOW' | 'NORMAL' | 'HIGH';

export type NewTaskInput = {
  title: string;
  dueKind?: 'DATE' | 'DATETIME';
  due?: string;
  /** Sent only when it is not Normal. */
  criticality?: 'LOW' | 'HIGH';
  recurrence?: Rule;
  template?: 'SHOPPING_LIST';
};

/** The answer of the section: `key` is the translation key of the error (empty: nothing to say). */
export type SubmitResult = { ok: true } | { ok: false; key: string };

type Props = {
  /** The zone of the family: a DATETIME is the local time there, not on the device. */
  timeZone: string;
  /** The instant «today» comes from, in the zone of the family. */
  now: Date;
  busy: boolean;
  onSubmit: (input: NewTaskInput) => Promise<SubmitResult>;
  /** The task was added: the section closes the sheet. */
  onDone: () => void;
};

const KINDS: RuleKind[] = ['never', 'daily', 'everyN', 'weekly', 'monthly'];
const LEVELS: [Criticality, string][] = [
  ['LOW', 'low'],
  ['NORMAL', 'normal'],
  ['HIGH', 'high'],
];

/** The content of the «New task» sheet: it unmounts with the sheet, so it opens empty. */
export function NewTaskForm({ timeZone, now, busy, onSubmit, onDone }: Props) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [time, setTime] = useState('');
  const [level, setLevel] = useState<Criticality>('NORMAL');
  const [rule, setRule] = useState(emptyRuleForm);
  const [shopping, setShopping] = useState(false);
  const [problem, setProblem] = useState<string | undefined>();
  const titleField = useRef<ComponentRef<typeof TextInput>>(null);
  const alive = useRef(true);
  const reasonId = `${useId()}-reason`;
  const blank = title.trim() === '';

  useEffect(() => {
    titleField.current?.focus();
    return () => {
      alive.current = false;
    };
  }, []);

  async function submit() {
    if (blank) return;
    const built = buildRule(rule);
    const clock = time.trim() === '' ? undefined : parseTime(time);
    if ('error' in built || (time.trim() !== '' && (!clock || due === ''))) {
      return setProblem('task.invalid');
    }
    if (built.rule && due === '') return setProblem('recurrence.needsDue');
    const input: NewTaskInput = { title: title.trim() };
    if (due !== '' && clock) {
      input.dueKind = 'DATETIME';
      input.due = toInstant(due, clock, timeZone).toISOString();
    } else if (due !== '') {
      input.dueKind = 'DATE';
      input.due = due;
    }
    if (level !== 'NORMAL') input.criticality = level;
    if (built.rule) input.recurrence = built.rule;
    if (shopping) input.template = 'SHOPPING_LIST';
    setProblem(undefined);
    const result = await onSubmit(input);
    if (!alive.current) return;
    if (result.ok) onDone();
    else if (result.key) setProblem(result.key);
  }

  const toggle = (day: Day) =>
    setRule((r) => ({
      ...r,
      days: r.days.includes(day) ? r.days.filter((d) => d !== day) : [...r.days, day],
    }));

  return (
    <>
      <SheetBody>
        <TextField
          innerRef={titleField}
          label={t('task.title')}
          value={title}
          onChangeText={setTitle}
        />
        <DateField
          label={t('task.dueField')}
          value={due}
          onChange={setDue}
          today={dayIn(now, timeZone)}
        />
        <TextField label={t('task.timeInput')} value={time} onChangeText={setTime} />
        <RadioGroup label={t('task.criticalityLabel')}>
          {LEVELS.map(([value, key]) => (
            <RadioRow
              key={value}
              label={t(`task.level.${key}`)}
              selected={level === value}
              onSelect={() => setLevel(value)}
            />
          ))}
        </RadioGroup>
        <RadioGroup label={t('recurrence.repeats')}>
          {KINDS.map((kind) => (
            <RadioRow
              key={kind}
              label={t(`recurrence.${kind}`)}
              selected={rule.kind === kind}
              onSelect={() => setRule((r) => ({ ...r, kind }))}
            />
          ))}
        </RadioGroup>
        {rule.kind === 'everyN' ? (
          <TextField
            label={t('recurrence.interval')}
            value={rule.interval}
            onChangeText={(interval) => setRule((r) => ({ ...r, interval }))}
          />
        ) : null}
        {rule.kind === 'weekly'
          ? DAYS.map((day) => (
              <CheckRow
                key={day}
                label={t(`recurrence.day.${day}`)}
                checked={rule.days.includes(day)}
                onChange={() => toggle(day)}
              />
            ))
          : null}
        {rule.kind === 'monthly' ? (
          <TextField
            label={t('recurrence.dayOfMonth')}
            value={rule.dayOfMonth}
            onChangeText={(dayOfMonth) => setRule((r) => ({ ...r, dayOfMonth }))}
          />
        ) : null}
        <CheckRow label={t('task.shoppingSwitch')} checked={shopping} onChange={setShopping} />
      </SheetBody>
      <SheetFooter>
        {problem ? <InlineNotice tone="danger">{t(problem)}</InlineNotice> : null}
        <Button
          label={t('task.add')}
          disabled={busy || blank}
          describedBy={blank ? reasonId : undefined}
          onPress={() => void submit()}
        />
        {blank ? (
          <Text nativeID={reasonId} variant="meta" tone="secondary">
            {t('task.titleRequired')}
          </Text>
        ) : null}
      </SheetFooter>
    </>
  );
}
