import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { families, logout, me, refresh, type Family } from '@/api/client';
import { FamilySwitch } from '@/family/FamilySwitch';
import { setAccountLocale, useLocale, useT } from '@/i18n';
import { getRuntime } from '@/sync/runtime';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { InlineNotice } from '@/ui/InlineNotice';
import { LoadingState } from '@/ui/LoadingState';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { FontScaleContext, parseFontScale } from '@/ui/theme';

export default function Me() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { fs } = useLocalSearchParams<{ fs?: string }>();
  const [name, setName] = useState<string | undefined>();
  const [list, setList] = useState<Family[] | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const person = await me();
      if (!alive) return;
      if (!person) {
        router.replace('/login');
        return;
      }
      setName(person.displayName);
      const [, mine] = await Promise.all([refresh(), families()]);
      if (!alive) return;
      if (mine.status === 'ok') setList(mine.value);
      else setFailed(true);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function signOut() {
    const runtime = await getRuntime();
    await (runtime ? runtime.session.signOut() : logout());
    // Back to «before the login»: the language of the browser decides again.
    setAccountLocale(undefined);
    router.replace('/login');
  }

  if (name === undefined) {
    return (
      <FontScaleContext.Provider value={parseFontScale(fs)}>
        <Screen>
          <LoadingState />
        </Screen>
      </FontScaleContext.Provider>
    );
  }

  return (
    <FontScaleContext.Provider value={parseFontScale(fs)}>
      <Screen>
        <FamilySwitch families={list} />
        <Text variant="title" heading={1}>
          {t('me.greeting', { name })}
        </Text>
        <Text variant="meta" tone="secondary">
          {t('me.language', { language: t(`me.languageName.${locale}`) })}
        </Text>
        {failed ? <InlineNotice tone="danger">{t('me.familiesError')}</InlineNotice> : null}
        {!failed && !list ? <LoadingState /> : null}
        {list?.length === 0 ? (
          <EmptyState title={t('me.noFamilies.title')} hint={t('me.noFamilies.hint')} />
        ) : null}
        <Button variant="secondary" label={t('me.signOut')} onPress={signOut} />
      </Screen>
    </FontScaleContext.Provider>
  );
}
