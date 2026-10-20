import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { families, type Family } from '@/api/client';
import { landing } from '@/family/logic';
import { useT } from '@/i18n';

export default function Families() {
  const t = useT();
  const router = useRouter();
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
      <View style={styles.container}>
        <Text role="alert">{t('families.error')}</Text>
      </View>
    );
  }
  if (!list) return null;

  return (
    <View style={styles.container}>
      <Text role="heading" aria-level={1} style={styles.title}>
        {t('families.title')}
      </Text>
      {list.map((family) => (
        <Link key={family.id} href={{ pathname: '/family', params: { id: family.id } }}>
          {family.name}
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
});
