import { useCallback, useEffect, useId, useRef, type ComponentRef, type ReactNode } from 'react';
import { View, type Pressable } from 'react-native';

import { Button } from './Button';
import { Sheet, SheetBody, SheetFooter } from './Sheet';
import { Text } from './Text';
import { useTheme } from './theme';

export type ConfirmDialogProps = {
  /** The name of the dialog and its visible title. */
  title: string;
  /** What happens if the person confirms; always written above the buttons. */
  consequence?: string;
  /** Makes the consequence an alert with this name (a warning that matters more than the rest). */
  consequenceAlert?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'destructive' | 'primary';
  busy?: boolean;
  confirmDisabled?: boolean;
  /** Why the confirmation is disabled; it describes the button while it is. */
  disabledReason?: string;
  onConfirm: () => void;
  /** «Close», Esc and Back call it too. Keep it stable (`useCallback`). */
  onCancel: () => void;
  /** Above the consequence: for example the choice of a family. */
  children?: ReactNode;
};

/**
 * A confirmation on the `Sheet`: the consequence is written before the buttons and describes the
 * confirm button. The focus starts on the cancel button, the least destructive one.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  // react-native-web registers the Esc listener again for every new function: keep one.
  const latest = useRef(props.onCancel);
  useEffect(() => {
    latest.current = props.onCancel;
  });
  const close = useCallback(() => latest.current(), []);
  return (
    <Sheet title={props.title} onClose={close}>
      <ConfirmContent {...props} />
    </Sheet>
  );
}

type Focusable = { isConnected?: boolean; focus?: () => void };

/** The element with the focus, on the web; Android has none. */
function activeElement(): Focusable | undefined {
  const page = globalThis as { document?: { activeElement?: Focusable | null } };
  return page.document?.activeElement ?? undefined;
}

function ConfirmContent({
  consequence,
  consequenceAlert,
  confirmLabel,
  cancelLabel,
  tone = 'destructive',
  busy,
  confirmDisabled,
  disabledReason,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const { space } = useTheme();
  const id = useId();
  const cancel = useRef<ComponentRef<typeof Pressable>>(null);
  // In the content of the Modal and after the mount, so the focus trap has saved the opener.
  useEffect(() => {
    const opener = activeElement();
    (cancel.current as { focus?: () => void } | null)?.focus?.();
    // On the web the opener gets the focus back when the dialog closes, if it is still there.
    return () => {
      if (opener?.isConnected) opener.focus?.();
    };
  }, []);
  const reasonId = `${id}-reason`;
  const consequenceId = `${id}-consequence`;
  const showReason = confirmDisabled === true && !!disabledReason;
  const description = showReason ? disabledReason : consequence;
  const describedBy = showReason ? reasonId : consequence ? consequenceId : undefined;
  return (
    <>
      <SheetBody>
        {children}
        {consequence ? (
          <View
            role={consequenceAlert ? 'alert' : undefined}
            aria-label={consequenceAlert}
            style={{ gap: space.xs }}
          >
            <Text nativeID={consequenceId}>{consequence}</Text>
          </View>
        ) : null}
        {showReason ? (
          <Text nativeID={reasonId} tone="secondary">
            {disabledReason}
          </Text>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <Button
          variant={tone}
          label={confirmLabel}
          disabled={busy || confirmDisabled}
          describedBy={describedBy}
          hint={description}
          onPress={onConfirm}
        />
        <Button variant="secondary" label={cancelLabel} innerRef={cancel} onPress={onCancel} />
      </SheetFooter>
    </>
  );
}
