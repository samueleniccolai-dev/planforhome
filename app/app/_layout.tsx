import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { getRuntime } from '@/sync/runtime';

export default function RootLayout() {
  // Android: open the local database and start syncing if a token is stored (web: nothing).
  useEffect(() => {
    void getRuntime().then((runtime) => runtime?.session.start());
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
