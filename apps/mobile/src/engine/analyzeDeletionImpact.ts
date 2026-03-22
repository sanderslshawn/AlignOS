import type { ScheduleItem } from '@physiology-engine/shared';
import type { RecommendationContext } from '../utils/recommendationContext';
import type { ForecastSnapshot } from '../components/EnergyForecast';
import { addMinutes, toISOWithClockTime } from '../utils/clockTime';

export type DeletionImpact = {
  deletedItemId: string;
  severity: 'low' | 'medium' | 'high';
  impactSummary: string;
  recommendationOptions: {
    id: string;
    title: string;
    description: string;
    inserts?: ScheduleItem[];
    actionId?: string;
  }[];
};

interface AnalyzeDeletionImpactInput {
  deletedItem: ScheduleItem;
  updatedSchedule: ScheduleItem[];
  recommendationContext: RecommendationContext;
  energyForecast?: ForecastSnapshot | null;
}

const hhmmToMinutes = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const [hourPart, minutePart] = value.split(':');
  const hour = Number.parseInt(hourPart || '', 10);
  const minute = Number.parseInt(minutePart || '', 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return fallback;
  return Math.max(0, Math.min((hour * 60) + minute, (24 * 60) - 1));
};

const toClockFromMinutes = (minutes: number) => {
  const normalized = ((Math.round(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return {
    hour: (hour24 % 12) || 12,
    minute,
    period: hour24 >= 12 ? 'PM' as const : 'AM' as const,
  };
};

const makeInsert = (
  context: RecommendationContext,
  item: Pick<ScheduleItem, 'type' | 'title'> & { startMin: number; durationMin: number; notes?: string }
): ScheduleItem => {
  const startClock = toClockFromMinutes(item.startMin);
  const endClock = addMinutes(startClock, item.durationMin);
  const startISO = toISOWithClockTime(`${context.date}T12:00:00.000Z`, startClock);
  const endISO = toISOWithClockTime(`${context.date}T12:00:00.000Z`, endClock);

  return {
    id: `recommend-${item.type}-${item.startMin}`,
    type: item.type,
    title: item.title,
    startTime: startClock,
    endTime: endClock,
    startISO,
    endISO,
    startMin: item.startMin,
    endMin: item.startMin + item.durationMin,
    durationMin: item.durationMin,
    fixed: false,
    isSystemAnchor: false,
    isFixedAnchor: false,
    locked: false,
    deletable: true,
    source: 'advisor',
    status: 'planned',
    notes: item.notes,
  };
};

export function analyzeDeletionImpact(input: AnalyzeDeletionImpactInput): DeletionImpact {
  const { deletedItem, updatedSchedule, recommendationContext, energyForecast } = input;
  const nowDate = new Date(recommendationContext.now);
  const nowMinutes = (nowDate.getHours() * 60) + nowDate.getMinutes();
  const nextMeal = updatedSchedule
    .filter((item) => (item.type === 'meal' || item.type === 'snack' || item.type === 'lunch') && (item.startMin || 0) > nowMinutes)
    .sort((a, b) => (a.startMin || 0) - (b.startMin || 0))[0];
  const nextMealGap = nextMeal ? (nextMeal.startMin || nowMinutes) - nowMinutes : 999;
  const dipRisk = energyForecast && energyForecast.dipEnergy <= 45;
  const isMealDelete = deletedItem.type === 'meal' || deletedItem.type === 'lunch' || deletedItem.title.toLowerCase().includes('lunch');
  const isWorkoutDelete = deletedItem.type === 'workout';
  const isWalkDelete = deletedItem.type === 'walk';
  const isFocusDelete = deletedItem.type === 'focus' || deletedItem.type === 'work';
  const isSnackDelete = deletedItem.type === 'snack';
  const stress = recommendationContext.stressLevel;
  const sleep = recommendationContext.sleepScore;
  const fasting = recommendationContext.fastingHours;
  const diet = recommendationContext.dietFoundation.toLowerCase();
  const workEnd = hhmmToMinutes(recommendationContext.workEnd, 17 * 60);

  if (isMealDelete) {
    const snackTitle =
      diet.includes('carnivore')
        ? 'Protein bridge snack'
        : diet.includes('keto')
          ? 'Low-carb bridge snack'
          : 'Protein + fiber bridge snack';
    const bridgeTime = Math.min(workEnd - 90, Math.max(nowMinutes + 45, (energyForecast?.dipHour || 14) * 60 - 45));
    const severity: 'low' | 'medium' | 'high' = (dipRisk || nextMealGap >= 300 || stress >= 8 || sleep <= 5) ? 'high' : 'medium';

    return {
      deletedItemId: deletedItem.id,
      severity,
      impactSummary: `Removing ${deletedItem.title.toLowerCase()} may increase afternoon dip risk and widen your meal gap.` ,
      recommendationOptions: [
        {
          id: 'bridge-snack',
          title: 'Add bridge snack',
          description: `${snackTitle} around ${Math.floor(bridgeTime / 60) % 12 || 12}:${String(bridgeTime % 60).padStart(2, '0')}.`,
          inserts: [
            makeInsert(recommendationContext, {
              type: 'snack',
              title: snackTitle,
              startMin: bridgeTime,
              durationMin: 15,
              notes: 'Recommended after meal deletion',
            }),
          ],
        },
        {
          id: 'shift-dinner',
          title: 'Shift dinner earlier',
          description: 'Recompute the remaining schedule to pull your next meal window earlier by ~30 minutes.',
          actionId: 'RECOMPUTE_FROM_NOW',
        },
        {
          id: 'hydration-walk',
          title: 'Add hydration + walk',
          description: fasting >= 14
            ? 'Protect fasting structure with hydration and a short walk before your next meal.'
            : 'Use hydration and movement to reduce dip risk until the next meal.',
          actionId: 'INSERT_WALK_10',
        },
      ],
    };
  }

  if (isWorkoutDelete) {
    const recoveryTime = Math.min(workEnd - 30, Math.max(nowMinutes + 60, 18 * 60));
    return {
      deletedItemId: deletedItem.id,
      severity: recommendationContext.fitnessGoal.toLowerCase().includes('performance') ? 'high' : 'medium',
      impactSummary: 'Removing this workout lowers activity stimulus and can reduce momentum for today.',
      recommendationOptions: [
        {
          id: 'light-walk',
          title: 'Insert light walk',
          description: 'Add a 10-minute walk to preserve movement continuity.',
          actionId: 'INSERT_WALK_10',
        },
        {
          id: 'mobility-block',
          title: 'Add recovery mobility block',
          description: 'Replace high intensity with low-load mobility for recovery support.',
          inserts: [
            makeInsert(recommendationContext, {
              type: 'custom',
              title: 'Recovery Mobility',
              startMin: recoveryTime,
              durationMin: 20,
              notes: 'Recommended after workout deletion',
            }),
          ],
        },
        {
          id: 'tomorrow-shift',
          title: 'Re-plan tomorrow training',
          description: 'Keep today lighter and re-balance the next training block in tomorrow prep.',
          actionId: 'RECOMPUTE_FROM_NOW',
        },
      ],
    };
  }

  if (isWalkDelete) {
    const shortWalkTime = Math.min(workEnd - 30, Math.max(nowMinutes + 45, 16 * 60));
    return {
      deletedItemId: deletedItem.id,
      severity: (stress >= 7 || dipRisk) ? 'medium' : 'low',
      impactSummary: 'Removing this walk reduces movement support for energy and glucose regulation.',
      recommendationOptions: [
        {
          id: 'shorter-walk',
          title: 'Add shorter walk later',
          description: 'Use an 8-minute walk later today to keep movement rhythm stable.',
          inserts: [
            makeInsert(recommendationContext, {
              type: 'walk',
              title: '8min Recovery Walk',
              startMin: shortWalkTime,
              durationMin: 8,
              notes: 'Recommended after walk deletion',
            }),
          ],
        },
        {
          id: 'before-dinner-move',
          title: 'Add movement break before dinner',
          description: 'Insert a short movement primer before your evening meal.',
          actionId: 'INSERT_WALK_10',
        },
      ],
    };
  }

  if (isFocusDelete) {
    const focusTime = Math.min(workEnd - 45, Math.max(nowMinutes + 30, nowMinutes + 60));
    return {
      deletedItemId: deletedItem.id,
      severity: recommendationContext.dayMode === 'tight' ? 'high' : 'medium',
      impactSummary: 'Removing this focus block reduces protected concentration time for the day.',
      recommendationOptions: [
        {
          id: 'short-focus',
          title: 'Insert shorter focus block',
          description: 'Add a 25-minute focus block later to preserve execution quality.',
          inserts: [
            makeInsert(recommendationContext, {
              type: 'focus',
              title: 'Focus Recovery Block',
              startMin: focusTime,
              durationMin: 25,
              notes: 'Recommended after focus deletion',
            }),
          ],
        },
        {
          id: 'simplify-next',
          title: 'Simplify next open block',
          description: 'Recompute remaining blocks with a lighter cognitive load.',
          actionId: 'RECOMPUTE_FROM_NOW',
        },
      ],
    };
  }

  if (isSnackDelete) {
    const severity: 'low' | 'medium' = nextMealGap >= 240 ? 'medium' : 'low';
    const snackTime = Math.max(nowMinutes + 45, nowMinutes + 60);
    return {
      deletedItemId: deletedItem.id,
      severity,
      impactSummary: nextMealGap >= 240
        ? 'Removing this snack creates a longer gap to your next meal and may increase hunger risk.'
        : 'Removing this snack has a low immediate impact with your current meal timing.',
      recommendationOptions: nextMealGap >= 240
        ? [
            {
              id: 'bridge-snack-lite',
              title: 'Add light bridge snack',
              description: 'Use a smaller snack to reduce hunger spikes before the next meal.',
              inserts: [
                makeInsert(recommendationContext, {
                  type: 'snack',
                  title: 'Light bridge snack',
                  startMin: snackTime,
                  durationMin: 10,
                  notes: 'Recommended after snack deletion',
                }),
              ],
            },
            {
              id: 'shift-next-meal',
              title: 'Shift next meal earlier',
              description: 'Recompute to tighten the next meal window.',
              actionId: 'RECOMPUTE_FROM_NOW',
            },
          ]
        : [],
    };
  }

  return {
    deletedItemId: deletedItem.id,
    severity: 'low',
    impactSummary: `Removed ${deletedItem.title}. Timeline is stable and no replacement is required unless you choose one.`,
    recommendationOptions: [],
  };
}
