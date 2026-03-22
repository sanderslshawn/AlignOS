import { addMinutes, parse } from 'date-fns';
import type { ScheduleItem } from '@physiology-engine/shared';
import type { AdvisorResponse, Insert } from '../types/advisorResponse';

type ActionPayload = {
  inserts?: Insert[];
};

function isValidInsert(value: unknown): value is Insert {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Insert>;
  return typeof candidate.type === 'string' && typeof candidate.title === 'string';
}

function getActionPayloadInserts(response: AdvisorResponse): Insert[] {
  const actionInserts = response.actions.flatMap((action) => {
    const payload = action.payload as ActionPayload | undefined;
    const inserts = payload?.inserts;
    if (!Array.isArray(inserts)) return [];
    return inserts.filter(isValidInsert);
  });

  return actionInserts;
}

export function extractTimelineInserts(response: AdvisorResponse): Insert[] {
  const directInserts = (response.inserts || []).filter(isValidInsert);
  const actionInserts = getActionPayloadInserts(response);

  const deduped = new Map<string, Insert>();
  for (const insert of [...directInserts, ...actionInserts]) {
    const key = `${insert.type}|${insert.title}|${insert.startTime || 'any'}|${insert.durationMin || 30}`;
    if (!deduped.has(key)) {
      deduped.set(key, insert);
    }
  }

  return Array.from(deduped.values());
}

export function hasTimelineSuggestion(response: AdvisorResponse): boolean {
  return extractTimelineInserts(response).length > 0;
}

export function mapAdvisorInsertToScheduleItem(
  insert: Insert,
  now: Date = new Date()
): Omit<ScheduleItem, 'id'> {
  const safeDuration = insert.durationMin && insert.durationMin > 0 ? insert.durationMin : 30;
  const hasRenderableTime = !!insert.startTime && !insert.startTime.includes('{');
  const parsedStart = hasRenderableTime ? parse(insert.startTime!, 'h:mma', now) : addMinutes(now, 15);
  const start = Number.isNaN(parsedStart.getTime()) ? addMinutes(now, 15) : parsedStart;

  const mappedType: ScheduleItem['type'] =
    insert.type === 'workout' || insert.type === 'walk' || insert.type === 'meal' || insert.type === 'snack' || insert.type === 'break'
      ? insert.type
      : 'custom';

  return {
    type: mappedType,
    title: insert.title,
    startISO: start.toISOString(),
    endISO: addMinutes(start, safeDuration).toISOString(),
    isSystemAnchor: false,
    isFixedAnchor: false,
    fixed: false,
    locked: false,
    deletable: true,
    source: 'advisor_added',
    status: 'planned',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: insert.notes || 'Added from AI Advisor',
  };
}
