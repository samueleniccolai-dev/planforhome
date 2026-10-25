import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from './theme';

/** A landmark with a name: screen readers jump to it. */
export function Region({ label, children }: { label: string; children: ReactNode }) {
  const { space } = useTheme();
  return (
    <View role="region" aria-label={label} style={{ gap: space.sm }}>
      {children}
    </View>
  );
}
