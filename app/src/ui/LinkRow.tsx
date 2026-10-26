import { Link, type Href } from 'expo-router';
import { Pressable } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';

/** A navigation link of the kit: a real link with the text as name, 48 dp high, underlined. */
export function LinkRow({ href, label }: { href: Href; label: string }) {
  const { colors, size, space } = useTheme();
  return (
    <Link href={href} asChild>
      <Pressable
        role="link"
        aria-label={label}
        style={{ minHeight: size.touch, justifyContent: 'center', paddingVertical: space.xs }}
      >
        <Text style={{ color: colors.accent, textDecorationLine: 'underline' }}>{label}</Text>
      </Pressable>
    </Link>
  );
}
