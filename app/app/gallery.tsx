import { Redirect } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { useT } from '@/i18n';
import { TaskListGallery } from '@/task/TaskListGallery';
import { Button, type ButtonVariant } from '@/ui/Button';
import { FormGallery } from '@/ui/FormGallery';
import { InlineNotice } from '@/ui/InlineNotice';
import { LoadingState } from '@/ui/LoadingState';
import { isGalleryEnabled } from '@/ui/gallery';
import { Screen } from '@/ui/Screen';
import { Text, type TextVariant } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { FontScaleContext } from '@/ui/theme';

const noSubscription = () => () => {};
const ALLOWED_SCALES = [1, 1.5, 2];
const VARIANTS: TextVariant[] = ['title', 'section', 'body', 'bodyStrong', 'meta', 'caption'];
const BUTTONS: [ButtonVariant, string][] = [
  ['primary', 'add'],
  ['secondary', 'take'],
  ['destructive', 'delete'],
  ['text', 'cancel'],
];

function readScale(): number {
  const value = Number(new URLSearchParams(window.location.search).get('fs'));
  return ALLOWED_SCALES.includes(value) ? value : 1;
}

function readSet(): string | null {
  return new URLSearchParams(window.location.search).get('set');
}

/** Gate: null while prerendering (nothing is shown), then true or false on the client. */
function readGate(): boolean {
  return isGalleryEnabled({
    dev: __DEV__,
    os: Platform.OS,
    host: Platform.OS === 'web' ? window.location.hostname : undefined,
  });
}

export default function GalleryRoute() {
  const enabled = useSyncExternalStore<boolean | null>(noSubscription, readGate, () => null);
  const scale = useSyncExternalStore(noSubscription, readScale, () => 1);
  const set = useSyncExternalStore(noSubscription, readSet, () => null);
  if (enabled === null) return null;
  if (!enabled) return <Redirect href="/" />;
  return (
    <FontScaleContext.Provider value={scale}>
      {set === 'list' ? <TaskListGallery /> : set === 'form' ? <FormGallery /> : <Gallery />}
    </FontScaleContext.Provider>
  );
}

function Gallery() {
  const t = useT();
  const [pressed, setPressed] = useState(0);
  return (
    <Screen>
      <Text variant="title" heading={1}>
        {t('gallery.title')}
      </Text>

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.sections.text')}
      </Text>
      {VARIANTS.map((variant) => (
        <Text key={variant} variant={variant}>
          {t('gallery.sample', { variant })}
        </Text>
      ))}
      <Text>{t('gallery.long')}</Text>

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.sections.buttons')}
      </Text>
      {BUTTONS.map(([variant, key]) => (
        <Button key={key} variant={variant} label={t(`gallery.${key}`)} onPress={() => {}} />
      ))}
      {BUTTONS.map(([variant, key]) => (
        <Button
          key={`${key}-off`}
          variant={variant}
          disabled
          label={t('gallery.disabledSuffix', { label: t(`gallery.${key}`) })}
        />
      ))}
      <Button
        variant="secondary"
        label={t('gallery.probe')}
        onPress={() => setPressed((n) => n + 1)}
      />
      {pressed > 0 ? (
        <Text>
          {pressed === 1
            ? t('gallery.pressedOne')
            : t('gallery.pressedMany', { n: String(pressed) })}
        </Text>
      ) : null}

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.sections.fields')}
      </Text>
      <TextField label={t('gallery.emptyField')} />
      <TextField
        label={t('gallery.errorField')}
        defaultValue={t('gallery.errorValue')}
        error={t('gallery.error')}
      />

      <Text variant="section" tone="secondary" heading={2}>
        {t('gallery.sections.notices')}
      </Text>
      <InlineNotice>{t('gallery.noticeInfo')}</InlineNotice>
      <InlineNotice tone="danger">{t('gallery.noticeDanger')}</InlineNotice>
      <InlineNotice tone="success">{t('gallery.noticeSuccess')}</InlineNotice>
      <LoadingState />
    </Screen>
  );
}
