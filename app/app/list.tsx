import { useLocalSearchParams } from 'expo-router';

import { ShoppingList } from '@/shopping/ShoppingList';

export default function ListScreen() {
  const { family, task } = useLocalSearchParams<{ family?: string; task?: string }>();
  return <ShoppingList familyId={family ?? ''} taskId={task ?? ''} />;
}
