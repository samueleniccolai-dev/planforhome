import { act } from 'react';
import { createRoot } from 'test-renderer';

import { InlineNotice } from '../InlineNotice';

async function render(element: React.ReactElement) {
  const root = createRoot();
  await act(async () => {
    root.render(element);
  });
  return root.container;
}

describe('InlineNotice role', () => {
  it('is an alert by default', async () => {
    const view = await render(<InlineNotice>Oops</InlineNotice>);
    expect(view.queryAll((n) => n.props.role === 'alert')).toHaveLength(1);
    expect(view.queryAll((n) => n.props['aria-live'] !== undefined)).toHaveLength(0);
  });

  it('is a polite status on request', async () => {
    const view = await render(<InlineNotice role="status">Later</InlineNotice>);
    expect(view.queryAll((n) => n.props.role === 'alert')).toHaveLength(0);
    const [status] = view.queryAll((n) => n.props.role === 'status');
    expect(status.props['aria-live']).toBe('polite');
    expect(status.props.accessibilityLiveRegion).toBe('polite');
  });
});
