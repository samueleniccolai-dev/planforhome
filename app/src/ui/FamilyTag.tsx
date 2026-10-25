import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

/** The family of a task in the aggregate views: neutral text, never a colour. */
export function FamilyTag({ name }: { name: string }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.tagBg,
        borderRadius: radius.sm,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
      }}
    >
      <Text variant="caption" tone="secondary">
        {name}
      </Text>
    </View>
  );
}
