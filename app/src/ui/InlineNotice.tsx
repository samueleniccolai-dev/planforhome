import { View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

export type NoticeTone = 'notice' | 'danger' | 'success';

export function InlineNotice({
  tone = 'notice',
  children,
}: {
  tone?: NoticeTone;
  children: string;
}) {
  const { colors, radius, space } = useTheme();
  const palette = {
    notice: { bg: colors.notice, fg: colors.onNotice, border: colors.onNotice },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.danger },
    success: { bg: colors.surface, fg: colors.success, border: colors.success },
  }[tone];
  return (
    <View
      role="alert"
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: space.md,
      }}
    >
      <Text style={{ color: palette.fg }}>{children}</Text>
    </View>
  );
}
