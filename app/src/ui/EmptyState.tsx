import { View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

/** A title, one line, and maybe the action that fills the emptiness. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { label: string; onPress: () => void };
}) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.sm, paddingVertical: space.lg }}>
      <Text variant="bodyStrong">{title}</Text>
      {hint ? <Text variant="meta">{hint}</Text> : null}
      {action ? <Button variant="primary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
