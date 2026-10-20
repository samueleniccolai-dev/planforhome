import { Link } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n';

export default function Home() {
  const t = useT();

  return (
    <View style={styles.container}>
      <Text role="heading" aria-level={1} style={styles.title}>
        {t('home.title')}
      </Text>
      <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      {Platform.OS === 'web' ? <Link href="/login">{t('home.signIn')}</Link> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center' },
});
