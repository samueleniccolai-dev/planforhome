import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import { ConfirmDialog, type ConfirmDialogProps } from '../ConfirmDialog';

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/i18n', () => ({
  deviceLocale: () => 'it',
  currentLocale: () => 'it',
  useT: () => (key: string) => key,
}));

const base: ConfirmDialogProps = {
  title: 'Remove the trip?',
  consequence: 'The trip disappears.',
  confirmLabel: 'Remove',
  cancelLabel: 'Keep',
  onConfirm: () => {},
  onCancel: () => {},
};

async function render(props: Partial<ConfirmDialogProps>) {
  const root = createRoot();
  await act(async () => {
    root.render(<ConfirmDialog {...base} {...props} />);
  });
  return root.container;
}

const byLabel = (view: TestInstance, label: string) =>
  view.queryAll((n) => n.props.accessibilityLabel === label, { matchDeepestOnly: true })[0];
const tap = (node: TestInstance) =>
  act(async () => {
    node.props.onClick({ stopPropagation() {}, preventDefault() {} });
  });

describe('ConfirmDialog', () => {
  it('writes the consequence and uses it as the description of the confirm button', async () => {
    const view = await render({});
    expect(JSON.stringify(view.toJSON())).toContain('The trip disappears.');
    const confirm = byLabel(view, 'Remove');
    const id = confirm.props['aria-describedby'];
    expect(id).toBeTruthy();
    expect(view.queryAll((n) => n.props.nativeID === id)).not.toHaveLength(0);
    expect(confirm.props.accessibilityHint).toBe('The trip disappears.');
  });

  it('confirms and cancels with their buttons, and «Close» cancels', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    const view = await render({ onConfirm, onCancel });
    await tap(byLabel(view, 'Remove'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await tap(byLabel(view, 'Keep'));
    await tap(byLabel(view, 'common.close'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('does not confirm while busy', async () => {
    const onConfirm = jest.fn();
    const view = await render({ busy: true, onConfirm });
    await tap(byLabel(view, 'Remove'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not confirm when disabled, and the reason is the description', async () => {
    const onConfirm = jest.fn();
    const view = await render({
      consequence: undefined,
      confirmDisabled: true,
      disabledReason: 'Choose one.',
      onConfirm,
    });
    await tap(byLabel(view, 'Remove'));
    expect(onConfirm).not.toHaveBeenCalled();
    const confirm = byLabel(view, 'Remove');
    expect(confirm.props.accessibilityHint).toBe('Choose one.');
    const reason = view.queryAll((n) => n.props.nativeID === confirm.props['aria-describedby']);
    expect(JSON.stringify(reason[0].toJSON())).toContain('Choose one.');
  });
});
