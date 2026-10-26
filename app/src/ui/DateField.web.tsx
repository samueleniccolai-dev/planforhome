import { useId } from 'react';
import { View } from 'react-native';

import { currentLocale, useT } from '@/i18n';

import { Button } from './Button';
import type { DateFieldProps } from './DateField';
import { longDay } from './day';
import { Text } from './Text';
import { useFontScale, useTheme } from './theme';

/** The browser's own date picker (keyboard included); the value is `yyyy-mm-dd`. */
export function DateField({ label, value, onChange }: DateFieldProps) {
  const t = useT();
  const locale = currentLocale();
  const { colors, type, radius, size, space } = useTheme();
  const scale = useFontScale();
  const labelId = `${useId()}-label`;
  return (
    <View style={{ gap: space.xs }}>
      <Text nativeID={labelId} variant="bodyStrong">
        {label}
      </Text>
      <input
        type="date"
        role="textbox"
        aria-labelledby={labelId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          boxSizing: 'border-box',
          minHeight: size.touch,
          width: '100%',
          border: `1px solid ${colors.borderStrong}`,
          borderRadius: radius.sm,
          backgroundColor: colors.surface,
          color: colors.text,
          padding: `${space.sm}px ${space.md}px`,
          font: 'inherit',
          fontSize: type.body.fontSize * scale,
        }}
      />
      <Text>{value ? longDay(value, locale) : t('date.none')}</Text>
      {value ? (
        <Button variant="text" label={t('date.clear')} onPress={() => onChange('')} />
      ) : null}
    </View>
  );
}
