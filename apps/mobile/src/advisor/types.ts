/**
 * AlignOS AI Advisor - Type Definitions
 * Decision engine types for structured advice
 */

import type { UserProfile, DayPlan, ScheduleItem, DayState } from '@physiology-engine/shared';
import type { RecommendationContext } from '../utils/recommendationContext';

export type IntentType = 
  | 'meal_timing'
  | 'snack_between_meals'
  | 'comfort_meal'
  | 'caffeine_timing'
  | 'workout_timing'
  | 'low_energy_dip'
  | 'sleep_quality'
  | 'stress_management'
  | 'schedule_adjustment'
  | 'general_question';

export interface ClassifiedIntent {
  type: IntentType;
  confidence: number;
  entities: {
    mealType?: string;
    activityType?: string;
    timeFrame?: string;
    specificFood?: string;
  };
}

export interface DecisionContext {
  query: string;
  profile: UserProfile;
  dayState: DayState | null;
  currentPlan?: DayPlan;
  currentTime: Date;
  recoveryScore?: any;
  recommendationContext?: RecommendationContext;
}

export interface NextMove {
  time: string;
  action: string;
  duration?: string;
}

export interface IfThenBranch {
  condition: string;
  action: string;
}

export interface AdvisorInsert {
  type: ScheduleItem['type'];
  title: string;
  startISO: string;
  endISO: string;
  fixed: boolean;
  source: 'user' | 'engine' | 'settings';
  notes?: string;
}

export type AdvisorActionType =
  | 'ADD_INSERTS_TO_PLAN'
  | 'SHIFT_NEXT_MEAL_15'
  | 'INSERT_WALK_15'
  | 'LOCK_NEXT_ITEM'
  | 'REGENERATE_FROM_NOW';

export interface AdvisorAction {
  id: AdvisorActionType;
  label: string;
  variant: 'primary' | 'secondary';
  payload?: any;
}

export interface StructuredAdvice {
  directAnswer: string;
  inserts?: AdvisorInsert[];
  nextMoves: NextMove[];
  ifThen: IfThenBranch[];
  why: string;
  actions: AdvisorAction[];
  suggestedActivity?: Omit<ScheduleItem, 'id'>;
}

export interface AdvisorResponse {
  intent: ClassifiedIntent;
  advice: StructuredAdvice;
}
