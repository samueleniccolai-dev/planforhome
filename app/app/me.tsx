import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { logout, me, refresh } from '@/api/client';
import { useT } from '@/i18n';

export default function Me() {
  const t = useT();
  const router = useRouter();
  const [name, setName] = useState<string | undefined>();

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
      await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function signOut() {
    await logout();
    router.replace('/login');
  }

  if (name === undefined) return null;

  return (
    <View style={styles.container}>
      <Text role="heading" aria-level={1} style={styles.title}>
        {t('me.greeting', { name })}
      </Text>
      <Pressable role="button" aria-label={t('me.signOut')} onPress={signOut} style={styles.button}>
        <Text style={styles.buttonText}>{t('me.signOut')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  button: {
    backgroundColor: '#1f5fbf',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
