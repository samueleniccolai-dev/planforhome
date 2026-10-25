import { useState } from 'react';

import { useT } from '@/i18n';

import { Button } from './Button';
import { CheckRow } from './CheckRow';
import { ConfirmDialog } from './ConfirmDialog';
import { DateField } from './DateField';
import { RadioGroup, RadioRow } from './RadioRow';
import { Screen } from './Screen';
import { Sheet, SheetBody } from './Sheet';
import { Text } from './Text';
import { TextField } from './TextField';

const PEOPLE = ['giulia', 'marco', 'leo'] as const;
// A fixed day: the gallery shows the same page on every run.
const TODAY = '2026-10-28';

/** The form kit with invented data: `/gallery?set=form`. */
export function FormGallery() {
  const t = useT();
  const [remind, setRemind] = useState(false);
  const [who, setWho] = useState<(typeof PEOPLE)[number]>('giulia');
  const [date, setDate] = useState('');
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  return (
    <Screen>
      <Text variant="title" heading={1}>
        {t('gallery.form.title')}
      </Text>
      <TextField label={t('gallery.form.note')} hint={t('gallery.form.hint')} />
      <CheckRow label={t('gallery.form.remind')} checked={remind} onChange={setRemind} />
      <CheckRow label={t('gallery.form.adults')} checked={false} disabled />
      <RadioGroup label={t('gallery.form.who')}>
        {PEOPLE.map((person) => (
          <RadioRow
            key={person}
            label={t(`gallery.form.${person}`)}
            selected={who === person}
            onSelect={() => setWho(person)}
          />
        ))}
      </RadioGroup>
      <DateField label={t('gallery.form.date')} value={date} onChange={setDate} today={TODAY} />
      <Button variant="secondary" label={t('gallery.form.open')} onPress={() => setOpen(true)} />
      <Button
        variant="secondary"
        label={t('gallery.form.confirmOpen')}
        onPress={() => setAsking(true)}
      />
      {asking ? (
        <ConfirmDialog
          title={t('gallery.form.confirmTitle')}
          consequence={t('gallery.form.confirmConsequence')}
          confirmLabel={t('gallery.form.confirmYes')}
          cancelLabel={t('gallery.form.confirmNo')}
          onConfirm={() => setAsking(false)}
          onCancel={() => setAsking(false)}
        />
      ) : null}
      {open ? (
        <Sheet title={t('gallery.form.sheet')} onClose={() => setOpen(false)}>
          <SheetBody>
            <Text>{t('gallery.form.body')}</Text>
          </SheetBody>
        </Sheet>
      ) : null}
    </Screen>
  );
}
