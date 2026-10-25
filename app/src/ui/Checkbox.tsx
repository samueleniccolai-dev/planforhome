import { Pressable, View } from 'react-native';

import { useTheme } from './theme';

/** A 28 dp box inside a 48 dp target. `onPress` is absent for a box that cannot change. */
export function Checkbox({
  label,
  checked,
  disabled,
  onPress,
  decorative,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** Only the drawing: the row that holds it is the checkbox (`CheckRow`). */
  decorative?: boolean;
}) {
  const { colors, radius, size } = useTheme();
  const off = disabled || !onPress;
  const frame = {
    width: size.touch,
    height: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled && !checked ? 0.45 : 1,
  } as const;
  const box = (
    <View
      style={{
        width: size.checkbox,
        height: size.checkbox,
        borderRadius: radius.sm / 2,
        borderWidth: 2,
        borderColor: checked ? colors.accent : colors.borderStrong,
        backgroundColor: checked ? colors.accent : colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? (
        <View
          style={{
            width: 8,
            height: 15,
            marginTop: -3,
            borderRightWidth: 3,
            borderBottomWidth: 3,
            borderColor: colors.onAccent,
            transform: [{ rotate: '45deg' }],
          }}
        />
      ) : null}
    </View>
  );
  if (decorative) {
    return (
      <View aria-hidden style={frame}>
        {box}
      </View>
    );
  }
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={off}
      onPress={() => {
        if (!off) onPress?.();
      }}
      style={frame}
    >
      {box}
    </Pressable>
  );
}
