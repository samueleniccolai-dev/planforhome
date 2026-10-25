import { View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

export type NoticeTone = 'notice' | 'danger' | 'success';

export function InlineNotice({
  tone = 'notice',
  children,
  action,
  role = 'alert',
}: {
  tone?: NoticeTone;
  /** `status` for a notice that is not the answer to a tap: polite, never interrupts. */
  role?: 'alert' | 'status';
  children: string;
  /** A text button inside the notice, e.g. to undo. */
  action?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  const { colors, radius, space } = useTheme();
  const palette = {
    notice: { bg: colors.notice, fg: colors.onNotice, border: colors.onNotice },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger },
    success: { bg: colors.surface, fg: colors.success, border: colors.success },
  }[tone];
  return (
    <View
      role={role}
      {...(role === 'status'
        ? ({ 'aria-live': 'polite', accessibilityLiveRegion: 'polite' } as const)
        : null)}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space.md,
        gap: action ? space.xs : 0,
      }}
    >
      <Text style={{ color: palette.fg }}>{children}</Text>
      {action ? (
        <Button
          variant="text"
          label={action.label}
          onPress={action.onPress}
          disabled={action.disabled}
        />
      ) : null}
    </View>
  );
}
