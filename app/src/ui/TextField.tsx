import { useId, type ComponentRef, type Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { useFontScale, useTheme } from './theme';

export type TextFieldProps = Omit<
  TextInputProps,
  'style' | 'aria-label' | 'aria-labelledby' | 'aria-invalid'
> & {
  label: string;
  error?: string;
  /** A line under the field, linked to it (`aria-describedby`). */
  hint?: string;
  /** To move the focus to the field. */
  innerRef?: Ref<ComponentRef<typeof TextInput>>;
};

export function TextField({ label, error, hint, innerRef, ...input }: TextFieldProps) {
  const { colors, type, radius, size, space } = useTheme();
  const scale = useFontScale();
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  return (
    <View style={{ gap: space.xs }}>
      <Text nativeID={labelId} variant="bodyStrong">
        {label}
      </Text>
      <TextInput
        {...input}
        ref={innerRef}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        aria-invalid={error ? true : undefined}
        placeholderTextColor={colors.textSecondary}
        style={{
          minHeight: size.touch,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.borderStrong,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
          color: colors.text,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          fontSize: type.body.fontSize * scale,
          lineHeight: type.body.lineHeight * scale,
        }}
      />
      {hint ? (
        <Text nativeID={hintId} variant="meta" tone="secondary">
          {hint}
        </Text>
      ) : null}
      {error ? <Text tone="danger">{error}</Text> : null}
    </View>
  );
}
