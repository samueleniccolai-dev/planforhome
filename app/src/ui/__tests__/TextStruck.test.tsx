import { act } from 'react';
import { createRoot } from 'test-renderer';

import { Text } from '../Text';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

async function styleOf(struck?: boolean) {
  const root = createRoot();
  await act(async () => {
    root.render(<Text struck={struck}>Salt</Text>);
  });
  const [node] = root.container.queryAll((n) => n.props.children === 'Salt');
  return flat(node.props.style);
}

describe('Text struck', () => {
  it('draws a line through the text', async () => {
    expect((await styleOf(true)).textDecorationLine).toBe('line-through');
  });
  it('has no line by default', async () => {
    expect((await styleOf()).textDecorationLine).toBeUndefined();
  });
});
