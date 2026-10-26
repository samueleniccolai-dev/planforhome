import { act } from 'react';
import { createRoot } from 'test-renderer';

import { LoadingState } from '../LoadingState';

describe('LoadingState', () => {
  it('is a polite status named by its text, the spinner hidden', async () => {
    const root = createRoot();
    await act(async () => {
      root.render(<LoadingState />);
    });
    const [status] = root.container.queryAll((n) => n.props.role === 'status');
    expect(status.props['aria-label']).toBe('Loading…');
    expect(status.props['aria-live']).toBe('polite');
    expect(status.props.accessibilityLiveRegion).toBe('polite');
    const [spinner] = root.container.queryAll(
      (n) => n.props.importantForAccessibility === 'no-hide-descendants',
    );
    expect(spinner).toBeDefined();
  });
});
