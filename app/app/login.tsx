import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { login, type LoginOutcome } from '@/api/client';
import { useT } from '@/i18n';

export default function Login() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Exclude<LoginOutcome, 'ok'> | undefined>();

  async function submit() {
    setBusy(true);
    setFailure(undefined);
    const outcome = await login(email, password);
    setBusy(false);
    if (outcome === 'ok') router.replace('/me');
    else setFailure(outcome);
  }

  return (
    <View style={styles.container}>
      <Text role="heading" aria-level={1} style={styles.title}>
        {t('login.title')}
      </Text>
      <TextInput
        aria-label={t('login.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        aria-label={t('login.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        style={styles.input}
      />
      {failure ? (
        <Text role="alert" style={styles.alert}>
          {t(`login.${failure}`)}
        </Text>
      ) : null}
      <Pressable
        role="button"
        aria-label={t('login.submit')}
        disabled={busy}
        onPress={submit}
        style={styles.button}
      >
        <Text style={styles.buttonText}>{t('login.submit')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  input: { width: 280, borderWidth: 1, borderColor: '#888', borderRadius: 6, padding: 10 },
  alert: { color: '#b00020' },
  button: {
    backgroundColor: '#1f5fbf',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600' },
});
