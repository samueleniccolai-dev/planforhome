import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

export type TabOption<K extends string> = { key: K; label: string };

/** One choice among a few, always visible: a `tablist` of `tab`s with at least 48 dp each. */
export function FilterTabs<K extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: TabOption<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  const { colors, radius, size, space } = useTheme();
  return (
    <View
      role="tablist"
      aria-label={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
    >
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <Pressable
            key={option.key}
            role="tab"
            aria-selected={selected}
            onPress={() => onChange(option.key)}
            style={{
              minHeight: size.touch,
              justifyContent: 'center',
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.borderStrong,
              backgroundColor: selected ? colors.accentTonal : colors.surface,
            }}
          >
            <Text
              variant={selected ? 'bodyStrong' : 'body'}
              style={{ color: selected ? colors.onAccentTonal : colors.text }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
