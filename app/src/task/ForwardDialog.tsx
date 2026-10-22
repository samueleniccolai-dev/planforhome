import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { members, type Family, type FamilyMember, type Task } from '@/api/client';
import { useT } from '@/i18n';

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

async function fromApi(familyId: string): Promise<FamilyMember[] | undefined> {
  const outcome = await members(familyId);
  return outcome.status === 'ok' ? outcome.value : undefined;
}

/** The panel of the forward: the choice of the family, the warning on the assignee, the buttons. */
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
  const [lost, setLost] = useState(false);
  const [checking, setChecking] = useState(false);
  const panel = useRef<{ focus?: () => void }>(null);
  const latest = useRef<string | undefined>(undefined);

  useEffect(() => {
    panel.current?.focus?.();
  }, []);

  async function choose(family: Family) {
    latest.current = family.id;
    setTarget(family);
    setLost(false);
    setChecking(true);
    const people = await loadMembers(family.id);
    // Only the last choice counts; the server decides anyway.
    if (latest.current !== family.id) return;
    setLost(
      people !== undefined &&
        task.assigneePersonId !== null &&
        !people.some((m) => m.personId === task.assigneePersonId),
    );
    setChecking(false);
  }

  return (
    <View
      ref={panel as never}
      role="dialog"
      aria-label={t('task.forward.dialog')}
      aria-modal={true}
      tabIndex={-1}
      style={styles.panel}
    >
      <View role="radiogroup" aria-label={t('task.forward.arrival')} style={styles.row}>
        {targets.map((family) => (
          <Pressable
            key={family.id}
            role="radio"
            aria-label={family.name}
            aria-checked={target?.id === family.id}
            onPress={() => choose(family)}
            style={[styles.button, target?.id === family.id && styles.chosen]}
          >
            <Text style={styles.buttonText}>{family.name}</Text>
          </Pressable>
        ))}
      </View>
      {target && lost ? (
        <Text role="alert" aria-label={t('task.forward.warning')} style={styles.alert}>
          {t('task.forward.warningText', {
            name: assigneeName ?? '?',
            family: target.name,
          })}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Pressable
          role="button"
          aria-label={t('task.forward.confirm')}
          disabled={!target || checking || busy}
          onPress={() => target && onConfirm(target)}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t('task.forward.confirm')}</Text>
        </Pressable>
        <Pressable
          role="button"
          aria-label={t('task.forward.cancel')}
          onPress={onCancel}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t('task.forward.cancel')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 6, borderWidth: 1, borderColor: '#1f5fbf', borderRadius: 6, padding: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  alert: { color: '#b00020' },
  button: {
    backgroundColor: '#1f5fbf',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chosen: { backgroundColor: '#0b3a80' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
