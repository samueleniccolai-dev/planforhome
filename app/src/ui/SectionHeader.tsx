import { Text } from './Text';

export function SectionHeader({ children }: { children: string }) {
  return (
    <Text variant="section" tone="secondary" heading={2}>
      {children}
    </Text>
  );
}
