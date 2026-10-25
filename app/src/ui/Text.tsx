import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useFontScale, useTheme } from './theme';

export type TextVariant = 'title' | 'section' | 'body' | 'bodyStrong' | 'meta' | 'caption';
export type TextTone = 'default' | 'secondary' | 'danger' | 'success';

export type TextProps = Omit<RNTextProps, 'role' | 'aria-level'> & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Makes the text a heading; the variant alone never does. */
  heading?: 1 | 2;
};

export function Text({ variant = 'body', tone = 'default', heading, style, ...rest }: TextProps) {
  const theme = useTheme();
  const scale = useFontScale();
  const spec = theme.type[variant];
  const color = {
    default: theme.colors.text,
    secondary: theme.colors.textSecondary,
    danger: theme.colors.danger,
    success: theme.colors.success,
  }[tone];
  const upper = variant === 'section' ? ({ textTransform: 'uppercase' } as const) : null;
  return (
    <RNText
      {...rest}
      role={heading ? 'heading' : undefined}
      aria-level={heading}
      style={[
        styles.base,
        { ...spec, fontSize: spec.fontSize * scale, lineHeight: spec.lineHeight * scale, color },
        upper,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({ base: { flexShrink: 1 } });
