import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

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

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
