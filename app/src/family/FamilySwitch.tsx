import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { Family } from '@/api/client';
import { useT } from '@/i18n';
import { useTheme } from '@/ui/theme';

/** "Switch family" link at the top of every screen with a session; only with 2+ families. */
export function FamilySwitch({ families }: { families: Family[] | undefined }) {
  const t = useT();
  const { colors } = useTheme();
  if (!families || families.length < 2) return null;
  return (
    <View style={styles.bar}>
      <Link href="/families" aria-label={t('family.switch')} style={{ color: colors.accent }}>
        {t('family.switch')}
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({ bar: { alignSelf: 'flex-end' } });
