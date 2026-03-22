import type { ScheduleItem } from '@physiology-engine/shared';

interface DedupeOptions {
  dateISO?: string;
  nearMinutes?: number;
}

function itemDateISO(item: Pick<ScheduleItem, 'startISO'>, fallbackDateISO: string): string {
  if (typeof item.startISO === 'string' && item.startISO.includes('T')) {
    return item.startISO.split('T')[0];
  }
  return fallbackDateISO;
}

function normalizedTitle(item: Pick<ScheduleItem, 'title'>): string {
  return (item.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function approxMinute(item: Pick<ScheduleItem, 'startMin'>): number {
  return Math.max(0, item.startMin || 0);
}

export function dedupeBehaviorBlocks(items: ScheduleItem[], options?: DedupeOptions): ScheduleItem[] {
  const nearMinutes = options?.nearMinutes ?? 15;
  const fallbackDateISO = options?.dateISO || new Date().toISOString().slice(0, 10);

  const sorted = [...items].sort((a, b) => (a.startMin || 0) - (b.startMin || 0));
  const deduped: ScheduleItem[] = [];

  for (const item of sorted) {
    const dayKey = itemDateISO(item, fallbackDateISO);
    const titleKey = normalizedTitle(item);
    const start = approxMinute(item);
    const source = item.source || 'system';

    const existingIndex = deduped.findIndex((existing) => {
      const existingDay = itemDateISO(existing, fallbackDateISO);
      if (existingDay !== dayKey) return false;
      if (existing.type !== item.type) return false;
      if (normalizedTitle(existing) !== titleKey) return false;

      const existingStart = approxMinute(existing);
      return Math.abs(existingStart - start) <= nearMinutes;
    });

    if (existingIndex === -1) {
      deduped.push(item);
      continue;
    }

    const existing = deduped[existingIndex];
    const existingUserCreated = existing.source === 'user';
    const incomingUserCreated = source === 'user';

    if (existingUserCreated && incomingUserCreated) {
      deduped.push(item);
      continue;
    }

    if (!existingUserCreated && !incomingUserCreated) {
      const existingActual = existing.status === 'actual' || existing.origin === 'actual';
      const incomingActual = item.status === 'actual' || item.origin === 'actual';
      if (incomingActual && !existingActual) {
        deduped[existingIndex] = item;
      }
      continue;
    }

    if (incomingUserCreated && !existingUserCreated) {
      deduped[existingIndex] = item;
    }
  }

  return deduped;
}
