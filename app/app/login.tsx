import { useRouter } from 'expo-router';
import { useState } from 'react';

import { families, login, me, type LoginOutcome } from '@/api/client';
import { landing } from '@/family/logic';
import { useT } from '@/i18n';
import { getRuntime } from '@/sync/runtime';
import { Button } from '@/ui/Button';
import { InlineNotice } from '@/ui/InlineNotice';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

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
    // Android signs in with a token and starts the sync; the web keeps its cookies.
    const runtime = await getRuntime();
    const outcome = runtime
      ? await runtime.session.signIn(email, password)
      : await login(email, password);
    if (outcome !== 'ok') {
      setBusy(false);
      setFailure(outcome);
      return;
    }
    // The account language comes with `me()`; a failure there must not stop the login.
    await me();
    // Stay busy until the navigation: a second click must not send a second login.
    router.replace(landing(await families()) as never);
  }

  return (
    <Screen>
      <Text variant="title" heading={1}>
        {t('login.title')}
      </Text>
      <TextField
        label={t('login.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextField
        label={t('login.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />
      {failure ? <InlineNotice tone="danger">{t(`login.${failure}`)}</InlineNotice> : null}
      <Button label={t('login.submit')} disabled={busy} onPress={submit} />
    </Screen>
  );
}
