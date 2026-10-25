import { useRef, useState } from 'react';
import { View } from 'react-native';

import { members, type Family, type FamilyMember, type Task } from '@/api/client';
import { useT } from '@/i18n';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { RadioGroup, RadioRow } from '@/ui/RadioRow';
import { Text } from '@/ui/Text';

type Props = {
  task: Task;
  /** Name of the assignee in the family of departure, if there is one. */
  assigneeName: string | undefined;
  /** The other families of the person. */
  targets: Family[];
  busy: boolean;
  onConfirm: (target: Family) => void;
  onCancel: () => void;
  /** The people of the family of arrival; undefined when unknown. Default: the API. */
  loadMembers?: (familyId: string) => Promise<FamilyMember[] | undefined>;
};

/** What the server will do with the assignee in the family of arrival. */
type Reading = 'checking' | 'member' | 'lost' | 'unknown';

async function fromApi(familyId: string): Promise<FamilyMember[] | undefined> {
  const outcome = await members(familyId);
  return outcome.status === 'ok' ? outcome.value : undefined;
}

/** The forward: the choice of the family and the consequence, written before the confirmation. */
export function ForwardDialog({
  task,
  assigneeName,
  targets,
  busy,
  onConfirm,
  onCancel,
  loadMembers = fromApi,
}: Props) {
  const t = useT();
  const [target, setTarget] = useState<Family | undefined>();
  const [reading, setReading] = useState<Reading>('checking');
  const latest = useRef<string | undefined>(undefined);

  async function choose(family: Family) {
    latest.current = family.id;
    setTarget(family);
    setReading('checking');
    const people = await loadMembers(family.id);
    // Only the last choice counts; the server decides anyway.
    if (latest.current !== family.id) return;
    if (people === undefined) return setReading('unknown');
    const stays =
      task.assigneePersonId === null || people.some((m) => m.personId === task.assigneePersonId);
    setReading(stays ? 'member' : 'lost');
  }

  const params = { family: target?.name ?? '', name: assigneeName ?? '?' };
  const queued = task.assigneePersonId === null;
  let sentence: string | undefined;
  if (target) {
    if (reading === 'checking') sentence = t('task.forward.checking', params);
    else if (reading === 'lost') sentence = t('task.forward.warningText', params);
    else if (queued) sentence = t('task.forward.staysQueued', params);
    else if (reading === 'unknown') sentence = t('task.forward.unknown', params);
    else sentence = t('task.forward.staysAssigned', params);
    if (task.recurrence && reading !== 'checking') {
      sentence = `${sentence} ${t('task.forward.sameRecurrence')}`;
    }
  }

  return (
    <ConfirmDialog
      title={t('task.forward.dialog')}
      consequence={sentence}
      consequenceAlert={reading === 'lost' && target ? t('task.forward.warning') : undefined}
      confirmLabel={t('task.forward.confirm')}
      cancelLabel={t('task.forward.cancel')}
      tone="primary"
      busy={busy}
      confirmDisabled={!target || reading === 'checking'}
      disabledReason={target ? undefined : t('task.forward.choose')}
      onConfirm={() => target && onConfirm(target)}
      onCancel={onCancel}
    >
      <Text>{task.title}</Text>
      <View>
        <RadioGroup label={t('task.forward.arrival')}>
          {targets.map((family) => (
            <RadioRow
              key={family.id}
              label={family.name}
              selected={target?.id === family.id}
              onSelect={() => void choose(family)}
            />
          ))}
        </RadioGroup>
      </View>
    </ConfirmDialog>
  );
}
