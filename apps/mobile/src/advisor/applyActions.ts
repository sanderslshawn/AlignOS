/**
 * AlignOS Advisor - Action Executor
 * Applies advisor actions to the actual plan
 */

import type { AdvisorActionType, AdvisorInsert } from './types';
import type { ScheduleItem } from '@physiology-engine/shared';
import { compareByStartMin, ensureStartEnd, minutesToHHmm } from '../utils/time';

interface ActionPayload {
  inserts?: AdvisorInsert[];
  [key: string]: any;
}

interface ActionExecutorDeps {
  addTodayEntry: (entry: Omit<ScheduleItem, 'id'>) => Promise<string>;
  updateTodayEntry: (id: string, updates: Partial<ScheduleItem>) => Promise<void>;
  fullDayPlan: { items: ScheduleItem[] } | null;
  generateFullDayPlan: () => Promise<void>;
}

export class AdvisorActionExecutor {
  private deps: ActionExecutorDeps;
  private undoStack: Array<{ action: string; snapshot: any }> = [];

  constructor(deps: ActionExecutorDeps) {
    this.deps = deps;
  }

  private toISO(baseISO: string | undefined, minutes: number): string {
    const datePart = (baseISO || new Date().toISOString()).split('T')[0];
    return `${datePart}T${minutesToHHmm(minutes)}:00.000Z`;
  }

  async execute(actionId: AdvisorActionType, payload: ActionPayload = {}): Promise<boolean> {
    try {
      switch (actionId) {
        case 'ADD_INSERTS_TO_PLAN':
          return await this.addInserts(payload.inserts || []);

        case 'SHIFT_NEXT_MEAL_15':
          return await this.shiftNextMeal(15);

        case 'INSERT_WALK_15':
          return await this.insertWalk(15);

        case 'LOCK_NEXT_ITEM':
          return await this.lockNextItem();

        case 'REGENERATE_FROM_NOW':
          return await this.regenerateFromNow();

        default:
          console.warn(`Unknown action: ${actionId}`);
          return false;
      }
    } catch (error) {
      console.error(`Action execution failed:`, error);
      return false;
    }
  }

  private async addInserts(inserts: AdvisorInsert[]): Promise<boolean> {
    if (!inserts || inserts.length === 0) return false;

    // Store snapshot for undo
    this.saveSnapshot('ADD_INSERTS', this.deps.fullDayPlan?.items || []);

    for (const insert of inserts) {
      const normalized = ensureStartEnd({
        startISO: insert.startISO,
        endISO: insert.endISO,
      });

      await this.deps.addTodayEntry({
        status: 'planned',
        type: insert.type,
        title: insert.title,
        startISO: normalized.startISO || this.toISO(undefined, normalized.startMin),
        endISO: normalized.endISO || this.toISO(undefined, normalized.endMin),
        startMin: normalized.startMin,
        endMin: normalized.endMin,
        durationMin: Math.max(1, normalized.endMin - normalized.startMin),
        fixed: insert.fixed,
        source: insert.source,
        isSystemAnchor: insert.source !== 'user',
        isFixedAnchor: !!insert.fixed,
        notes: insert.notes,
      });
    }

    return true;
  }

  private async shiftNextMeal(minutes: number): Promise<boolean> {
    if (!this.deps.fullDayPlan) return false;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const normalizedItems = this.deps.fullDayPlan.items
      .map(ensureStartEnd)
      .sort(compareByStartMin);
    const nextMeal = normalizedItems.find(
      item => item.type === 'meal' && item.startMin > nowMinutes
    );

    if (!nextMeal) return false;

    this.saveSnapshot('SHIFT_MEAL', nextMeal);

    const duration = Math.max(1, nextMeal.endMin - nextMeal.startMin);
    const newStartMin = nextMeal.startMin + minutes;
    const newEndMin = newStartMin + duration;

    await this.deps.updateTodayEntry(nextMeal.id, {
      startMin: newStartMin,
      endMin: newEndMin,
      durationMin: duration,
      startISO: this.toISO(nextMeal.startISO, newStartMin),
      endISO: this.toISO(nextMeal.endISO, newEndMin),
    });

    return true;
  }

  private async insertWalk(durationMinutes: number): Promise<boolean> {
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const normalizedItems = (this.deps.fullDayPlan?.items || [])
      .map(ensureStartEnd)
      .sort(compareByStartMin);
    
    // Find best insertion point: after most recent meal or next available gap
    const recentMeal = normalizedItems
      .filter(item => item.type === 'meal' && item.endMin < nowMinutes)
      .sort((a, b) => b.endMin - a.endMin)[0];

    const walkStartMin = recentMeal ? recentMeal.endMin + 10 : nowMinutes + 5;
    const walkEndMin = walkStartMin + durationMinutes;
    const walkStartISO = this.toISO(recentMeal?.endISO, walkStartMin);
    const walkEndISO = this.toISO(recentMeal?.endISO, walkEndMin);

    this.saveSnapshot('INSERT_WALK', null);

    await this.deps.addTodayEntry({
      status: 'planned',
      type: 'walk',
      title: `${durationMinutes}min Walk`,
      startISO: walkStartISO,
      endISO: walkEndISO,
      startMin: walkStartMin,
      endMin: walkEndMin,
      durationMin: durationMinutes,
      fixed: false,
      source: 'user',
      isSystemAnchor: false,
      isFixedAnchor: false,
      notes: 'Added from AI Advisor',
    });

    return true;
  }

  private async lockNextItem(): Promise<boolean> {
    if (!this.deps.fullDayPlan) return false;

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nextItem = this.deps.fullDayPlan.items
      .map(ensureStartEnd)
      .sort(compareByStartMin)
      .find((item) => item.startMin > nowMinutes);

    if (!nextItem) return false;

    this.saveSnapshot('LOCK_ITEM', nextItem);

    await this.deps.updateTodayEntry(nextItem.id, {
      fixed: true,
    });

    return true;
  }

  private async regenerateFromNow(): Promise<boolean> {
    this.saveSnapshot('REGENERATE', this.deps.fullDayPlan?.items || []);
    await this.deps.generateFullDayPlan();
    return true;
  }

  private saveSnapshot(action: string, snapshot: any): void {
    this.undoStack.push({ action, snapshot });
    // Keep only last 5 actions
    if (this.undoStack.length > 5) {
      this.undoStack.shift();
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  getLastAction(): string | null {
    return this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].action : null;
  }

  // Undo functionality would require more complex state management
  // For now, we just track that actions were applied
}

export function createActionExecutor(deps: ActionExecutorDeps): AdvisorActionExecutor {
  return new AdvisorActionExecutor(deps);
}
