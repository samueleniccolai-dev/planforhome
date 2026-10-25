import { View } from 'react-native';

import { initials, onPersonTint, personTint } from './personTint';
import { Text } from './Text';
import { useFontScale, useTheme } from './theme';

/** Initials on the tint of the person, then the text in `type.meta` (never the tint alone). */
export function PersonBadge({
  personId,
  name,
  label,
}: {
  personId: string;
  name: string;
  /** The visible text; the name when missing. */
  label?: string;
}) {
  const { colors, size, space } = useTheme();
  const scale = useFontScale();
  const tint = personTint(personId);
  const diameter = size.avatar * scale;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
      <View
        aria-hidden
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: colors.person[tint],
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text variant="caption" style={{ color: onPersonTint(tint), fontWeight: '700' }}>
          {initials(name)}
        </Text>
      </View>
      <Text variant="meta">{label ?? name}</Text>
    </View>
  );
}
