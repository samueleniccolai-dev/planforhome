import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from './theme';

/**
 * One row of a list: the content in a column and, if given, the actions in a row that wraps.
 * Every action may shrink to the width of the row, so a long label wraps inside its button.
 */
export function ListRow({ children, actions }: { children: ReactNode; actions?: ReactNode[] }) {
  const { colors, space } = useTheme();
  return (
    <View
      role="listitem"
      style={{
        gap: space.xs,
        paddingVertical: space.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {children}
      {actions && actions.length > 0 ? (
        <View
          testID="list-row-actions"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
        >
          {actions.map((action, i) => (
            <View key={i} testID="list-row-action" style={{ maxWidth: '100%', flexShrink: 1 }}>
              {action}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
