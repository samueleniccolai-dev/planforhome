import { Link } from 'expo-router';

import { useT } from '@/i18n';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { useTheme } from '@/ui/theme';

export default function Home() {
  const t = useT();
  const { colors } = useTheme();

  return (
    <Screen>
      <Text variant="title" heading={1}>
        {t('home.title')}
      </Text>
      <Text>{t('home.subtitle')}</Text>
      <Link href="/login" style={{ color: colors.accent }}>
        {t('home.signIn')}
      </Link>
    </Screen>
  );
}
