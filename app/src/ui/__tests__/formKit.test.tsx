import { act } from 'react';
import { createRoot, type TestInstance } from 'test-renderer';

import { dayIn } from '@/task/filters';

import { CheckRow } from '../CheckRow';
import { DateField } from '../DateField';
import { RadioGroup, RadioRow } from '../RadioRow';
import { Sheet } from '../Sheet';
import { TextField } from '../TextField';

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));
jest.mock('@/i18n', () => ({
  deviceLocale: () => 'it',
  currentLocale: () => 'it',
  useT: () => (key: string) => key,
}));

async function render(element: React.ReactElement) {
  const root = createRoot();
  await act(async () => {
    root.render(element);
  });
  return root.container;
}

const byRole = (view: TestInstance, role: string) =>
  view.queryAll((n) => n.props.role === role, { matchDeepestOnly: true });
const byLabel = (view: TestInstance, label: string) =>
  view.queryAll((n) => n.props.accessibilityLabel === label, { matchDeepestOnly: true });
const tap = (node: TestInstance) =>
  act(async () => {
    node.props.onClick({ stopPropagation() {}, preventDefault() {} });
  });

describe('CheckRow', () => {
  it('is one checkbox for the whole row and toggles', async () => {
    const onChange = jest.fn();
    const view = await render(<CheckRow label="Remind me" checked={false} onChange={onChange} />);
    const boxes = byRole(view, 'checkbox');
    expect(boxes).toHaveLength(1);
    expect(boxes[0].props.accessibilityState?.checked).toBe(false);
    await tap(boxes[0]);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does nothing when disabled', async () => {
    const onChange = jest.fn();
    const view = await render(<CheckRow label="Adults" checked disabled onChange={onChange} />);
    await tap(byRole(view, 'checkbox')[0]);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('RadioGroup', () => {
  it('labels the group and marks one radio', async () => {
    const onSelect = jest.fn();
    const view = await render(
      <RadioGroup label="Who">
        <RadioRow label="Giulia" selected onSelect={() => {}} />
        <RadioRow label="Leo" selected={false} onSelect={onSelect} />
      </RadioGroup>,
    );
    const [group] = byRole(view, 'radiogroup');
    expect(group.props['aria-labelledby']).toBeTruthy();
    const radios = byRole(view, 'radio');
    expect(radios.map((r) => r.props.accessibilityState?.checked)).toEqual([true, false]);
    await tap(radios[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

describe('Sheet', () => {
  it('names the dialog by its title and closes with the button', async () => {
    const onClose = jest.fn();
    const view = await render(
      <Sheet title="Panel" onClose={onClose}>
        {null}
      </Sheet>,
    );
    expect(JSON.stringify(view.toJSON())).toContain('Panel');
    await tap(byLabel(view, 'common.close')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('TextField hint', () => {
  it('links the hint to the field', async () => {
    const view = await render(<TextField label="Note" hint="Only the family" />);
    const [input] = view.queryAll((n) => n.props['aria-labelledby'] !== undefined);
    const hintId = input.props['aria-describedby'];
    expect(hintId).toBeTruthy();
    expect(view.queryAll((n) => n.props.nativeID === hintId)).not.toHaveLength(0);
  });
});

describe('DateField (grid)', () => {
  const days = (view: TestInstance) =>
    view.queryAll((n) => /\d{4}$/.test(String(n.props.accessibilityLabel ?? '')), {
      matchDeepestOnly: true,
    });

  it('shows October 2026 with 31 days, also across the summer-time change', async () => {
    const view = await render(
      <DateField label="Due" value="" onChange={() => {}} today="2026-10-28" />,
    );
    expect(days(view)).toHaveLength(31);
    expect(byLabel(view, 'mercoledì 28 ottobre 2026')).toHaveLength(1);
    expect(JSON.stringify(view.toJSON())).toContain('date.none');
  });

  it('«Today» is the day of the family zone near midnight', async () => {
    // 23:30 UTC on the 28th is already the 29th in Rome.
    const today = dayIn(new Date(Date.UTC(2026, 9, 28, 23, 30)), 'Europe/Rome');
    expect(today).toBe('2026-10-29');
    const onChange = jest.fn();
    const view = await render(<DateField label="Due" value="" onChange={onChange} today={today} />);
    await tap(byLabel(view, 'date.today')[0]);
    expect(onChange).toHaveBeenCalledWith('2026-10-29');
  });

  it('moves between months and clears the value', async () => {
    const onChange = jest.fn();
    const view = await render(
      <DateField label="Due" value="2026-10-30" onChange={onChange} today="2026-10-28" />,
    );
    await tap(byLabel(view, 'date.next')[0]);
    expect(days(view)).toHaveLength(30);
    expect(byLabel(view, 'domenica 1 novembre 2026')).toHaveLength(1);
    await tap(byLabel(view, 'date.prev')[0]);
    await tap(byLabel(view, 'date.prev')[0]);
    expect(days(view)).toHaveLength(30);
    await tap(byLabel(view, 'date.clear')[0]);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
