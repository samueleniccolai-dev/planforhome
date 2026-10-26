import { useLocalSearchParams } from 'expo-router';

import { ShoppingList } from '@/shopping/ShoppingList';
import { FontScaleContext, parseFontScale } from '@/ui/theme';

export default function ListScreen() {
  const { family, task, fs } = useLocalSearchParams<{
    family?: string;
    task?: string;
    fs?: string;
  }>();
  return (
    <FontScaleContext.Provider value={parseFontScale(fs)}>
      <ShoppingList familyId={family ?? ''} taskId={task ?? ''} />
    </FontScaleContext.Provider>
  );
}
