import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { families, type Family } from '@/api/client';
import { landing } from '@/family/logic';
import { useT } from '@/i18n';
import { InlineNotice } from '@/ui/InlineNotice';
import { LinkRow } from '@/ui/LinkRow';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { FontScaleContext, parseFontScale } from '@/ui/theme';

export default function Families() {
  const t = useT();
  const router = useRouter();
  const { fs } = useLocalSearchParams<{ fs?: string }>();
  const [list, setList] = useState<Family[] | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const outcome = await families();
      if (!alive) return;
      const to = landing(outcome);
      if (outcome.status === 'ok' && to === '/families') setList(outcome.value);
      else if (outcome.status === 'error' || outcome.status === 'notFound') setFailed(true);
      else router.replace(to as never);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (failed) {
    return (
      <FontScaleContext.Provider value={parseFontScale(fs)}>
        <Screen>
          <InlineNotice tone="danger">{t('families.error')}</InlineNotice>
        </Screen>
      </FontScaleContext.Provider>
    );
  }
  if (!list) return null;

  return (
    <FontScaleContext.Provider value={parseFontScale(fs)}>
      <Screen>
        <Text variant="title" heading={1}>
          {t('families.title')}
        </Text>
        {list.map((family) => (
          <LinkRow
            key={family.id}
            href={{ pathname: '/family', params: { id: family.id } }}
            label={family.name}
          />
        ))}
        <LinkRow href="/tasks" label={t('task.all')} />
      </Screen>
    </FontScaleContext.Provider>
  );
}
