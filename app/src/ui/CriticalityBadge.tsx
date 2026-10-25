import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

/** The only sign of criticality: «High», white on the danger colour. */
export function CriticalityBadge({ label }: { label: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.danger,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
      }}
    >
      <Text variant="caption" style={{ color: colors.onAccent, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}
