import type { ScheduleItem, UserProfile } from '@physiology-engine/shared';
import { buildDaySchedule } from './buildDaySchedule';
import { validateSchedule } from './validateSchedule';
import { parseClockTime } from '../utils/clockTime';
import { canDeleteScheduleItem } from './normalizeTimeline';
import type { MutationIntent } from '../types/mutationIntent';

type Mutation =
  | { kind: 'edit'; id: string; updates: Partial<ScheduleItem> }
  | { kind: 'add'; item: ScheduleItem }
  | { kind: 'delete'; id: string }
  | { kind: 'logActual'; item: ScheduleItem }
  | { kind: 'advisorAdd'; item: ScheduleItem }
  | { kind: 'markDone'; id: string }
  | { kind: 'markSkipped'; id: string };

interface ApplyScheduleMutationInput {
  currentItems: ScheduleItem[];
  mutation: Mutation;
  settings: UserProfile;
  intent?: MutationIntent;
  advisorInsertions?: ScheduleItem[];
  actualEvents?: ScheduleItem[];
  dateISO?: string;
}

function sortSchedule(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => {
    const aStartMin = a.startMin ?? 0;
    const bStartMin = b.startMin ?? 0;
    if (aStartMin !== bStartMin) return aStartMin - bStartMin;
    return (a.id || '').localeCompare(b.id || '');
  });
}

function preserveAnchors(originalItems: ScheduleItem[], nextItems: ScheduleItem[]): ScheduleItem[] {
  const wakeFromOriginal = originalItems.find((item) => item.type === 'wake');
  const sleepFromOriginal = originalItems.find((item) => item.type === 'sleep');
  const hasWake = nextItems.some((item) => item.type === 'wake');
  const hasSleep = nextItems.some((item) => item.type === 'sleep');

  const withAnchors = [...nextItems];
  if (!hasWake && wakeFromOriginal) withAnchors.push(wakeFromOriginal);
  if (!hasSleep && sleepFromOriginal) withAnchors.push(sleepFromOriginal);
  return withAnchors;
}

function resolveIntent(input: ApplyScheduleMutationInput): MutationIntent {
  if (input.intent) return input.intent;

  switch (input.mutation.kind) {
    case 'add':
      return 'ADD';
    case 'edit':
      return 'EDIT';
    case 'delete':
      return 'DELETE';
    case 'advisorAdd':
      return 'ADVISOR_INSERT';
    case 'logActual':
    case 'markDone':
    case 'markSkipped':
      return 'SELF_HEAL';
    default:
      return 'REGENERATE';
  }
}

export function applyScheduleMutation(input: ApplyScheduleMutationInput): ScheduleItem[] {
  let working = [...input.currentItems];
  const mutation = input.mutation;
  const intent = resolveIntent(input);
  const isDeleteIntent = intent === 'DELETE' || intent === 'DELETE_VALIDATE_ONLY';
  const shouldRegenerate = intent === 'REGENERATE';

  if (isDeleteIntent && mutation.kind === 'delete') {
    const beforeItems = [...working];
    const removedItems = working.filter((item) => item.id !== mutation.id || !canDeleteScheduleItem(item));
    const withAnchors = preserveAnchors(beforeItems, removedItems);

    const wake = input.settings.wakeClockTime || parseClockTime(input.settings.wakeTime)!;
    const sleep = input.settings.sleepClockTime || parseClockTime(input.settings.sleepTime)!;

    const validatedItems = validateSchedule({
      items: withAnchors,
      wakeTime: wake,
      sleepTime: sleep,
      dateISO: input.dateISO,
    }).items;

    const sortedItems = sortSchedule(validatedItems);

    if (sortedItems.length > beforeItems.length) {
      console.warn('[applyScheduleMutation][DELETE] Delete produced more items than original, blocking insertions', {
        beforeCount: beforeItems.length,
        afterCount: sortedItems.length,
        deletedItemId: mutation.id,
      });
      return sortSchedule(withAnchors);
    }

    return sortedItems;
  }

  switch (mutation.kind) {
    case 'edit':
      working = working.map((item) =>
        item.id === mutation.id
          ? {
              ...item,
              ...mutation.updates,
              status: mutation.updates.status || 'adjusted',
              source: item.source === 'system' ? 'user' : item.source,
            }
          : item
      );
      break;

    case 'add':
      working.push({
        ...mutation.item,
        source: mutation.item.source || 'user',
        status: mutation.item.status || 'planned',
      });
      break;

    case 'delete':
      working = working.filter((item) => item.id !== mutation.id || !canDeleteScheduleItem(item));
      break;

    case 'logActual':
      working.push({ ...mutation.item, source: 'user', status: 'actual' });
      break;

    case 'advisorAdd':
      working.push({ ...mutation.item, source: 'advisor', status: 'planned' });
      break;

    case 'markDone':
      working = working.map((item) =>
        item.id === mutation.id ? { ...item, status: 'actual', origin: 'actual' } : item
      );
      break;

    case 'markSkipped':
      working = working.map((item) =>
        item.id === mutation.id ? { ...item, status: 'skipped' } : item
      );
      break;
  }

  const wake = input.settings.wakeClockTime || parseClockTime(input.settings.wakeTime)!;
  const sleep = input.settings.sleepClockTime || parseClockTime(input.settings.sleepTime)!;

  if (shouldRegenerate) {
    const rebuilt = buildDaySchedule({
      settings: input.settings,
      existingItems: working,
      advisorInsertions: input.advisorInsertions,
      actualEvents: input.actualEvents,
      dateISO: input.dateISO,
      intent,
      validateOnly: false,
    });

    return sortSchedule(
      validateSchedule({
        items: rebuilt,
        wakeTime: wake,
        sleepTime: sleep,
        dateISO: input.dateISO,
      }).items
    );
  }

  const validated = validateSchedule({
    items: preserveAnchors(input.currentItems, working),
    wakeTime: wake,
    sleepTime: sleep,
    dateISO: input.dateISO,
  }).items;

  return sortSchedule(validated);
}