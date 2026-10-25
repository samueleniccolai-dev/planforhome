import { Pressable, View } from 'react-native';

import { Checkbox } from './Checkbox';
import { Text } from './Text';
import { useTheme } from './theme';

/** The whole row is the checkbox: a tap on the text toggles it. The drawn tick reads without colour. */
export function CheckRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const { size, space } = useTheme();
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onPress={() => {
        if (!disabled) onChange?.(!checked);
      }}
      style={({ pressed }) => ({
        minHeight: size.touch,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <Checkbox decorative label={label} checked={checked} />
      <View style={{ flex: 1 }}>
        <Text>{label}</Text>
      </View>
    </Pressable>
  );
}
