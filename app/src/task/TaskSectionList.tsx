import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { Task } from '@/api/client';
import { useT } from '@/i18n';
import { Region } from '@/ui/Region';
import { SectionHeader } from '@/ui/SectionHeader';
import { useTheme } from '@/ui/theme';

import { SECTIONS, sectionOf, sortInSection, type Section } from './sections';

/**
 * The tasks by section, in a labelled region: per non-empty section a heading (outside the list)
 * and a list with one item per task. Every task shown is exactly one `listitem` of the region.
 */
export function TaskSectionList({
  label,
  tasks,
  now,
  renderCard,
}: {
  label: string;
  tasks: Task[];
  now: Date;
  renderCard: (task: Task, section: Section) => ReactNode;
}) {
  const t = useT();
  const { space } = useTheme();
  const groups = new Map<Section, Task[]>();
  for (const task of tasks) {
    const section = sectionOf(task, now);
    groups.set(section, [...(groups.get(section) ?? []), task]);
  }
  return (
    <Region label={label}>
      {SECTIONS.filter((section) => groups.has(section)).map((section) => {
        const name = t(`task.section.${section}`);
        return [
          <SectionHeader key={`${section}-h`}>{name}</SectionHeader>,
          <View key={section} role="list" aria-label={name} style={{ gap: space.md }}>
            {sortInSection(groups.get(section)!).map((task) => (
              <View key={task.id} role="listitem">
                {renderCard(task, section)}
              </View>
            ))}
          </View>,
        ];
      })}
    </Region>
  );
}
