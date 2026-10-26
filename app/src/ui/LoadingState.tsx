import { ActivityIndicator, View } from 'react-native';

import { useT } from '@/i18n';

import { Text } from './Text';
import { useTheme } from './theme';

/** «Loading…» with a spinner: the text is the status, the spinner only decorates. */
export function LoadingState() {
  const t = useT();
  const { colors, space } = useTheme();
  const text = t('common.loading');
  return (
    <View
      role="status"
      aria-label={text}
      aria-live="polite"
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingVertical: space.lg,
      }}
    >
      <ActivityIndicator
        color={colors.accent}
        aria-hidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text>{text}</Text>
    </View>
  );
}
