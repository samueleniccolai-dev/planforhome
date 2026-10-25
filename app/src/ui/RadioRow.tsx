import { useId, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

/** A group of radios with its visible heading above; the rows go in a column. */
export function RadioGroup({ label, children }: { label: string; children: ReactNode }) {
  const { space } = useTheme();
  const labelId = `${useId()}-label`;
  return (
    <View style={{ gap: space.xs }}>
      <Text nativeID={labelId} variant="bodyStrong">
        {label}
      </Text>
      <View role="radiogroup" aria-labelledby={labelId}>
        {children}
      </View>
    </View>
  );
}

/** A row of at least 48 dp; the chosen one has a filled dot, so it reads without colour. */
export function RadioRow({
  label,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  const { colors, size, space } = useTheme();
  return (
    <Pressable
      role="radio"
      aria-checked={selected}
      aria-label={label}
      disabled={disabled}
      onPress={() => {
        if (!disabled) onSelect();
      }}
      style={({ pressed }) => ({
        minHeight: size.touch,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <View
        aria-hidden
        style={{
          width: size.checkbox,
          height: size.checkbox,
          borderRadius: size.checkbox / 2,
          borderWidth: 2,
          borderColor: selected ? colors.accent : colors.borderStrong,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? (
          <View
            style={{
              width: size.checkbox / 2,
              height: size.checkbox / 2,
              borderRadius: size.checkbox / 4,
              backgroundColor: colors.accent,
            }}
          />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
      </View>
    </Pressable>
  );
}
