import { act } from 'react';
import { createRoot } from 'test-renderer';

import { LinkRow } from '../LinkRow';
import { size } from '../tokens';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactElement }) => children,
}));

describe('LinkRow', () => {
  it('is a link named by its text and at least 48 high', async () => {
    const root = createRoot();
    await act(async () => {
      root.render(<LinkRow href="/families" label="All families" />);
    });
    const [link] = root.container.queryAll((n) => n.props.role === 'link');
    expect(link.props.accessibilityLabel).toBe('All families');
    const style = [link.props.style].flat() as { minHeight?: number }[];
    expect(Math.max(...style.map((s) => s?.minHeight ?? 0))).toBeGreaterThanOrEqual(48);
    expect(size.touch).toBeGreaterThanOrEqual(48);
  });
});
