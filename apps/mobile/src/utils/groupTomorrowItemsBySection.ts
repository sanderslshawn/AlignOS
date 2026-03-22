import type { ScheduleItem } from '@physiology-engine/shared';

export interface TomorrowSections {
  morning: ScheduleItem[];
  midday: ScheduleItem[];
  afternoon: ScheduleItem[];
  evening: ScheduleItem[];
}

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

export function groupTomorrowItemsBySection(items: ScheduleItem[], dateISO: string): TomorrowSections {
  const sections: TomorrowSections = {
    morning: [],
    midday: [],
    afternoon: [],
    evening: [],
  };

  const tomorrowItems = items
    .filter((item) => itemDateISO(item, dateISO) === dateISO)
    .sort((a, b) => (a.startMin || 0) - (b.startMin || 0));

  for (const item of tomorrowItems) {
    const start = item.startMin || 0;
    if (start < 12 * 60) {
      sections.morning.push(item);
    } else if (start < 15 * 60) {
      sections.midday.push(item);
    } else if (start < 18 * 60) {
      sections.afternoon.push(item);
    } else {
      sections.evening.push(item);
    }
  }

  return sections;
}
