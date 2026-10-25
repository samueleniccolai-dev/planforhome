import type { ReactNode } from 'react';
import { Modal, ScrollView, useWindowDimensions, View } from 'react-native';

import { useT } from '@/i18n';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

const WIDE = 768;
const PANEL_WIDTH = 640;

/**
 * A modal panel: from the bottom on a phone, centred and wide on a big screen. It is shown while
 * it is rendered: closing unmounts it, so its content never keeps a state between two openings.
 * The browser gives `role="dialog"`, `aria-modal`, the focus trap, Esc and the focus back; the
 * name of the dialog is its visible title. Inside: a `SheetBody` that scrolls and, if the main
 * action must stay in sight, a `SheetFooter` under it.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const { colors, radius, space } = useTheme();
  const { width } = useWindowDimensions();
  const centred = width >= WIDE;
  return (
    <Modal transparent animationType="none" onRequestClose={onClose} aria-label={title}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: centred ? 'center' : 'flex-end',
          padding: centred ? space.xxl : 0,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: colors.text,
            opacity: 0.4,
          }}
        />
        <View
          style={{
            width: '100%',
            maxWidth: PANEL_WIDTH,
            maxHeight: '92%',
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderBottomLeftRadius: centred ? radius.lg : 0,
            borderBottomRightRadius: centred ? radius.lg : 0,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: space.sm,
              paddingHorizontal: space.lg,
              paddingTop: space.md,
            }}
          >
            <Text variant="title" heading={2}>
              {title}
            </Text>
            <Button variant="text" label={t('common.close')} onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export function SheetBody({ children }: { children: ReactNode }) {
  const { space } = useTheme();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: space.lg, gap: space.md }}
    >
      {children}
    </ScrollView>
  );
}

/** Outside the scroll: the main action and the reason it cannot be used are always in sight. */
export function SheetFooter({ children }: { children: ReactNode }) {
  const { colors, space } = useTheme();
  return (
    <View
      style={{
        gap: space.sm,
        padding: space.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {children}
    </View>
  );
}
