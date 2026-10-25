import { guardPress } from '../Button';

describe('guardPress', () => {
  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    guardPress(true, onPress)();
    expect(onPress).not.toHaveBeenCalled();
  });
  it('calls onPress when enabled', () => {
    const onPress = jest.fn();
    guardPress(false, onPress)();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
