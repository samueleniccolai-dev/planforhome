import { act } from 'react';
import { createRoot } from 'test-renderer';

import { ListRow } from '../ListRow';
import { Text } from '../Text';

const flat = (style: unknown) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

describe('ListRow', () => {
  it('is a listitem and has no actions row when none are given', async () => {
    const root = createRoot();
    await act(async () => {
      root.render(
        <ListRow>
          <Text>Eggs</Text>
        </ListRow>,
      );
    });
    expect(root.container.queryAll((n) => n.props.role === 'listitem')).toHaveLength(1);
    expect(root.container.queryAll((n) => n.props.testID === 'list-row-actions')).toHaveLength(0);
  });

  it('wraps every action in a container that can shrink to the width', async () => {
    const root = createRoot();
    await act(async () => {
      root.render(
        <ListRow actions={[<Text key="a">A</Text>, <Text key="b">B</Text>]}>
          <Text>Eggs</Text>
        </ListRow>,
      );
    });
    const [actions] = root.container.queryAll((n) => n.props.testID === 'list-row-actions');
    expect(flat(actions.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    const wrappers = root.container.queryAll((n) => n.props.testID === 'list-row-action');
    expect(wrappers).toHaveLength(2);
    for (const w of wrappers) {
      expect(flat(w.props.style)).toMatchObject({ maxWidth: '100%', flexShrink: 1 });
    }
  });
});
