import type { ScheduleItem } from '@physiology-engine/shared';

export type AnchorTier = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5';

const PRIMARY_WORK_TITLES = ['work start', 'work end'];
const USER_HARD_TYPES = new Set<ScheduleItem['type']>(['meeting', 'commute']);
const USER_HARD_KEYWORDS = ['meeting', 'appointment', 'calendar', 'pickup', 'class', 'call'];

function normalizedTitle(item: Pick<ScheduleItem, 'title'>): string {
  return (item.title || '').trim().toLowerCase();
}

export function isHardAnchorTier(tier: AnchorTier): boolean {
  return tier === 'tier1' || tier === 'tier2';
}

export function getAnchorTier(
  item: Pick<ScheduleItem, 'type' | 'title'> &
    Partial<Pick<ScheduleItem, 'status' | 'origin' | 'source' | 'fixed' | 'locked' | 'meta' | 'isSystemAnchor' | 'isFixedAnchor'>>
): AnchorTier {
  const title = normalizedTitle(item);
  const legacyIsAnchor = Boolean(item.meta && (item.meta as any).isAnchor);
  const isSystemAnchor = Boolean(item.isSystemAnchor || item.type === 'wake' || item.type === 'sleep');
  const isFixedAnchor = Boolean(item.isFixedAnchor || item.fixed || legacyIsAnchor);
  const isUserSource = item.source === 'user' || item.source === 'advisor';

  if (item.status === 'actual' || item.origin === 'actual' || item.status === 'skipped') {
    return 'tier4';
  }

  if (isSystemAnchor) return 'tier1';

  if (item.type === 'work') {
    if (PRIMARY_WORK_TITLES.some((needle) => title.includes(needle))) return 'tier1';
    return 'tier5';
  }

  const isUserHardKeyword = USER_HARD_KEYWORDS.some((keyword) => title.includes(keyword));

  if (
    (isUserSource && isFixedAnchor && (USER_HARD_TYPES.has(item.type) || isUserHardKeyword)) ||
    (isUserSource && isFixedAnchor)
  ) {
    return 'tier2';
  }

  if (isUserSource && (item.locked || item.status === 'adjusted')) {
    return 'tier3';
  }

  if (item.locked && !isSystemAnchor) return 'tier3';

  return 'tier5';
}
