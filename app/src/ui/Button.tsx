import { Pressable, StyleSheet } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'text';

/** The press handler, unless the button is disabled. */
export function guardPress(disabled: boolean | undefined, onPress: (() => void) | undefined) {
  return () => {
    if (disabled) return;
    onPress?.();
  };
}

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', disabled }: ButtonProps) {
  const { colors, size, radius, space } = useTheme();
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.accentTonal, fg: colors.onAccentTonal, border: colors.accentTonal },
    destructive: { bg: colors.danger, fg: colors.onAccent, border: colors.danger },
    text: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
  }[variant];
  return (
    <Pressable
      role="button"
      aria-label={label}
      disabled={disabled}
      onPress={guardPress(disabled, onPress)}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: variant === 'primary' ? size.touchPrimary : size.touch,
          borderRadius: radius.md,
          paddingHorizontal: space.xxl,
          paddingVertical: space.sm,
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Text
        variant="bodyStrong"
        style={{
          color: palette.fg,
          textAlign: 'center',
          textDecorationLine: disabled ? 'line-through' : 'none',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, alignSelf: 'stretch' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
});
