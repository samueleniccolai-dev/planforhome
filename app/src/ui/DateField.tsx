import { useId, useState } from 'react';
import { Pressable, View } from 'react-native';

import { currentLocale, useT } from '@/i18n';

import { Button } from './Button';
import { longDay, monthCells, monthTitle, shiftMonth, weekdayInitials } from './day';
import { Text } from './Text';
import { useTheme } from './theme';

export type DateFieldProps = {
  label: string;
  /** `yyyy-mm-dd`, or empty for no date. */
  value: string;
  onChange: (value: string) => void;
  /** Today in the zone of the family (`yyyy-mm-dd`): «Today» and the first month come from it. */
  today: string;
};

/** The value is always written; a grid of the month made of the kit's buttons picks the day. */
export function DateField({ label, value, onChange, today }: DateFieldProps) {
  const t = useT();
  const { colors, radius, size, space } = useTheme();
  const locale = currentLocale();
  const labelId = `${useId()}-label`;
  const [month, setMonth] = useState((value || today).slice(0, 7));
  const pick = (day: string) => {
    onChange(day);
    setMonth(day.slice(0, 7));
  };
  return (
    <View role="group" aria-labelledby={labelId} style={{ gap: space.xs }}>
      <Text nativeID={labelId} variant="bodyStrong">
        {label}
      </Text>
      <Text>{value ? longDay(value, locale) : t('date.none')}</Text>
      {value ? (
        <Button variant="text" label={t('date.clear')} onPress={() => onChange('')} />
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Button
          variant="secondary"
          label={t('date.prev')}
          onPress={() => setMonth(shiftMonth(month, -1))}
        />
        <Button
          variant="secondary"
          label={t('date.next')}
          onPress={() => setMonth(shiftMonth(month, 1))}
        />
      </View>
      <Button variant="text" label={t('date.today')} onPress={() => pick(today)} />
      <Text variant="bodyStrong">{monthTitle(month, locale)}</Text>
      <View style={{ flexDirection: 'row' }} aria-hidden>
        {weekdayInitials(locale).map((initial, i) => (
          <Text key={i} variant="caption" tone="secondary" style={{ flex: 1, textAlign: 'center' }}>
            {initial}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {monthCells(month).map((day, i) =>
          day ? (
            <Pressable
              key={day}
              role="button"
              aria-label={longDay(day, locale)}
              aria-pressed={day === value}
              onPress={() => pick(day)}
              style={({ pressed }) => ({
                width: `${100 / 7}%`,
                minHeight: size.touch,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.sm,
                backgroundColor: day === value ? colors.accent : 'transparent',
                borderWidth: 1,
                borderColor: day === today ? colors.accent : 'transparent',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: day === value ? colors.onAccent : colors.text }}>
                {String(Number(day.slice(8)))}
              </Text>
            </Pressable>
          ) : (
            <View key={`pad-${i}`} style={{ width: `${100 / 7}%`, minHeight: size.touch }} />
          ),
        )}
      </View>
    </View>
  );
}
