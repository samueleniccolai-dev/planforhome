import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { me } from '@/api/client';
import { useLocale } from '@/i18n';
import { createOpener } from '@/push/push';
import { getRuntime } from '@/sync/runtime';
import { ThemeProvider } from '@/ui/theme';

export default function RootLayout() {
  const router = useRouter();
  // Android: a tap on a notification opens the task; the opener waits for the router to be mounted.
  useEffect(() => {
    const opener = createOpener((href) => router.push(href as never));
    void opener?.ready();
    return () => opener?.dispose();
  }, [router]);

  // Android: open the local database and start syncing if a token is stored (web: nothing).
  useEffect(() => {
    void getRuntime().then((runtime) => runtime?.session.start());
  }, []);

  // Web: after a reload with a valid session the language of the account comes back.
  useEffect(() => {
    if (Platform.OS === 'web') void me();
  }, []);

  // Web: <html lang> follows the language on screen (WCAG 3.1.1).
  const locale = useLocale();
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.lang = locale;
  }, [locale]);

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
