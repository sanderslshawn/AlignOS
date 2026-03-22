# Stabilization Full Code Dump

Generated: 2026-03-06T18:47:23.5030483-08:00

## apps/mobile/src/components/EditScheduleItemModal.tsx

```
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import type { ScheduleItem } from '@physiology-engine/shared';
import { ensureStartEnd } from '../utils/time';
import ClockTimeField from './ClockTimeField';
import { addMinutes, clockTimeFromISO, parseClockTime, toISOWithClockTime, toSortableMinutes } from '../utils/clockTime';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditScheduleItemModalProps {
  visible: boolean;
  item: ScheduleItem | null;
  onSave: (item: ScheduleItem) => Promise<void> | void;
  onDelete?: () => void;
  onClose: () => void;
  isSaving?: boolean;
}

const ITEM_TYPES = [
  { value: 'wake', label: 'Wake' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'work', label: 'Work' },
  { value: 'meal', label: 'Meal' },
  { value: 'snack', label: 'Snack' },
  { value: 'workout', label: 'Workout' },
  { value: 'walk', label: 'Walk' },
  { value: 'focus', label: 'Focus' },
  { value: 'break', label: 'Break' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'custom', label: 'Custom' },
];

export default function EditScheduleItemModal({ visible, item, onSave, onDelete, onClose, isSaving = false }: EditScheduleItemModalProps) {
  const [editedItem, setEditedItem] = useState<ScheduleItem | null>(item ? ensureStartEnd(item) : item);
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    if (item) {
      setEditedItem(ensureStartEnd(item));
    }
  }, [item]);

  if (!editedItem) return null;

  const handleSave = async () => {
    if (!editedItem) return;

    const normalized = ensureStartEnd(editedItem);
    if (normalized.endMin <= normalized.startMin) {
      Alert.alert('Invalid time', 'End time must be later than start time.');
      return;
    }

    await onSave(normalized);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const canDelete = editedItem.type !== 'wake' && editedItem.type !== 'sleep';

  const handleStartTimeChange = (startTime: NonNullable<ScheduleItem['startTime']>) => {
    const currentEnd = editedItem.endTime || clockTimeFromISO(editedItem.endISO);
    const startMin = toSortableMinutes(startTime);
    const endMin = currentEnd ? Math.max(toSortableMinutes(currentEnd), startMin + 5) : startMin + 5;
    const computedEnd = endMin === startMin + 5 && !currentEnd ? addMinutes(startTime, 5) : (currentEnd || addMinutes(startTime, 5));
    setEditedItem({
      ...editedItem,
      startTime,
      endTime: computedEnd,
      startMin,
      endMin,
      durationMin: endMin - startMin,
      startISO: toISOWithClockTime(editedItem.startISO, startTime),
      endISO: toISOWithClockTime(editedItem.endISO, computedEnd),
    });
  };

  const handleEndTimeChange = (endTime: NonNullable<ScheduleItem['endTime']>) => {
    const currentStart = editedItem.startTime || clockTimeFromISO(editedItem.startISO);
    if (!currentStart) return;
    const startMin = toSortableMinutes(currentStart);
    const endMin = Math.max(toSortableMinutes(endTime), startMin + 5);
    const computedEnd = endMin === startMin + 5 ? addMinutes(currentStart, 5) : endTime;
    setEditedItem({
      ...editedItem,
      startTime: currentStart,
      endTime: computedEnd,
      startMin,
      endMin,
      durationMin: endMin - startMin,
      startISO: toISOWithClockTime(editedItem.startISO, currentStart),
      endISO: toISOWithClockTime(editedItem.endISO, computedEnd),
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboardContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <SafeAreaView edges={['bottom']} style={styles.safeArea}>
            <View style={styles.modal}>
              <ScrollView
                style={styles.scrollView}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 120 }}
              >
                <Text style={styles.title}>Edit Schedule Item</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={editedItem.title}
                onChangeText={(text) => setEditedItem({ ...editedItem, title: text })}
                placeholder="e.g., Breakfast, Meeting, etc."
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                {ITEM_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.typeChip,
                      editedItem.type === type.value && styles.typeChipSelected,
                    ]}
                    onPress={() => setEditedItem({ ...editedItem, type: type.value as any })}
                  >
                    <Text
                      style={[
                        styles.typeChipText,
                        editedItem.type === type.value && styles.typeChipTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.row}>
              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>Start Time</Text>
                <ClockTimeField
                  value={editedItem.startTime || clockTimeFromISO(editedItem.startISO)}
                  onChange={handleStartTimeChange}
                />
              </View>

              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>End Time</Text>
                <ClockTimeField
                  value={editedItem.endTime || clockTimeFromISO(editedItem.endISO)}
                  onChange={handleEndTimeChange}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editedItem.notes || ''}
                onChangeText={(text) => setEditedItem({ ...editedItem, notes: text })}
                placeholder="Optional notes..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.label}>Lock this item</Text>
                <Text style={styles.hint}>Locked items stay fixed when regenerating the plan</Text>
              </View>
              <Switch
                value={editedItem.fixed}
                onValueChange={(value) => setEditedItem({ ...editedItem, fixed: value })}
                trackColor={{ false: '#444', true: '#22D3EE' }}
                thumbColor="#fff"
                disabled={editedItem.type === 'wake' || editedItem.type === 'sleep'}
              />
            </View>

              </ScrollView>

              <View style={styles.buttons}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                {onDelete && canDelete && (
                  <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()} disabled={isSaving}>
                  <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>

    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  keyboardContainer: {
    width: '100%',
  },
  safeArea: {
    width: '100%',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 24,
  },
  scrollView: {
    maxHeight: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
  },
  timeValue: {
    color: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeScroll: {
    marginTop: 8,
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#444',
    marginRight: 8,
  },
  typeChipSelected: {
    backgroundColor: '#22D3EE',
    borderColor: '#22D3EE',
  },
  typeChipText: {
    color: '#aaa',
    fontSize: 14,
  },
  typeChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  half: {
    flex: 1,
    marginRight: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 12,
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  deleteButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#dc2626',
    marginRight: 8,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#22D3EE',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  pickerCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  pickerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  pickerActionButton: {
    minWidth: 80,
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCancelText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  pickerDoneText: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '600',
  },
});
```

## packages/shared/src/schemas.ts

```
import { z } from 'zod';

// Fitness Goal
export const FitnessGoalSchema = z.enum([
  'FAT_LOSS',
  'WEIGHT_LOSS',
  'MAINTENANCE',
  'MUSCLE_GAIN',
  'PERFORMANCE',
  'GENERAL_HEALTH',
]);
export type FitnessGoal = z.infer<typeof FitnessGoalSchema>;

// Diet Foundation
export const DietFoundationSchema = z.enum([
  'BALANCED',
  'KETO',
  'CARNIVORE',
  'MEDITERRANEAN',
  'LOW_CALORIE',
  'LOW_FAT',
  'LOW_CARB',
  'HIGH_PROTEIN',
]);
export type DietFoundation = z.infer<typeof DietFoundationSchema>;

// Meal Category (for placement rules)
export const MealCategorySchema = z.enum(['LEAN', 'RICHER', 'COMFORT', 'NEUTRAL']);
export type MealCategory = z.infer<typeof MealCategorySchema>;

// Event Source
export const EventSourceSchema = z.enum(['AUTO', 'USER']);
export type EventSource = z.infer<typeof EventSourceSchema>;

// Event Status
export const EventStatusSchema = z.enum(['PLANNED', 'DONE', 'SKIPPED']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

// Day Modes
export const DayModeSchema = z.enum(['tight', 'flex', 'recovery', 'high-output', 'low-output']);
export type DayMode = z.infer<typeof DayModeSchema>;

// Meal Types
export const MealTypeSchema = z.enum(['lean-protein', 'richer-protein', 'carb-heavy', 'comfort-meal']);
export type MealType = z.infer<typeof MealTypeSchema>;

// Meal Properties
const MealPropertiesSchema = z.object({
  insulinImpact: z.number().min(0).max(10),
  digestionLoad: z.number().min(0).max(10),
  comfortFlag: z.boolean(),
  inflammationRisk: z.number().min(0).max(10),
});

export { MealPropertiesSchema };
export type MealProperties = z.infer<typeof MealPropertiesSchema>;

// Caffeine Type
export const CaffeineTypeSchema = z.enum(['espresso', 'coffee', 'tea', 'pre-workout']);
export type CaffeineType = z.infer<typeof CaffeineTypeSchema>;

// HR Zone
export const HRZoneSchema = z.enum(['zone1', 'zone2', 'zone3', 'zone4', 'zone5']);
export type HRZone = z.infer<typeof HRZoneSchema>;

// Activation Routine Type
export const ActivationTypeSchema = z.enum(['pre-walk', 'pre-meal', 'midday-reset', 'night-routine', 'posture-core']);
export type ActivationType = z.infer<typeof ActivationTypeSchema>;

// Canonical Clock Time
export const ClockTimeSchema = z.object({
  hour: z.number().int().min(1).max(12),
  minute: z.number().int().min(0).max(59),
  period: z.enum(['AM', 'PM']),
});
export type ClockTime = z.infer<typeof ClockTimeSchema>;

// Events (now with source, status, and category tracking)
export const MealEventSchema = z.object({
  type: z.literal('meal'),
  time: z.date(),
  mealType: MealTypeSchema,
  description: z.string().optional(),
  // New fields for self-adjusting behavior
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
  meal: z.object({
    category: MealCategorySchema.default('NEUTRAL'),
    template: z.string().optional(), // e.g., "protein + fibrous veg + fats"
  }).optional(),
});
export type MealEvent = z.infer<typeof MealEventSchema>;

export const CaffeineEventSchema = z.object({
  type: z.literal('caffeine'),
  time: z.date(),
  caffeineType: CaffeineTypeSchema,
  amount: z.number(),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
});
export type CaffeineEvent = z.infer<typeof CaffeineEventSchema>;

export const WalkEventSchema = z.object({
  type: z.literal('walk'),
  time: z.date(),
  duration: z.number(),
  hrZone: HRZoneSchema.optional(),
  postMeal: z.boolean().optional(),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
  hrTarget: z.string().optional(), // e.g., "55-65% (110-130 BPM)"
});
export type WalkEvent = z.infer<typeof WalkEventSchema>;

export const WorkoutEventSchema = z.object({
  type: z.literal('workout'),
  time: z.date(),
  duration: z.number(),
  intensity: z.enum(['light', 'moderate', 'hard', 'very-hard']),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
});
export type WorkoutEvent = z.infer<typeof WorkoutEventSchema>;

export const ActivationEventSchema = z.object({
  type: z.literal('activation'),
  time: z.date(),
  activationType: ActivationTypeSchema,
  duration: z.number(),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
});
export type ActivationEvent = z.infer<typeof ActivationEventSchema>;

export const HydrationEventSchema = z.object({
  type: z.literal('hydration'),
  time: z.date(),
  amount: z.number(),
  source: EventSourceSchema.default('AUTO'),
  status: EventStatusSchema.default('PLANNED'),
  originalPlannedTime: z.date().optional(),
});
export type HydrationEvent = z.infer<typeof HydrationEventSchema>;

export const EventSchema = z.discriminatedUnion('type', [
  MealEventSchema,
  CaffeineEventSchema,
  WalkEventSchema,
  WorkoutEventSchema,
  ActivationEventSchema,
  HydrationEventSchema,
]);
export type Event = z.infer<typeof EventSchema>;

// Constraint Block
export const ConstraintBlockSchema = z.object({
  start: z.date(),
  end: z.date(),
  type: z.enum(['work', 'meeting', 'social', 'travel', 'family', 'commute', 'exercise', 'appointment']),
  description: z.string().optional(),
});
export type ConstraintBlock = z.infer<typeof ConstraintBlockSchema>;

// Plan Step (moved before DayStateSchema to fix forward reference)
export const PlanStepSchema = z.object({
  id: z.string(),
  time: z.date(),
  event: EventSchema,
  reasoning: z.string(),
  isCompleted: z.boolean().default(false),
  isNext: z.boolean().default(false),
});
export type PlanStep = z.infer<typeof PlanStepSchema>;

// User Profile
export const UserProfileSchema = z.object({
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/),
  sleepTime: z.string().regex(/^\d{2}:\d{2}$/),
  wakeClockTime: ClockTimeSchema.optional(),
  sleepClockTime: ClockTimeSchema.optional(),
  wakeMin: z.number().min(0).max(1439).optional(),
  sleepMin: z.number().min(0).max(1439).optional(),
  preferredFastingHours: z.number().min(0).max(24),
  caffeineToleranceLow: z.boolean(),
  stressBaseline: z.number().min(1).max(10),
  restingHR: z.number().min(40).max(100).optional(),
  maxHR: z.number().min(100).max(220).optional(),
  defaultDayMode: DayModeSchema,
  mealSequencePreference: z.enum(['protein-first', 'carb-last', 'balanced']),
  // Fitness goal (influences plan generation)
  fitnessGoal: FitnessGoalSchema.default('MAINTENANCE'),
  // Work schedule
  workStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  workStartClockTime: ClockTimeSchema.optional(),
  workEndClockTime: ClockTimeSchema.optional(),
  workStartMin: z.number().min(0).max(1439).optional(),
  workEndMin: z.number().min(0).max(1439).optional(),
  commuteDuration: z.number().min(0).max(180).optional(), // minutes
  lunchTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  lunchClockTime: ClockTimeSchema.optional(),
  lunchStartMin: z.number().min(0).max(1439).optional(),
  lunchDurationMin: z.number().min(15).max(120).optional(),
  // Exercise preferences
  typicalExerciseTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).optional(),
  exerciseDays: z.array(z.number().min(0).max(6)).optional(), // 0=Sunday, 6=Saturday
  // Diet foundation (influences meal templates, not nutrition tracking)
  dietFoundation: DietFoundationSchema.default('BALANCED'),
  // Comfort meal preferences
  allowComfortWindow: z.boolean().default(true),
  useLearnedRhythm: z.boolean().default(true),
  comfortWindowPreferredTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), // e.g., "15:00"
  // Weekend schedule (different from weekday)
  weekendWakeTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekendSleepTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekendWorkStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  weekendWorkEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  useWeekendSchedule: z.boolean().default(false),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

// Day State (single source of truth for mobile + api)
export const DayStateSchema = z.object({
  // Identity
  deviceId: z.string(),
  dateKey: z.string(), // e.g., "2026-02-24"
  date: z.date(),
  // Current state
  dayMode: DayModeSchema,
  currentTime: z.date(),
  sleepQuality: z.number().min(1).max(10),
  stressLevel: z.number().min(1).max(10),
  currentHR: z.number().min(40).max(200).optional(),
  // All events (unified, with source/status)
  events: z.array(EventSchema).default([]),
  // Legacy planned arrays (kept for backward compatibility, will be migrated)
  plannedMeals: z.array(MealEventSchema).default([]),
  plannedCaffeine: z.array(CaffeineEventSchema).default([]),
  plannedWalks: z.array(WalkEventSchema).default([]),
  plannedWorkouts: z.array(WorkoutEventSchema).default([]),
  plannedActivations: z.array(ActivationEventSchema).default([]),
  constraints: z.array(ConstraintBlockSchema).default([]),
  completedEvents: z.array(EventSchema).default([]),
  isHungry: z.boolean().default(false),
  isCraving: z.boolean().default(false),
  // Track user modifications to generated plan
  removedStepIds: z.array(z.string()).default([]),
  modifiedEvents: z.record(z.string(), EventSchema).default({}),
  // Computed plan metadata
  lastComputedAt: z.date().optional(),
  computedPlan: z.array(PlanStepSchema).default([]),
  planMeta: z.object({
    mode: DayModeSchema.optional(),
    score: z.number().optional(),
    dayOneLiner: z.string().optional(),
    warnings: z.array(z.string()).default([]),
  }).optional(),
});
export type DayState = z.infer<typeof DayStateSchema>;

// Plan Output (extended with recompute hints)
export const PlanOutputSchema = z.object({
  version: z.number(),
  generatedAt: z.date(),
  dayOneLiner: z.string(),
  steps: z.array(PlanStepSchema),
  score: z.number(),
  scoreBreakdown: z.object({
    feasibility: z.number(),
    consistency: z.number(),
    metabolicStructure: z.number(),
    sleepProtection: z.number(),
    momentumPreservation: z.number(),
  }),
  warnings: z.array(z.string()),
  changes: z.array(z.string()),
  // Recompute hints for self-adjusting behavior
  recomputeHints: z.object({
    isStale: z.boolean(),
    nextScheduledEventTime: z.date().optional(),
    staleness: z.enum(['FRESH', 'AGING', 'STALE', 'CRITICAL']),
    reasoningMap: z.record(z.string(), z.string()).optional(),
  }).optional(),
});
export type PlanOutput = z.infer<typeof PlanOutputSchema>;

// Quick Update Types
export const QuickUpdateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delay-meal'), minutes: z.number() }),
  z.object({ action: z.literal('hungry') }),
  z.object({ action: z.literal('craving') }),
  z.object({ action: z.literal('caffeine-now') }),
  z.object({ action: z.literal('add-social-meal'), time: z.date(), mealType: MealTypeSchema }),
  z.object({ action: z.literal('workout-skipped'), workoutId: z.string() }),
  z.object({ action: z.literal('workout-added'), time: z.date(), duration: z.number(), intensity: z.string() }),
  z.object({ action: z.literal('walk-shortened'), walkId: z.string(), newDuration: z.number() }),
  z.object({ action: z.literal('walk-extended'), walkId: z.string(), newDuration: z.number() }),
  z.object({ action: z.literal('stress-spike'), newLevel: z.number() }),
]);
export type QuickUpdate = z.infer<typeof QuickUpdateSchema>;

// Demo Scenario
export const DemoScenarioSchema = z.object({
  name: z.string(),
  description: z.string(),
  userProfile: UserProfileSchema,
  dayState: DayStateSchema,
});
export type DemoScenario = z.infer<typeof DemoScenarioSchema>;

// Engine Input/Output (for deterministic core engine)
export const EngineInputSchema = z.object({
  now: z.date(),
  profile: UserProfileSchema,
  dayState: DayStateSchema,
  options: z.object({
    forceRecompute: z.boolean().default(false),
    stalenessThresholdMinutes: z.number().default(15),
  }).optional(),
});
export type EngineInput = z.infer<typeof EngineInputSchema>;

export const EngineOutputSchema = z.object({
  scheduleItems: z.array(PlanStepSchema), // rest-of-day only
  nextUp: PlanStepSchema.optional(),
  dayInOneLine: z.string(),
  reasoningMap: z.record(z.string(), z.string()),
  recomputeHints: z.object({
    isStale: z.boolean(),
    nextScheduledEventTime: z.date().optional(),
    staleness: z.enum(['FRESH', 'AGING', 'STALE', 'CRITICAL']),
  }),
  warnings: z.array(z.string()),
  score: z.number().optional(),
});
export type EngineOutput = z.infer<typeof EngineOutputSchema>;

// Schedule Item (for full-day plan generation)
export const ScheduleItemSchema = z.object({
  id: z.string(),
  type: z.enum(['wake', 'sleep', 'work', 'lunch', 'meal', 'snack', 'workout', 'walk', 'focus', 'break', 'prep', 'meeting', 'hydration', 'stretch', 'winddown', 'commute', 'recovery', 'caffeine', 'custom']),
  title: z.string(),
  startTime: ClockTimeSchema.optional(),
  endTime: ClockTimeSchema.nullable().optional(),
  startMin: z.number().min(0).max(1439).optional(),
  endMin: z.number().min(0).max(1439).optional(),
  durationMin: z.number().min(1).optional(),
  startISO: z.string(), // ISO datetime string
  endISO: z.string(), // ISO datetime string
  fixed: z.boolean().default(false), // locked by user or settings
   locked: z.boolean().optional(),
   deletable: z.boolean().optional(),
  status: z.enum(['planned', 'actual', 'skipped', 'adjusted', 'auto_adjusted']).default('planned'),
  source: z.enum(['system', 'user', 'advisor', 'generated', 'user_added', 'advisor_added', 'imported', 'settings', 'engine']).default('system'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  completedAt: z.string().optional(),
  origin: z.enum(['planned', 'actual']).optional(),
  notes: z.string().optional(),
  meta: z.record(z.any()).optional(), // flexible metadata
});
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;

// Day Plan (full day schedule)
export const DayPlanSchema = z.object({
  dateISO: z.string(), // YYYY-MM-DD
  items: z.array(ScheduleItemSchema),
  summary: z.string().optional(),
  recommendations: z.array(z.string()).optional(),
});
export type DayPlan = z.infer<typeof DayPlanSchema>;
```

## apps/mobile/src/components/LogActualEventModal.tsx

```
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import ClockTimeField from './ClockTimeField';
import { fromDateToClockTime, toSortableMinutes } from '../utils/clockTime';

export type ActualLogType = 'meal' | 'snack' | 'walk' | 'workout' | 'caffeine';

export interface ActualLogInput {
  type: ActualLogType;
  time: Date;
  mealType?: 'lean-protein' | 'richer-protein' | 'comfort-meal' | 'carb-heavy';
  snackCategory?: 'protein-focused' | 'bridge snack' | 'comfort snack' | 'light snack';
  durationMin?: number;
  intensity?: 'light' | 'moderate' | 'hard';
}

interface LogActualEventModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (input: ActualLogInput) => Promise<void> | void;
  isSaving?: boolean;
  initialInput?: Partial<ActualLogInput>;
}

const EVENT_TYPES: ActualLogType[] = ['meal', 'snack', 'walk', 'workout', 'caffeine'];
const MEAL_TYPES: NonNullable<ActualLogInput['mealType']>[] = ['lean-protein', 'richer-protein', 'comfort-meal', 'carb-heavy'];
const SNACK_CATEGORIES: NonNullable<ActualLogInput['snackCategory']>[] = ['protein-focused', 'bridge snack', 'comfort snack', 'light snack'];
const WORKOUT_INTENSITIES: NonNullable<ActualLogInput['intensity']>[] = ['light', 'moderate', 'hard'];

export default function LogActualEventModal({ visible, onClose, onSave, isSaving = false, initialInput }: LogActualEventModalProps) {
  const [type, setType] = useState<ActualLogType>('meal');
  const [time, setTime] = useState<Date>(new Date());
  const [mealType, setMealType] = useState<NonNullable<ActualLogInput['mealType']>>('lean-protein');
  const [snackCategory, setSnackCategory] = useState<NonNullable<ActualLogInput['snackCategory']>>('light snack');
  const [durationMin, setDurationMin] = useState('30');
  const [intensity, setIntensity] = useState<NonNullable<ActualLogInput['intensity']>>('moderate');
  const [clockTime, setClockTime] = useState(() => fromDateToClockTime(new Date()));

  useEffect(() => {
    if (visible) {
      setType(initialInput?.type || 'meal');
      setTime(initialInput?.time || new Date());
      setMealType(initialInput?.mealType || 'lean-protein');
      setSnackCategory(initialInput?.snackCategory || 'light snack');
      setDurationMin(String(initialInput?.durationMin || 30));
      setIntensity(initialInput?.intensity || 'moderate');
      setClockTime(fromDateToClockTime(initialInput?.time || new Date()));
    }
  }, [visible, initialInput]);

  const handleSave = async () => {
    const parsedDuration = Math.max(5, parseInt(durationMin, 10) || 30);
    const sortable = toSortableMinutes(clockTime);
    const eventDate = new Date(time);
    eventDate.setHours(Math.floor(sortable / 60), sortable % 60, 0, 0);
    await onSave({
      type,
      time: eventDate,
      mealType: type === 'meal' ? mealType : undefined,
      snackCategory: type === 'snack' ? snackCategory : undefined,
      durationMin: type === 'walk' || type === 'workout' ? parsedDuration : undefined,
      intensity: type === 'workout' ? intensity : undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView style={styles.scrollView}>
            <Text style={styles.title}>Log Actual Event</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                {EVENT_TYPES.map((eventType) => (
                  <TouchableOpacity
                    key={eventType}
                    style={[styles.chip, type === eventType && styles.chipSelected]}
                    onPress={() => setType(eventType)}
                  >
                    <Text style={[styles.chipText, type === eventType && styles.chipTextSelected]}>
                      {eventType[0].toUpperCase() + eventType.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Time</Text>
              <ClockTimeField
                value={clockTime || fromDateToClockTime(time)}
                onChange={setClockTime}
              />
            </View>

            {type === 'meal' && (
              <View style={styles.field}>
                <Text style={styles.label}>Meal Type</Text>
                <View style={styles.chipRow}>
                  {MEAL_TYPES.map((meal) => (
                    <TouchableOpacity
                      key={meal}
                      style={[styles.chip, mealType === meal && styles.chipSelected]}
                      onPress={() => setMealType(meal)}
                    >
                      <Text style={[styles.chipText, mealType === meal && styles.chipTextSelected]}>{meal}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {type === 'snack' && (
              <View style={styles.field}>
                <Text style={styles.label}>Snack Category</Text>
                <View style={styles.chipRow}>
                  {SNACK_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.chip, snackCategory === category && styles.chipSelected]}
                      onPress={() => setSnackCategory(category)}
                    >
                      <Text style={[styles.chipText, snackCategory === category && styles.chipTextSelected]}>{category}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {(type === 'walk' || type === 'workout') && (
              <View style={styles.field}>
                <Text style={styles.label}>Duration (minutes)</Text>
                <TextInput
                  style={styles.input}
                  value={durationMin}
                  onChangeText={setDurationMin}
                  keyboardType="number-pad"
                  placeholder="30"
                  placeholderTextColor="#666"
                />
              </View>
            )}

            {type === 'workout' && (
              <View style={styles.field}>
                <Text style={styles.label}>Intensity (optional)</Text>
                <View style={styles.chipRow}>
                  {WORKOUT_INTENSITIES.map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.chip, intensity === value && styles.chipSelected]}
                      onPress={() => setIntensity(value)}
                    >
                      <Text style={[styles.chipText, intensity === value && styles.chipTextSelected]}>{value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSaving}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => void handleSave()} disabled={isSaving}>
                <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Add to Timeline'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  modal: {
    backgroundColor: '#151515',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    maxHeight: '88%',
  },
  scrollView: {
    maxHeight: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#b7b7b7',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1e1e1e',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#fff',
  },
  inputText: {
    color: '#fff',
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1e1e1e',
  },
  chipSelected: {
    borderColor: '#22D3EE',
    backgroundColor: '#22D3EE22',
  },
  chipText: {
    color: '#9aa0a6',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#22D3EE',
    fontWeight: '600',
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#2a2a2a',
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    color: '#bbb',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#22D3EE',
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: {
    color: '#03181d',
    fontWeight: '700',
  },
});
```

## apps/mobile/src/screens/TimelineScreen.tsx

```
/**
 * AlignOS Timeline Screen
 * OS-Level "Day Command Center"
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlanStore } from '../store/planStore';
import { useAchievementStore } from '../store/achievementStore';
import { useAdaptivePlanStore } from '../store/adaptivePlanStore';
import { format, addMinutes, subDays } from 'date-fns';
import EditScheduleItemModal from '../components/EditScheduleItemModal';
import LogActualEventModal, { type ActualLogInput } from '../components/LogActualEventModal';
import EnergyForecast from '../components/EnergyForecast';
import QuickActionFAB from '../components/QuickActionFAB';
import { haptics } from '../utils/haptics';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { clockTimeFromISO, formatClockTime, fromDateToClockTime, parseClockTime, toISOWithClockTime, toSortableMinutes } from '../utils/clockTime';
import { validateSchedule } from '../engine/validateSchedule';
import { buildRecommendationContext } from '../utils/recommendationContext';
import { generateRecommendationsFromContext } from '../utils/recommendationEngine';
import type { DayPlan, ScheduleItem } from '@physiology-engine/shared';
import { 
  useTheme, 
  Card, 
  Pill, 
  IconButton, 
  PrimaryButton, 
  SecondaryButton,
  SectionTitle,
  AppIcon,
} from '@physiology-engine/ui';

export default function TimelineScreen({ navigation }: any) {
  const { colors, typography, spacing, radius } = useTheme();
  const API_BASE_URL = getApiBaseUrl();

  const formatScheduleTime = (item: ScheduleItem) => {
    const time = item.startTime || clockTimeFromISO(item.startISO);
    if (time) return formatClockTime(time);
    return '12:00 AM';
  };

  const toISOFromBaseAndMinutes = (baseISO: string | undefined, minutes: number) => {
    const normalized = ((Math.round(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
    const hour = (hour24 % 12) || 12;
    return toISOWithClockTime(baseISO, { hour, minute, period });
  };

  const toPickerDateFromMinutes = (mins: number) => {
    const normalized = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return new Date(2000, 0, 1, hours, minutes, 0, 0);
  };
  
  const {
    deviceId,
    fullDayPlan,
    profile,
    dayState,
    generatePlan,
    generateFullDayPlan,
    todayEntries,
    setTodayEntries,
    updateTodayEntry,
    deleteTodayEntry,
    addTodayEntry,
  } = usePlanStore();
  const insets = useSafeAreaInsets();
  
  const {
    checkAndUpdateStreak,
    markActivityComplete,
    markActivityIncomplete,
    todayCompleted,
  } = useAchievementStore();
  
  const {
    initialize: initializeAdaptive,
    markItemCompleted,
    getAdjustedSchedule,
  } = useAdaptivePlanStore();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdatingSchedule, setIsUpdatingSchedule] = useState(false);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logInitialInput, setLogInitialInput] = useState<Partial<ActualLogInput> | undefined>(undefined);
  const [showUndo, setShowUndo] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<ScheduleItem[] | null>(null);
  const [showRealityPrompt, setShowRealityPrompt] = useState(false);
  const [recomputeCount, setRecomputeCount] = useState(0);
  const [selectedDateISO, setSelectedDateISO] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [historicalPlan, setHistoricalPlan] = useState<DayPlan | null>(null);
  const [historicalDayState, setHistoricalDayState] = useState<{ dayMode?: string; sleepQuality?: number; stressLevel?: number } | null>(null);

  const todayDateISO = format(new Date(), 'yyyy-MM-dd');
  const yesterdayDateISO = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const isHistoricalMode = selectedDateISO !== todayDateISO;

  useEffect(() => {
    if (dayState && !fullDayPlan && !isGenerating) {
      handleGeneratePlan();
    }
    checkAndUpdateStreak();
    initializeAdaptive();
  }, [dayState, fullDayPlan]);

  useEffect(() => {
    const loadHistoricalDay = async () => {
      if (!isHistoricalMode || !deviceId) {
        setHistoricalPlan(null);
        setHistoricalDayState(null);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/day/${deviceId}/${selectedDateISO}`);
        if (!response.ok) {
          setHistoricalPlan(null);
          setHistoricalDayState(null);
          return;
        }

        const payload = await response.json();
        setHistoricalPlan(payload?.fullDayPlan || null);
        setHistoricalDayState(payload?.dayState || null);
      } catch (error) {
        console.warn('[Timeline] Failed to load historical day', error);
        setHistoricalPlan(null);
        setHistoricalDayState(null);
      }
    };

    void loadHistoricalDay();
  }, [isHistoricalMode, selectedDateISO, deviceId, API_BASE_URL]);

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    haptics.light();
    try {
      await generateFullDayPlan();
      haptics.success();
    } catch (err) {
      console.error('Error generating plan:', err);
      haptics.error();
    } finally {
      setIsGenerating(false);
    }
  };

  const handleItemTap = (item: ScheduleItem) => {
    if (isHistoricalMode) return;
    haptics.light();
    setEditingItem(item);
  };

  const handleToggleComplete = (item: ScheduleItem) => {
    if (isHistoricalMode) return;
    haptics.medium();
    if (todayCompleted[item.id]) {
      markActivityIncomplete(item.id);
    } else {
      markActivityComplete(item.id);
      markItemCompleted(item, new Date());
    }
  };

  const handleAddRecommendation = async (activity: Omit<ScheduleItem, 'id'>) => {
    if (isHistoricalMode) return;
    haptics.success();
    await applyMutationWithRefresh(async () => {
      await addTodayEntry(activity);
    });
  };

  const handleShiftSchedule = (minutes: number) => {
    if (isHistoricalMode) return;
    haptics.light();
    // TODO: Implement shift logic
    console.log(`Shift schedule by ${minutes} minutes`);
  };

  const handleInsertWalk = () => {
    if (isHistoricalMode) return;
    haptics.success();
    const now = new Date();
    void applyMutationWithRefresh(async () => {
      await addTodayEntry({
        type: 'walk',
        title: '10min Walk',
        startISO: now.toISOString(),
        endISO: addMinutes(now, 10).toISOString(),
        startMin: now.getHours() * 60 + now.getMinutes(),
        endMin: now.getHours() * 60 + now.getMinutes() + 10,
        durationMin: 10,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'planned',
        notes: 'Quick movement break',
      });
    });
  };

  const handleAddMeal = () => {
    if (isHistoricalMode) return;
    haptics.success();
    const now = new Date();
    void applyMutationWithRefresh(async () => {
      await addTodayEntry({
        type: 'meal',
        title: 'Meal',
        startISO: now.toISOString(),
        endISO: addMinutes(now, 30).toISOString(),
        startMin: now.getHours() * 60 + now.getMinutes(),
        endMin: now.getHours() * 60 + now.getMinutes() + 30,
        durationMin: 30,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'planned',
      });
    });
  };

  const handleAddSnack = () => {
    if (isHistoricalMode) return;
    haptics.success();
    const now = new Date();
    void applyMutationWithRefresh(async () => {
      await addTodayEntry({
        type: 'snack',
        title: 'Snack',
        startISO: now.toISOString(),
        endISO: addMinutes(now, 15).toISOString(),
        startMin: now.getHours() * 60 + now.getMinutes(),
        endMin: now.getHours() * 60 + now.getMinutes() + 15,
        durationMin: 15,
        fixed: false,
        locked: false,
        deletable: true,
        source: 'user',
        status: 'planned',
      });
    });
  };

  const handleSaveItem = async (item: ScheduleItem) => {
    if (isHistoricalMode) return;
    await applyMutationWithRefresh(async () => {
      await updateTodayEntry(item.id, item);
    });
    setEditingItem(null);
  };

  const handleDeleteItem = async () => {
    if (isHistoricalMode) return;
    if (editingItem) {
      await applyMutationWithRefresh(async () => {
        await deleteTodayEntry(editingItem.id);
      });
      setEditingItem(null);
    }
  };

  const recomputeWithBackendAndRefresh = async () => {
    setRecomputeCount((value) => value + 1);
    try {
      if (deviceId && profile) {
        await fetch(`${API_BASE_URL}/day/${deviceId}/recompute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
      }
    } catch (error) {
      console.warn('[Timeline] Recompute endpoint unavailable, using local refresh', error);
    }

    await generatePlan(true);
    await generateFullDayPlan();
  };

  const executeTimelineAction = async (actionId: string) => {
    if (actionId === 'INSERT_WALK_10') {
      const now = new Date();
      const startMin = now.getHours() * 60 + now.getMinutes();
      await applyMutationWithRefresh(async () => {
        await addTodayEntry({
          type: 'walk',
          title: '10min Walk',
          startISO: now.toISOString(),
          endISO: addMinutes(now, 10).toISOString(),
          startMin,
          endMin: startMin + 10,
          durationMin: 10,
          fixed: false,
          locked: false,
          deletable: true,
          source: 'user',
          status: 'planned',
          notes: 'Inserted from system suggestion',
        });
      });
      return;
    }

    if (actionId === 'INSERT_WALK_8') {
      const now = new Date();
      const startMin = now.getHours() * 60 + now.getMinutes();
      await applyMutationWithRefresh(async () => {
        await addTodayEntry({
          type: 'walk',
          title: '8min Reset Walk',
          startISO: now.toISOString(),
          endISO: addMinutes(now, 8).toISOString(),
          startMin,
          endMin: startMin + 8,
          durationMin: 8,
          fixed: false,
          locked: false,
          deletable: true,
          source: 'user',
          status: 'planned',
          notes: 'Momentum protection micro-reset',
        });
      });
      return;
    }

    if (actionId === 'SHIFT_LUNCH_EARLIER_15') {
      const lunch = sortedItems.find((item) => item.type === 'meal');
      if (!lunch) return;
      const shiftedStartMin = lunch.startMin - 15;
      const shiftedEndMin = lunch.endMin - 15;
      await applyMutationWithRefresh(async () => {
        await updateTodayEntry(lunch.id, {
          startISO: toISOFromBaseAndMinutes(lunch.startISO, shiftedStartMin),
          endISO: toISOFromBaseAndMinutes(lunch.endISO, shiftedEndMin),
          startMin: shiftedStartMin,
          endMin: shiftedEndMin,
          durationMin: shiftedEndMin - shiftedStartMin,
          status: 'adjusted',
          updatedAt: new Date().toISOString(),
        });
      });
      return;
    }

    if (actionId === 'DELAY_CAFFEINE_20') {
      const caffeine = sortedItems.find((item) => item.meta?.actualType === 'caffeine' || item.title.toLowerCase().includes('caffeine') || item.title.toLowerCase().includes('coffee'));
      if (!caffeine) return;
      const shiftedStartMin = caffeine.startMin + 20;
      const shiftedEndMin = caffeine.endMin + 20;
      await applyMutationWithRefresh(async () => {
        await updateTodayEntry(caffeine.id, {
          startISO: toISOFromBaseAndMinutes(caffeine.startISO, shiftedStartMin),
          endISO: toISOFromBaseAndMinutes(caffeine.endISO, shiftedEndMin),
          startMin: shiftedStartMin,
          endMin: shiftedEndMin,
          durationMin: shiftedEndMin - shiftedStartMin,
          status: 'adjusted',
          updatedAt: new Date().toISOString(),
        });
      });
      return;
    }

    if (actionId === 'RECOMPUTE_FROM_NOW') {
      await recomputeWithBackendAndRefresh();
    }
  };

  const applyMutationWithRefresh = async (mutation: () => Promise<void>) => {
    setIsUpdatingSchedule(true);
    try {
      await mutation();
      await recomputeWithBackendAndRefresh();
    } finally {
      setIsUpdatingSchedule(false);
    }
  };

  const createScheduleItemFromActualLog = (input: ActualLogInput): Omit<ScheduleItem, 'id'> => {
    const start = new Date(input.time);
    const fallbackDuration = input.type === 'walk' ? 20 : input.type === 'workout' ? 35 : input.type === 'meal' ? 30 : input.type === 'snack' ? 15 : 5;
    const duration = input.durationMin && input.durationMin > 0 ? input.durationMin : fallbackDuration;

    const title =
      input.type === 'meal'
        ? `Meal (${input.mealType || 'lean-protein'})`
        : input.type === 'snack'
          ? `Snack (${input.snackCategory || 'light snack'})`
        : input.type === 'walk'
          ? `Walk (${duration}min)`
          : input.type === 'workout'
            ? `Workout (${duration}min)`
            : 'Caffeine';

    return {
      type: input.type === 'caffeine' ? 'custom' : input.type,
      title,
      startISO: start.toISOString(),
      endISO: addMinutes(start, duration).toISOString(),
      startTime: fromDateToClockTime(start),
      endTime: fromDateToClockTime(addMinutes(start, duration)),
      startMin: start.getHours() * 60 + start.getMinutes(),
      endMin: start.getHours() * 60 + start.getMinutes() + duration,
      durationMin: duration,
      fixed: false,
      locked: false,
      deletable: true,
      source: 'user',
      status: 'actual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: start.toISOString(),
      origin: 'actual',
      notes: input.type === 'workout' && input.intensity ? `actual-${input.intensity}` : 'actual-log',
      meta: {
        actualType: input.type,
        mealType: input.mealType,
        snackCategory: input.snackCategory,
        durationMin: duration,
        intensity: input.intensity,
      },
    };
  };

  const createBackendActualEvent = (input: ActualLogInput): any => {
    const dateISO = input.time.toISOString();

    if (input.type === 'meal') {
      return {
        type: 'meal',
        action: 'ACTUAL_MEAL_LOGGED',
        time: dateISO,
        mealType: input.mealType || 'lean-protein',
        source: 'USER',
        status: 'DONE',
        description: 'Retroactive meal log',
      };
    }

    if (input.type === 'snack') {
      return {
        type: 'snack',
        action: 'ACTUAL_SNACK_LOGGED',
        time: dateISO,
        snackCategory: input.snackCategory || 'light snack',
        source: 'USER',
        status: 'DONE',
        description: 'Retroactive snack log',
      };
    }

    if (input.type === 'walk') {
      return {
        type: 'walk',
        action: 'ACTUAL_WALK_LOGGED',
        time: dateISO,
        duration: input.durationMin || 20,
        source: 'USER',
        status: 'DONE',
      };
    }

    if (input.type === 'workout') {
      return {
        type: 'workout',
        action: 'ACTUAL_WORKOUT_LOGGED',
        time: dateISO,
        duration: input.durationMin || 35,
        intensity: input.intensity || 'moderate',
        source: 'USER',
        status: 'DONE',
      };
    }

    return {
      type: 'caffeine',
      action: 'ACTUAL_CAFFEINE_LOGGED',
      time: dateISO,
      caffeineType: 'coffee',
      amount: 1,
      source: 'USER',
      status: 'DONE',
    };
  };

  const postActualEventToBackend = async (input: ActualLogInput) => {
    if (!deviceId || !profile) return;
    const event = createBackendActualEvent(input);
    await fetch(`${API_BASE_URL}/day/${deviceId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, profile }),
    });
  };

  const handleSaveActualLog = async (input: ActualLogInput) => {
    if (isHistoricalMode) return;
    const snapshot = [...todayEntries];
    setUndoSnapshot(snapshot);

    await applyMutationWithRefresh(async () => {
      await addTodayEntry(createScheduleItemFromActualLog(input));
      await postActualEventToBackend(input);
    });

    setShowLogModal(false);
    setLogInitialInput(undefined);
    setShowUndo(true);
    setShowRealityPrompt(true);
    setTimeout(() => setShowUndo(false), 5000);
  };

  const handleMarkDone = async (item: ScheduleItem) => {
    if (isHistoricalMode) return;
    const completedAt = new Date();
    await applyMutationWithRefresh(async () => {
      await updateTodayEntry(item.id, {
        status: 'actual',
        completedAt: completedAt.toISOString(),
        updatedAt: completedAt.toISOString(),
        origin: 'actual',
      });
      if (deviceId && profile) {
        await fetch(`${API_BASE_URL}/day/${deviceId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: {
              type: item.type,
              action: 'ITEM_MARKED_DONE',
              itemId: item.id,
              time: completedAt.toISOString(),
              source: 'USER',
              status: 'DONE',
            },
            profile,
          }),
        });
      }
    });

    setShowRealityPrompt(true);
  };

  const handleMarkSkipped = async (item: ScheduleItem) => {
    if (isHistoricalMode) return;
    const skippedAt = new Date();
    await applyMutationWithRefresh(async () => {
      await updateTodayEntry(item.id, {
        status: 'skipped',
        updatedAt: skippedAt.toISOString(),
      });
      if (deviceId && profile) {
        await fetch(`${API_BASE_URL}/day/${deviceId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: {
              type: item.type,
              action: 'ITEM_MARKED_SKIPPED',
              itemId: item.id,
              time: skippedAt.toISOString(),
              source: 'USER',
              status: 'SKIPPED',
            },
            profile,
          }),
        });
      }
    });

    setShowRealityPrompt(true);
  };

  const handleLogSimilar = (item: ScheduleItem) => {
    if (isHistoricalMode) return;
    const startMin = item.startMin || toSortableMinutes(item.startTime || clockTimeFromISO(item.startISO) || { hour: 12, minute: 0, period: 'AM' });
    const endMin = item.endMin || (startMin + (item.durationMin || 5));
    const time = toPickerDateFromMinutes(startMin);
    const similarType: ActualLogInput['type'] =
      item.type === 'meal' || item.type === 'snack' || item.type === 'walk' || item.type === 'workout'
        ? item.type
        : item.type === 'custom'
          ? ((item.meta?.actualType as ActualLogInput['type']) || 'caffeine')
          : 'caffeine';

    setLogInitialInput({
      type: similarType,
      time,
      durationMin: Math.max(5, endMin - startMin),
      mealType: (item.meta?.mealType as ActualLogInput['mealType']) || 'lean-protein',
      snackCategory: (item.meta?.snackCategory as ActualLogInput['snackCategory']) || 'light snack',
      intensity: (item.meta?.intensity as ActualLogInput['intensity']) || 'moderate',
    });
    setShowLogModal(true);
  };

  const openItemActions = (item: ScheduleItem) => {
    if (isHistoricalMode) return;
    Alert.alert('Timeline Actions', item.title, [
      { text: 'Mark Done', onPress: () => void handleMarkDone(item) },
      { text: 'Mark Skipped', onPress: () => void handleMarkSkipped(item) },
      { text: 'Adjust Time', onPress: () => setEditingItem(item) },
      { text: 'Log Similar', onPress: () => handleLogSimilar(item) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRealityRecomputeNow = async () => {
    setShowRealityPrompt(false);
    await recomputeWithBackendAndRefresh();
  };

  const handleRealityTighten = async () => {
    setShowRealityPrompt(false);
    if (deviceId && profile) {
      try {
        await fetch(`${API_BASE_URL}/day/${deviceId}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: {
              type: 'custom',
              action: 'PLAN_REGENERATED',
              time: new Date().toISOString(),
              source: 'USER',
              status: 'DONE',
            },
            profile: { ...profile, defaultDayMode: 'tight' },
          }),
        });
      } catch (error) {
        console.warn('[Timeline] Tighten action event failed', error);
      }
    }
    await recomputeWithBackendAndRefresh();
  };

  const handleUndoActualLog = async () => {
    if (isHistoricalMode) return;
    if (!undoSnapshot) return;
    await applyMutationWithRefresh(async () => {
      await setTodayEntries(undoSnapshot);
    });
    setShowUndo(false);
    setUndoSnapshot(null);
  };

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <AppIcon name="alert" size={48} color={colors.textSecondary} />
          <Text style={[typography.bodyM, { color: colors.textSecondary, marginTop: spacing.lg }]}>
            No profile found
          </Text>
          <PrimaryButton
            onPress={() => navigation.navigate('Onboarding')}
            style={{ marginTop: spacing.xl }}
          >
            Set Up Profile
          </PrimaryButton>
        </View>
      </View>
    );
  }

  const activePlan = isHistoricalMode ? historicalPlan : fullDayPlan;
  const activeDayState = isHistoricalMode ? historicalDayState : dayState;

  if (!activePlan) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <AppIcon name="calendar" size={48} color={colors.textSecondary} />
          <Text style={[typography.bodyM, { color: colors.textSecondary, marginTop: spacing.lg }]}>
            No plan generated yet
          </Text>
          <PrimaryButton
            onPress={handleGeneratePlan}
            disabled={isGenerating}
            style={{ marginTop: spacing.xl }}
          >
            {isGenerating ? 'Generating...' : 'Generate Full Day Plan'}
          </PrimaryButton>
        </View>
      </View>
    );
  }

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTime = {
    hour: ((now.getHours() % 12) || 12),
    minute: now.getMinutes(),
    period: now.getHours() >= 12 ? 'PM' as const : 'AM' as const,
  };
  const wakeTime = profile.wakeClockTime || parseClockTime(profile.wakeTime) || { hour: 7, minute: 0, period: 'AM' as const };
  const sleepTime = profile.sleepClockTime || parseClockTime(profile.sleepTime) || { hour: 11, minute: 0, period: 'PM' as const };
  const timelineValidation = validateSchedule({
    items: activePlan.items,
    wakeTime,
    sleepTime,
  });
  const sortedItems = timelineValidation.items.map((item) => {
    const startClock = item.startTime || clockTimeFromISO(item.startISO);
    const endClock = item.endTime || clockTimeFromISO(item.endISO);
    const startMin = startClock ? toSortableMinutes(startClock) : 0;
    const endMin = endClock ? toSortableMinutes(endClock) : startMin + (item.durationMin || 5);
    return {
      ...item,
      startTime: startClock || item.startTime,
      endTime: endClock || item.endTime,
      startMin,
      endMin,
      durationMin: item.durationMin || Math.max(5, endMin - startMin),
    };
  });
  const nextItem = sortedItems.find(
    (item) => !todayCompleted[item.id] && item.startMin > nowMinutes
  );

  const recommendationContext = profile
    ? buildRecommendationContext({
        dateISO: selectedDateISO,
        profile,
        dayState: (activeDayState as any) || null,
        plan: activePlan,
        todayEntries,
      })
    : null;

  const recommendationOutput = recommendationContext
    ? generateRecommendationsFromContext(recommendationContext)
    : { cards: activePlan.recommendations || [], actions: [] as Array<{ id: string; label: string }> };

  const momentumState: 'stable' | 'wobble' | 'collapse_risk' = (() => {
    const skipped = sortedItems.filter((item) => item.status === 'skipped').length;
    const actual = sortedItems.filter((item) => item.status === 'actual' || item.origin === 'actual').length;
    const total = Math.max(1, sortedItems.length);
    const skipRatio = skipped / total;
    const stress = activeDayState?.stressLevel || 5;
    const sleep = activeDayState?.sleepQuality || 7;

    if (skipRatio >= 0.25 || (stress >= 8 && sleep <= 5) || recomputeCount >= 4) {
      return 'collapse_risk';
    }
    if (skipRatio >= 0.1 || stress >= 7 || sleep <= 6 || recomputeCount >= 2 || actual <= 1) {
      return 'wobble';
    }
    return 'stable';
  })();

  const systemSuggestions: Array<{ id: string; label: string }> = (() => {
    if (recommendationOutput.actions.length > 0) {
      return recommendationOutput.actions;
    }

    if (momentumState === 'collapse_risk') {
      return [
        { id: 'INSERT_WALK_8', label: 'Insert 8-min walk' },
        { id: 'DELAY_CAFFEINE_20', label: 'Delay caffeine 20 min' },
        { id: 'RECOMPUTE_FROM_NOW', label: 'Tighten afternoon' },
      ];
    }
    if (momentumState === 'wobble') {
      return [
        { id: 'INSERT_WALK_8', label: 'Insert 8-min walk' },
        { id: 'SHIFT_LUNCH_EARLIER_15', label: 'Shift lunch earlier' },
      ];
    }
    return [];
  })();

  const getItemIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      wake: 'sunrise',
      sleep: 'sleep',
      work: 'work',
      meal: 'meal',
      snack: 'snack',
      workout: 'workout',
      walk: 'walk',
      focus: 'focus',
      break: 'break',
      meeting: 'meeting',
      hydration: 'water',
      stretch: 'stretch',
      winddown: 'winddown',
    };
    return iconMap[type] || 'calendar';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.fixedHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}> 
        <View style={styles.fixedHeaderTop}>
          <IconButton icon="back" onPress={() => navigation.goBack()} variant="subtle" />
          <View style={styles.controlBarCenter}>
            <Text style={[typography.titleL, { color: colors.textPrimary }]}>Today</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 13 }]}>
              {format(new Date(`${selectedDateISO}T12:00:00`), 'EEEE, MMM d')}
            </Text>
          </View>
          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => navigation.navigate('Progress')}
              accessibilityRole="button"
            >
              <AppIcon name="chart" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerActionButton}
              onPress={() => navigation.navigate('Settings')}
              accessibilityRole="button"
            >
              <AppIcon name="settings" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <Pill
              label={activeDayState?.dayMode || 'tight'}
              variant="accent"
            />
          </View>
        </View>

        <View style={styles.fixedHeaderBottom}>
          <View style={styles.chipRow}>
            <TouchableOpacity onPress={() => setSelectedDateISO(yesterdayDateISO)} style={{ marginRight: spacing.xs }}>
              <Pill label="Yesterday" variant={selectedDateISO === yesterdayDateISO ? 'accent' : 'muted'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelectedDateISO(todayDateISO)} style={{ marginRight: spacing.xs }}>
              <Pill label="Today" variant={selectedDateISO === todayDateISO ? 'accent' : 'muted'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('TomorrowPreview')}>
              <Pill label="Tomorrow" variant="muted" />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
            <Pill
              label={`Sleep ${activeDayState?.sleepQuality || 7}/10`}
              variant="muted"
              style={{ marginRight: spacing.xs }}
            />
            <Pill
              label={`Stress ${activeDayState?.stressLevel || 'low'}`}
              variant="muted"
              style={{ marginRight: spacing.xs }}
            />
            <Pill
              label="Fast 16h"
              variant="muted"
            />
          </View>

          {!isHistoricalMode && (
            <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
              <TouchableOpacity onPress={() => { setLogInitialInput(undefined); setShowLogModal(true); }}>
                <View style={styles.logButton}>
                  <AppIcon name="plusCircle" size={14} color={colors.accentPrimary} />
                  <Text style={[typography.caption, { color: colors.accentPrimary, marginLeft: 4, fontSize: 11 }]}> 
                    Log
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleGeneratePlan} disabled={isGenerating}>
                <View style={styles.regenerateButton}>
                  <AppIcon name="refresh" size={14} color={colors.accentPrimary} />
                  <Text style={[typography.caption, { color: colors.accentPrimary, marginLeft: 4, fontSize: 11 }]}> 
                    Regenerate
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {isHistoricalMode && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>Historical view (read-only)</Text>
        )}
        {isUpdatingSchedule && (
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 6 }]}>Updating...</Text>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
      >
        {/* Now + Next Module */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <Card>
            <View style={styles.nowNextHeader}>
              <View style={styles.nowBadge}>
                <AppIcon name="flash" size={12} color={colors.accentPrimary} />
                <Text style={[typography.caption, { color: colors.accentPrimary, marginLeft: 4, fontSize: 11 }]}>
                  NOW
                </Text>
              </View>
              <Text style={[typography.bodyM, { color: colors.textSecondary, fontFamily: 'monospace', fontSize: 14 }]}>
                {formatClockTime(nowTime)}
              </Text>
            </View>

            {!timelineValidation.valid && (
              <Text style={[typography.caption, { color: colors.accentPrimary, marginTop: spacing.xs }]}> 
                {`Timeline repaired: ${timelineValidation.issues[0]}`}
              </Text>
            )}
            
            {nextItem && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xs }]}>
                  Up next
                </Text>
                <View style={styles.nextItem}>
                  <AppIcon name={getItemIcon(nextItem.type)} size={20} color={colors.textSecondary} />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '600' }]}>
                      {nextItem.title}
                    </Text>
                    <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 13 }]}>
                      {formatScheduleTime(nextItem)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
            
            <View style={[styles.quickActions, { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}>
              <SecondaryButton
                onPress={() => handleShiftSchedule(15)}
                style={{ flex: 1, marginRight: spacing.xs }}
              >
                Shift +15
              </SecondaryButton>
              <SecondaryButton
                onPress={handleInsertWalk}
                style={{ flex: 1, marginRight: spacing.xs }}
              >
                Insert Walk
              </SecondaryButton>
              <SecondaryButton
                onPress={handleAddMeal}
                style={{ flex: 1, marginRight: spacing.xs }}
              >
                Add Meal
              </SecondaryButton>
              <SecondaryButton
                onPress={handleAddSnack}
                style={{ flex: 1 }}
              >
                Add Snack
              </SecondaryButton>
            </View>
          </Card>
        </View>

        {/* Energy Forecast */}
        {profile && (
          <EnergyForecast
            profile={profile}
            plan={activePlan}
            deviceId={deviceId || undefined}
            dateISO={activePlan.dateISO}
            onAction={isHistoricalMode ? undefined : (actionId) => void executeTimelineAction(actionId)}
          />
        )}

        {momentumState === 'collapse_risk' && (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Card>
              <View style={styles.sectionHeader}>
                <AppIcon name="alert" size={16} color={colors.accentPrimary} />
                <SectionTitle title="Momentum protection activated" />
              </View>
              <Text style={[typography.bodyM, { color: colors.textMuted, marginBottom: spacing.sm }]}>System Suggestion</Text>
              {systemSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.id}
                  style={[styles.realityAction, { borderColor: colors.borderSubtle, marginBottom: spacing.xs }]}
                  onPress={() => void executeTimelineAction(suggestion.id)}
                >
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>{suggestion.label}</Text>
                </TouchableOpacity>
              ))}
            </Card>
          </View>
        )}

        {/* Suggested Insertions */}
        {recommendationOutput.cards && recommendationOutput.cards.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
            <View style={styles.sectionHeader}>
              <AppIcon name="sparkles" size={18} color={colors.textPrimary} />
              <SectionTitle title="Suggested Insertions" />
            </View>
            
            {recommendationOutput.cards.slice(0, 3).map((rec, index) => {
              const recLower = rec.toLowerCase();
              const iconName = recLower.includes('walk') ? 'walk' : 
                             recLower.includes('water') ? 'water' :
                             recLower.includes('stretch') ? 'stretch' : 'plus';
              
              return (
                <Card key={index} style={{ marginTop: spacing.md }}>
                  <View style={styles.suggestionRow}>
                    <AppIcon name={iconName} size={20} color={colors.textSecondary} />
                    <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                      <Text style={[typography.bodyM, { color: colors.textPrimary, marginBottom: 2 }]}>
                        {rec.split('.')[0]}
                      </Text>
                      <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12 }]}>
                        Context-driven timing
                      </Text>
                    </View>
                    <IconButton 
                      icon="plusCircle" 
                      onPress={() => isHistoricalMode ? undefined : handleAddRecommendation({
                        type: 'walk',
                        title: rec.split('.')[0],
                        startISO: now.toISOString(),
                        endISO: addMinutes(now, 15).toISOString(),
                        startMin: now.getHours() * 60 + now.getMinutes(),
                        endMin: now.getHours() * 60 + now.getMinutes() + 15,
                        durationMin: 15,
                        fixed: false,
                        locked: false,
                        deletable: true,
                        source: 'user',
                        status: 'planned',
                      })}
                      variant="accent"
                      size={24}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Schedule List */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xl }}>
          <View style={styles.sectionHeader}>
            <AppIcon name="calendar" size={18} color={colors.textPrimary} />
            <SectionTitle title="Today's Schedule" />
          </View>
          
          {sortedItems.map((item: ScheduleItem, index: number) => {
            const isCompleted = todayCompleted[item.id];
            const isNext = nextItem?.id === item.id;
            const fallbackEndMin = (item.startMin || 0) + (item.durationMin || 5);
            const isPast = (item.endMin ?? fallbackEndMin) < nowMinutes;
            const isActual = item.status === 'actual' || item.origin === 'actual';
            const isSkipped = item.status === 'skipped';
            const isAdjusted = item.status === 'adjusted';
            
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleItemTap(item)}
                onLongPress={() => openItemActions(item)}
                delayLongPress={250}
                activeOpacity={0.7}
                style={{ marginTop: spacing.md }}
              >
                <View style={[
                  styles.scheduleCard,
                  { 
                    backgroundColor: colors.surfaceElevated,
                    borderColor: isNext ? colors.accentPrimary : colors.borderSubtle,
                    borderWidth: 1,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    opacity: isCompleted || isSkipped ? 0.5 : 1,
                  }
                ]}>
                  <View style={styles.scheduleLeft}>
                    <Text style={[typography.bodyM, { color: isNext ? colors.accentPrimary : colors.textSecondary, fontWeight: '600' }]}>
                      {formatScheduleTime(item)}
                    </Text>
                  </View>
                  
                  <View style={styles.scheduleCenter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <AppIcon 
                        name={getItemIcon(item.type)} 
                        size={16} 
                        color={colors.textSecondary} 
                      />
                      <Text style={[
                        typography.bodyM, 
                        { 
                          color: colors.textPrimary, 
                          fontWeight: '600', 
                          marginLeft: spacing.xs,
                          textDecorationLine: isCompleted || isSkipped ? 'line-through' : 'none',
                        }
                      ]}>
                        {item.title}
                      </Text>
                      {isActual && (
                        <View style={[styles.actualTag, { borderColor: `${colors.accentPrimary}66` }]}>
                          <AppIcon name="checkCircle" size={10} color={colors.accentPrimary} />
                          <Text style={[typography.caption, { color: colors.accentPrimary, marginLeft: 4, fontSize: 10 }]}>Actual</Text>
                        </View>
                      )}
                      {isAdjusted && (
                        <View style={[styles.actualTag, { borderColor: `${colors.textMuted}66` }]}>
                          <Text style={[typography.caption, { color: colors.textMuted, fontSize: 10 }]}>Adjusted</Text>
                        </View>
                      )}
                    </View>
                    
                    {item.notes && item.notes !== 'deleted-marker' && (
                      <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12 }]}>
                        {item.notes}
                      </Text>
                    )}
                  </View>
                  
                  <View style={styles.scheduleRight}>
                    {isCompleted ? (
                      <AppIcon name="checkCircle" size={24} color={colors.success} />
                    ) : item.fixed ? (
                      <AppIcon name="lock" size={20} color={colors.textMuted} />
                    ) : (
                      <TouchableOpacity onPress={() => handleToggleComplete(item)}>
                        <AppIcon name="check" size={24} color={colors.borderSubtle} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
          <Card>
            <View style={styles.sectionHeader}>
              <AppIcon name="calendar" size={18} color={colors.textPrimary} />
              <SectionTitle title="Tomorrow Preview" />
            </View>
            <Text style={[typography.bodyM, { color: colors.textMuted, marginBottom: spacing.md }]}>
              Open a focused view with wake/sleep, work block, lunch, and key anchors.
            </Text>
            <PrimaryButton onPress={() => navigation.navigate('TomorrowPreview')} style={{ marginTop: spacing.md }}>
              Open Tomorrow Preview
            </PrimaryButton>
          </Card>
        </View>
      </ScrollView>

      <EditScheduleItemModal
        visible={!!editingItem}
        item={editingItem}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        onClose={() => setEditingItem(null)}
        isSaving={isUpdatingSchedule}
      />

      <LogActualEventModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSave={handleSaveActualLog}
        isSaving={isUpdatingSchedule}
        initialInput={logInitialInput}
      />

      {showRealityPrompt && (
        <View style={[styles.realityPrompt, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}> 
          <Text style={[typography.bodyM, { color: colors.textPrimary, fontWeight: '600', marginBottom: 4 }]}>Adjust the rest of the day?</Text>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8 }]}>Reality mode update detected</Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={() => void handleRealityRecomputeNow()} style={[styles.realityAction, { marginRight: 8, borderColor: colors.accentPrimary }]}>
              <Text style={[typography.caption, { color: colors.accentPrimary }]}>Recompute from now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowRealityPrompt(false)} style={[styles.realityAction, { marginRight: 8, borderColor: colors.borderSubtle }]}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Keep as-is</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void handleRealityTighten()} style={[styles.realityAction, { borderColor: colors.borderSubtle }]}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>Tighten structure</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showUndo && (
        <View style={[styles.undoSnackbar, { backgroundColor: colors.surfaceElevated, borderColor: colors.accentPrimary }]}> 
          <Text style={[typography.bodyM, { color: colors.textPrimary, flex: 1 }]}>Added to timeline</Text>
          <TouchableOpacity onPress={handleUndoActualLog}>
            <Text style={[typography.bodyM, { color: colors.accentPrimary, fontWeight: '600' }]}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}

      <QuickActionFAB onPress={() => navigation.navigate('Chat')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  fixedHeader: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  fixedHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  controlBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fixedHeaderBottom: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flex: 1,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 4,
  },
  nowNextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nextItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleLeft: {
    width: 50,
    marginRight: 12,
  },
  scheduleCenter: {
    flex: 1,
  },
  actualTag: {
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scheduleRight: {
    marginLeft: 12,
  },
  undoSnackbar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  realityPrompt: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 78,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  realityAction: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});
```

## apps/mobile/src/screens/TomorrowPreviewScreen.tsx

```
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DayPlan, ScheduleItem, UserProfile } from '@physiology-engine/shared';
import { addDays, format } from 'date-fns';
import { usePlanStore } from '../store/planStore';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { minutesTo12h, minutesToHHmm, parseTimeToMinutes } from '../utils/time';
import { buildTimelinePlan } from '../utils/planGenerator';
import { toISOWithClockTime } from '../utils/clockTime';
import { buildRecommendationContext } from '../utils/recommendationContext';
import { generateRecommendationsFromContext } from '../utils/recommendationEngine';
import { useTheme, Card, PrimaryButton, SecondaryButton, AppIcon } from '@physiology-engine/ui';

interface TomorrowPayload {
  dateKey?: string;
  dateISO?: string;
  wakeTime: string;
  sleepTime: string;
  workStartTime?: string;
  workEndTime?: string;
  anchors: Array<{ title: string; time: string }>;
  suggestions?: string[];
  items?: ScheduleItem[];
}

export default function TomorrowPreviewScreen() {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { getTomorrowPreview, deviceId, profile, fullDayPlan, dayState } = usePlanStore();
  const API_BASE_URL = getApiBaseUrl();
  const [preview, setPreview] = useState<TomorrowPayload | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tomorrowDateISO = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const tomorrowStorageKey = `tomorrowPreview_${tomorrowDateISO}`;

  const toDisplayTime = (value?: string) => {
    const parsed = parseTimeToMinutes(value);
    if (parsed === null) return value || '';
    return minutesTo12h(parsed);
  };

  const getFallbackPreview = async () => {
    if (!profile) {
      const fallback = await getTomorrowPreview();
      setPreview(fallback);
      return;
    }

    const generated = buildTimelinePlan({
      dateISO: tomorrowDateISO,
      settings: profile,
      todayEntries: [],
      constraints: dayState?.constraints,
      plannedMeals: dayState?.plannedMeals,
      plannedWorkouts: dayState?.plannedWorkouts,
    });
    const fallback = mapPlanToPreview(generated, profile);
    setPreview(fallback);
  };

  const fetchWithTimeout = async (url: string, init?: RequestInit, timeoutMs = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const loadPreview = async () => {
    setIsLoading(true);
    try {
      const localSaved = await AsyncStorage.getItem(tomorrowStorageKey);
      if (localSaved) {
        setPreview(JSON.parse(localSaved));
        return;
      }

      if (deviceId) {
        const response = await fetchWithTimeout(`${API_BASE_URL}/day/${deviceId}/tomorrow`);
        if (response.ok) {
          const payload = await response.json();
          setPreview(payload as TomorrowPayload);
          await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(payload));
          return;
        }
      }

      await getFallbackPreview();
    } catch (error) {
      console.warn('[TomorrowPreview] Failed to load API preview, using local fallback', error);
      await getFallbackPreview();
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateTomorrow = async () => {
    if (!profile) {
      await getFallbackPreview();
      return;
    }

    setIsLoading(true);
    try {
      const generatedPlan = buildTimelinePlan({
        dateISO: tomorrowDateISO,
        settings: profile,
        todayEntries: [],
        constraints: dayState?.constraints,
        plannedMeals: dayState?.plannedMeals,
        plannedWorkouts: dayState?.plannedWorkouts,
      });

      const localPayload = mapPlanToPreview(generatedPlan, profile);
      setPreview(localPayload);
      await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(localPayload));

      if (deviceId) {
        await fetchWithTimeout(`${API_BASE_URL}/day/${deviceId}/tomorrow/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
      }
    } catch (error) {
      console.warn('[TomorrowPreview] Generate API unavailable, using local fallback', error);
      await getFallbackPreview();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyTodayStructure = async () => {
    if (!profile || !fullDayPlan) return;

    const wakeMin = parseTimeToMinutes(profile.wakeTime) ?? 420;
    const sleepMin = parseTimeToMinutes(profile.sleepTime) ?? 1380;
    const todayWakeMin = fullDayPlan.items.find((item) => item.type === 'wake')?.startMin ?? wakeMin;
    const offsetFromTodayWake = wakeMin - todayWakeMin;

    const copyable = fullDayPlan.items.filter((item) => item.type !== 'wake' && item.type !== 'sleep');
    const copiedEntries: ScheduleItem[] = copyable.map((item) => {
      const rawStart = (item.startMin ?? wakeMin) + offsetFromTodayWake;
      const duration = Math.max(5, item.durationMin || ((item.endMin ?? rawStart + 5) - rawStart));
      const clampedStart = Math.max(wakeMin + 5, Math.min(rawStart, sleepMin - duration - 5));
      const clampedEnd = clampedStart + duration;

      const startHour24 = Math.floor(clampedStart / 60);
      const startMinute = clampedStart % 60;
      const endHour24 = Math.floor(clampedEnd / 60);
      const endMinute = clampedEnd % 60;

      const startClock = {
        hour: (startHour24 % 12) || 12,
        minute: startMinute,
        period: (startHour24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
      };
      const endClock = {
        hour: (endHour24 % 12) || 12,
        minute: endMinute,
        period: (endHour24 >= 12 ? 'PM' : 'AM') as 'AM' | 'PM',
      };

      return {
        ...item,
        id: `tomorrow-copy-${item.id}`,
        startMin: clampedStart,
        endMin: clampedEnd,
        durationMin: duration,
        startTime: startClock,
        endTime: endClock,
        startISO: toISOWithClockTime(`${tomorrowDateISO}T00:00:00.000Z`, startClock),
        endISO: toISOWithClockTime(`${tomorrowDateISO}T00:00:00.000Z`, endClock),
        source: 'user',
        status: 'planned',
        locked: false,
        deletable: true,
      } as ScheduleItem;
    });

    const generatedPlan = buildTimelinePlan({
      dateISO: tomorrowDateISO,
      settings: profile,
      todayEntries: copiedEntries,
      constraints: dayState?.constraints,
      plannedMeals: dayState?.plannedMeals,
      plannedWorkouts: dayState?.plannedWorkouts,
    });

    const localPayload = mapPlanToPreview(generatedPlan, profile);
    setPreview(localPayload);
    await AsyncStorage.setItem(tomorrowStorageKey, JSON.stringify(localPayload));

    if (deviceId) {
      try {
        await fetchWithTimeout(`${API_BASE_URL}/day/${deviceId}/tomorrow/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
      } catch (error) {
        console.warn('[TomorrowPreview] Failed to sync copied structure to API; local preview is saved', error);
      }
    }
  };

  useEffect(() => {
    void loadPreview();
  }, []);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <AppIcon name="calendar" size={18} color={colors.textPrimary} />
          <Text style={[typography.titleM, { color: colors.textPrimary, marginLeft: spacing.sm }]}>Tomorrow Preview</Text>
        </View>

        {preview ? (
          <>
            <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.xs }]}>Wake: {toDisplayTime(preview.wakeTime)}</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Sleep: {toDisplayTime(preview.sleepTime)}</Text>
            {(preview.workStartTime && preview.workEndTime) ? (
              <Text style={[typography.bodyM, { color: colors.textSecondary, marginBottom: spacing.sm }]}>Work: {toDisplayTime(preview.workStartTime)} - {toDisplayTime(preview.workEndTime)}</Text>
            ) : null}
            {preview.anchors.map((anchor, index) => (
              <Text key={`${anchor.title}-${index}`} style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}>• {toDisplayTime(anchor.time)} {anchor.title}</Text>
            ))}

            {preview.items?.length ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.bodyM, { color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }]}>Full schedule</Text>
                {preview.items.slice(0, 12).map((item) => (
                  <Text key={item.id} style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}>• {minutesTo12h(item.startMin || 0)} {item.title}</Text>
                ))}
              </View>
            ) : null}

            {preview.suggestions?.length ? (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.bodyM, { color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }]}>Tomorrow suggestions</Text>
                {preview.suggestions.slice(0, 3).map((suggestion, index) => (
                  <Text key={`${suggestion}-${index}`} style={[typography.bodyM, { color: colors.textMuted, marginBottom: 4 }]}>• {suggestion}</Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[typography.bodyM, { color: colors.textMuted }]}>Loading preview...</Text>
        )}

        <PrimaryButton onPress={handleGenerateTomorrow} style={{ marginTop: spacing.lg }}>
          {isLoading ? 'Generating...' : 'Generate Tomorrow Plan'}
        </PrimaryButton>
        <SecondaryButton onPress={handleCopyTodayStructure} style={{ marginTop: spacing.sm }}>
          Copy Today Structure
        </SecondaryButton>
      </Card>
    </ScrollView>
  );
}

function mapPlanToPreview(plan: DayPlan, profile: UserProfile): TomorrowPayload {
  const recommendationContext = buildRecommendationContext({
    dateISO: plan.dateISO,
    profile,
    dayState: null,
    plan,
    todayEntries: plan.items,
  });
  const recommendationOutput = generateRecommendationsFromContext(recommendationContext);

  const anchors = plan.items
    .filter((item) => item.type === 'wake' || item.type === 'work' || item.type === 'lunch' || item.type === 'meal' || item.type === 'snack' || item.type === 'workout' || item.type === 'walk' || item.type === 'sleep')
    .slice(0, 10)
    .map((item) => ({
      title: item.title,
      time: minutesToHHmm(item.startMin || 0),
    }));

  return {
    dateISO: plan.dateISO,
    wakeTime: profile.wakeTime,
    sleepTime: profile.sleepTime,
    workStartTime: profile.workStartTime,
    workEndTime: profile.workEndTime,
    anchors,
    suggestions: recommendationOutput.cards.length ? recommendationOutput.cards : (plan.recommendations || []),
    items: plan.items,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

## apps/mobile/src/store/planStore.ts

```
/**
 * PLAN STATE MANAGER
 * Single source of truth for plan generation, event mutations, and sync.
 * Handles local offline computation and API sync when available.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  UserProfile,
  DayState,
  PlanStep,
  Event,
  MealEvent,
  WalkEvent,
  ConstraintBlock,
  EngineInput,
  EngineOutput,
  ScheduleItem,
  DayPlan,
} from '@physiology-engine/shared';
import { generatePlan } from '@physiology-engine/engine';
import { format, addMinutes, parse } from 'date-fns';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { buildTimelinePlan } from '../utils/planGenerator';
import { applyScheduleMutation } from '../engine/applyScheduleMutation';
import { buildDaySchedule } from '../engine/buildDaySchedule';
import { clockTimeFromISO, parseClockTime, toISOWithClockTime } from '../utils/clockTime';
import {
  compareByStartMin,
  ensureStartEnd,
  minutesToHHmm,
  parseTimeToMinutes,
} from '../utils/time';

// Simple UUID generator (fallback if expo-crypto not available)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export type SyncStatus = 'offline' | 'syncing' | 'synced' | 'error';

export interface TomorrowPreview {
  dateISO: string;
  wakeTime: string;
  sleepTime: string;
  workStartTime?: string;
  workEndTime?: string;
  anchors: Array<{ title: string; time: string }>;
  items?: ScheduleItem[];
  suggestions?: string[];
  generated: boolean;
}

interface PlanState {
  // Core state
  deviceId: string | null;
  profile: UserProfile | null;
  dayState: DayState | null;
  computedPlan: EngineOutput | null;
  
  // Full-day plan (new)
  todayEntries: ScheduleItem[];
  fullDayPlan: DayPlan | null;
  
  // Sync status
  syncStatus: SyncStatus;
  lastSyncAt: Date | null;
  syncError: string | null;
  
  // Auto-refresh
  autoRefreshEnabled: boolean;
  autoRefreshIntervalMs: number;
  
  // Actions: Initialization
  initialize: () => Promise<void>;
  loadProfile: () => Promise<UserProfile | null>;
  saveProfile: (profile: UserProfile) => Promise<void>;
  
  // Actions: Plan Generation
  generatePlan: (forceRecompute?: boolean) => Promise<void>;
  generateFullDayPlan: () => Promise<void>;
  checkStaleness: () => 'FRESH' | 'AGING' | 'STALE' | 'CRITICAL';
  setupToday: (dayState: Partial<DayState>) => Promise<void>;
  
  // Actions: Today Entries (new)
  addTodayEntry: (entry: Omit<ScheduleItem, 'id'>) => Promise<string>;
  setTodayEntries: (entries: ScheduleItem[]) => Promise<void>;
  updateTodayEntry: (id: string, updates: Partial<ScheduleItem>) => Promise<void>;
  deleteTodayEntry: (id: string) => Promise<void>;
  getTomorrowPreview: () => Promise<TomorrowPreview>;
  
  // Actions: Event Mutations
  addEvent: (event: Event) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<Event>) => Promise<void>;
  markDone: (eventId: string) => Promise<void>;
  markSkipped: (eventId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  
  // Actions: Quick Updates
  delayMeal: (mealId: string, minutes: number) => Promise<void>;
  addComfortMeal: (time: Date) => Promise<void>;
  addMeetingBlock: (start: Date, end: Date, description?: string) => Promise<void>;
  shortenWalk: (walkId: string, newDuration: number) => Promise<void>;
  setStress: (level: number) => Promise<void>;
  setSleep: (level: number) => Promise<void>;
  
  // Actions: Sync
  syncToAPI: () => Promise<void>;
  enableAutoRefresh: () => void;
  disableAutoRefresh: () => void;
}

// API configuration
const API_BASE_URL = getApiBaseUrl();
const API_TIMEOUT = 5000; // 5 seconds

function migrateProfileTimes(profile: UserProfile): UserProfile {
  const wakeMin = profile.wakeMin ?? parseTimeToMinutes(profile.wakeTime) ?? 420;
  const sleepMin = profile.sleepMin ?? parseTimeToMinutes(profile.sleepTime) ?? 1380;
  const workStartMin = profile.workStartMin ?? parseTimeToMinutes(profile.workStartTime);
  const workEndMin = profile.workEndMin ?? parseTimeToMinutes(profile.workEndTime);
  const lunchStartMin = profile.lunchStartMin ?? parseTimeToMinutes(profile.lunchTime);
  const wakeClockTime = profile.wakeClockTime ?? parseClockTime(profile.wakeTime);
  const sleepClockTime = profile.sleepClockTime ?? parseClockTime(profile.sleepTime);
  const workStartClockTime = profile.workStartClockTime ?? parseClockTime(profile.workStartTime);
  const workEndClockTime = profile.workEndClockTime ?? parseClockTime(profile.workEndTime);
  const lunchClockTime = profile.lunchClockTime ?? parseClockTime(profile.lunchTime);

  return {
    ...profile,
    wakeMin,
    sleepMin,
    workStartMin: workStartMin ?? undefined,
    workEndMin: workEndMin ?? undefined,
    lunchStartMin: lunchStartMin ?? undefined,
    wakeTime: minutesToHHmm(wakeMin),
    sleepTime: minutesToHHmm(sleepMin),
    workStartTime: workStartMin !== null && workStartMin !== undefined ? minutesToHHmm(workStartMin) : profile.workStartTime,
    workEndTime: workEndMin !== null && workEndMin !== undefined ? minutesToHHmm(workEndMin) : profile.workEndTime,
    lunchTime: lunchStartMin !== null && lunchStartMin !== undefined ? minutesToHHmm(lunchStartMin) : profile.lunchTime,
    wakeClockTime: wakeClockTime || undefined,
    sleepClockTime: sleepClockTime || undefined,
    workStartClockTime: workStartClockTime || undefined,
    workEndClockTime: workEndClockTime || undefined,
    lunchClockTime: lunchClockTime || undefined,
  };
}

function normalizeScheduleEntries(entries: ScheduleItem[]): ScheduleItem[] {
  const dateISO = format(new Date(), 'yyyy-MM-dd');
  const normalizedEntries: ScheduleItem[] = entries.map((entry) => {
    const normalizedTime = ensureStartEnd(entry);
    const startTime = entry.startTime || clockTimeFromISO(entry.startISO);
    const endTime = entry.endTime || (entry.endISO ? clockTimeFromISO(entry.endISO) : undefined);
    const status: ScheduleItem['status'] =
      entry.status === 'actual' || entry.status === 'skipped' || entry.status === 'adjusted'
        ? entry.status
        : entry.status === 'auto_adjusted'
          ? 'adjusted'
          : 'planned';
    const source: ScheduleItem['source'] =
      entry.source === 'user' || entry.source === 'advisor' || entry.source === 'system'
        ? entry.source
        : entry.source === 'advisor_added'
          ? 'advisor'
          : entry.source === 'user_added'
            ? 'user'
            : 'system';

    return {
      ...normalizedTime,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      startISO: startTime ? toISOWithClockTime(`${dateISO}T00:00:00.000Z`, startTime) : entry.startISO,
      endISO: endTime ? toISOWithClockTime(`${dateISO}T00:00:00.000Z`, endTime) : entry.endISO,
      status,
      source,
      locked: entry.type === 'wake' || entry.type === 'sleep',
      deletable: entry.type !== 'wake' && entry.type !== 'sleep',
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as ScheduleItem;
  });

  const sorted = [...normalizedEntries].sort(compareByStartMin);

  const applyMinutesToIso = (baseISO: string, minutesFromMidnight: number): string => {
    const datePart = (baseISO || new Date().toISOString()).split('T')[0];
    const normalized = ((Math.round(minutesFromMidnight) % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
    const minutes = String(normalized % 60).padStart(2, '0');
    return `${datePart}T${hours}:${minutes}:00.000Z`;
  };

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const current = sorted[i];

    const prevEndMin = ensureStartEnd(prev).endMin;
    const currentNormalized = ensureStartEnd(current);
    const currentStartMin = currentNormalized.startMin;

    if (currentStartMin < prevEndMin) {
      const durationMin = Math.max(5, currentNormalized.endMin - currentStartMin);
      const pushedStartMin = prevEndMin;
      const pushedEndMin = pushedStartMin + durationMin;

      sorted[i] = {
        ...current,
        startMin: pushedStartMin,
        endMin: pushedEndMin,
        durationMin,
        startISO: applyMinutesToIso(current.startISO, pushedStartMin),
        endISO: applyMinutesToIso(current.endISO, pushedEndMin),
      };
    }
  }

  return sorted;
}

export const usePlanStore = create<PlanState>((set, get) => ({
  deviceId: null,
  profile: null,
  dayState: null,
  computedPlan: null,
  todayEntries: [],
  fullDayPlan: null,
  syncStatus: 'offline',
  lastSyncAt: null,
  syncError: null,
  autoRefreshEnabled: true,
  autoRefreshIntervalMs: 60000, // 60 seconds
  
  // Initialize store
  initialize: async () => {
    try {
      // Get or create device ID
      let deviceId = await AsyncStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = generateUUID();
        await AsyncStorage.setItem('deviceId', deviceId);
      }
      
      // Load profile from planStore location
      let profile = await get().loadProfile();
      
      // MIGRATION: If no profile in new location, check old appStore location
      if (!profile) {
        const oldAppState = await AsyncStorage.getItem('appState');
        if (oldAppState) {
          const parsed = JSON.parse(oldAppState);
          if (parsed.userProfile) {
            profile = parsed.userProfile;
            // Migrate to new location
            await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
          }
        }
      }

      if (profile) {
        profile = migrateProfileTimes(profile);
        await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
      }
      
      // Load today's day state
      const dateKey = format(new Date(), 'yyyy-MM-dd');
      let dayState: DayState | null = null;
      
      // Try new location first
      const dayStateJson = await AsyncStorage.getItem(`dayState_${dateKey}`);
      if (dayStateJson) {
        dayState = JSON.parse(dayStateJson, (key, value) => {
          // Revive Date objects
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            return new Date(value);
          }
          return value;
        });
      }
      
      // MIGRATION: Check old appStore location
      if (!dayState) {
        const oldAppState = await AsyncStorage.getItem('appState');
        if (oldAppState) {
          const parsed = JSON.parse(oldAppState, (key, value) => {
            if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
              return new Date(value);
            }
            return value;
          });
          if (parsed.dayState) {
            dayState = {
              ...parsed.dayState,
              deviceId: deviceId,
              dateKey: dateKey,
              events: parsed.dayState.events || [],
              computedPlan: parsed.dayState.computedPlan || [],
            };
          }
        }
      }
      
      // Load today's entries
      const todayEntriesJson = await AsyncStorage.getItem(`todayEntries_${dateKey}`);
      let todayEntries: ScheduleItem[] = [];
      if (todayEntriesJson) {
        todayEntries = normalizeScheduleEntries(JSON.parse(todayEntriesJson));
      }
      
      // Load full day plan
      const fullDayPlanJson = await AsyncStorage.getItem(`fullDayPlan_${dateKey}`);
      let fullDayPlan: DayPlan | null = null;
      if (fullDayPlanJson) {
        fullDayPlan = JSON.parse(fullDayPlanJson);
      }
      
      set({ deviceId, profile, dayState, todayEntries, fullDayPlan });
      
      // Generate initial plan if we have profile and dayState
      if (profile && dayState) {
        await get().generatePlan(true);
        await get().generateFullDayPlan();
      }
    } catch (error) {
      console.error('[PlanStore] Initialize error:', error);
      set({ syncStatus: 'error', syncError: String(error) });
    }
  },
  
  loadProfile: async () => {
    const profileJson = await AsyncStorage.getItem('userProfile');
    if (profileJson) {
      return migrateProfileTimes(JSON.parse(profileJson));
    }
    return null;
  },
  
  saveProfile: async (profile: UserProfile) => {
    const normalizedProfile = migrateProfileTimes(profile);
    await AsyncStorage.setItem('userProfile', JSON.stringify(normalizedProfile));
    set({ profile: normalizedProfile });
    
    // Regenerate plan with new profile
    await get().generatePlan(true);
  },
  
  // Setup today's day state
  setupToday: async (dayStateInput: Partial<DayState>) => {
    const { deviceId, profile } = get();
    
    if (!profile) {
      console.error('[PlanStore] Cannot setup day without profile');
      return;
    }
    
    const now = new Date();
    const dateKey = format(now, 'yyyy-MM-dd');
    
    // Create complete day state with required fields
    const dayState: DayState = {
      deviceId: deviceId || 'unknown',
      dateKey,
      date: now,
      dayMode: dayStateInput.dayMode || profile.defaultDayMode || 'flex',
      currentTime: now,
      sleepQuality: dayStateInput.sleepQuality || 7,
      stressLevel: dayStateInput.stressLevel || profile.stressBaseline || 5,
      isHungry: dayStateInput.isHungry || false,
      isCraving: dayStateInput.isCraving || false,
      events: dayStateInput.events || [],
      constraints: dayStateInput.constraints || [],
      plannedMeals: dayStateInput.plannedMeals || [],
      plannedCaffeine: dayStateInput.plannedCaffeine || [],
      plannedWalks: dayStateInput.plannedWalks || [],
      plannedWorkouts: dayStateInput.plannedWorkouts || [],
      plannedActivations: dayStateInput.plannedActivations || [],
      completedEvents: dayStateInput.completedEvents || [],
      removedStepIds: dayStateInput.removedStepIds || [],
      modifiedEvents: dayStateInput.modifiedEvents || {},
      computedPlan: [],
    };
    
    // Save to storage
    await AsyncStorage.setItem(`dayState_${dateKey}`, JSON.stringify(dayState));
    
    // Update state
    set({ dayState });
    
    // Generate plan (legacy)
    await get().generatePlan(true);
    
    // Generate full day plan (new)
    await get().generateFullDayPlan();
  },
  
  // Generate plan using core engine
  generatePlan: async (forceRecompute = false) => {
    const { profile, dayState, syncToAPI } = get();
    
    if (!profile) {
      console.warn('[PlanStore] Cannot generate plan without profile');
      return;
    }
    
    if (!dayState) {
      console.warn('[PlanStore] No day state found. Please set up today first.');
      return;
    }
    
    try {
      // Call core engine (local compute)
      const input: EngineInput = {
        now: new Date(),
        profile,
        dayState,
        options: {
          forceRecompute,
          stalenessThresholdMinutes: 15,
        },
      };
      
      const output = generatePlan(input);
      
      // Update day state with computed plan
      const updatedDayState: DayState = {
        ...dayState,
        lastComputedAt: new Date(),
        computedPlan: output.scheduleItems,
        planMeta: {
          mode: dayState.dayMode,
          score: output.score,
          dayOneLiner: output.dayInOneLine,
          warnings: output.warnings,
        },
      };
      
      // Save to local storage
      const dateKey = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem(`dayState_${dateKey}`, JSON.stringify(updatedDayState));
      
      set({
        dayState: updatedDayState,
        computedPlan: output,
        syncStatus: 'synced',
      });
      
      // Attempt API sync (non-blocking)
      syncToAPI().catch(err => {
        console.warn('[PlanStore] Background sync failed:', err);
      });
    } catch (error) {
      console.error('[PlanStore] Generate plan error:', error);
      set({ syncStatus: 'error', syncError: String(error) });
    }
  },
  
  checkStaleness: () => {
    const { computedPlan } = get();
    if (!computedPlan || !computedPlan.recomputeHints) {
      return 'CRITICAL';
    }
    return computedPlan.recomputeHints.staleness;
  },
  
  // Generate Full Day Plan (new comprehensive planner)
  generateFullDayPlan: async () => {
    const { profile, todayEntries, dayState } = get();
    
    if (!profile) {
      console.warn('[PlanStore] Cannot generate full day plan without profile');
      return;
    }
    
    try {
      const dateISO = format(new Date(), 'yyyy-MM-dd');
      const canonicalTodayEntries = buildDaySchedule({
        dateISO,
        settings: profile,
        existingItems: todayEntries,
      });
      
      const fullPlan = buildTimelinePlan({
        dateISO,
        settings: profile,
        todayEntries: canonicalTodayEntries,
        constraints: dayState?.constraints,
        plannedWorkouts: dayState?.plannedWorkouts,
        plannedMeals: dayState?.plannedMeals,
      });
      
      // Save to storage
      await AsyncStorage.setItem(`fullDayPlan_${dateISO}`, JSON.stringify(fullPlan));
      
      set({ fullDayPlan: fullPlan });
      
      console.log('[PlanStore] Full day plan generated:', fullPlan.summary);
    } catch (error) {
      console.error('[PlanStore] Generate full day plan error:', error);
      set({ syncError: String(error) });
    }
  },
  
  // Add today entry
  addTodayEntry: async (entry: Omit<ScheduleItem, 'id'>) => {
    const { todayEntries, profile } = get();
    if (!profile) return '';
    const nowISO = new Date().toISOString();
    
    const newEntry: ScheduleItem = {
      ...entry,
      id: generateUUID(),
      status: entry.status || (entry.origin === 'actual' ? 'actual' : 'planned'),
      source: entry.source === 'advisor' ? 'advisor' : 'user',
      locked: entry.type === 'wake' || entry.type === 'sleep',
      deletable: entry.type !== 'wake' && entry.type !== 'sleep',
      createdAt: entry.createdAt || nowISO,
      updatedAt: nowISO,
    };

    const updated = applyScheduleMutation({
      currentItems: normalizeScheduleEntries(todayEntries),
      mutation: { kind: 'add', item: newEntry },
      settings: profile,
      dateISO: format(new Date(), 'yyyy-MM-dd'),
    });
    set({ todayEntries: updated });
    
    // Save to storage
    const dateISO = format(new Date(), 'yyyy-MM-dd');
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));
    
    // Regenerate plan
    await get().generateFullDayPlan();

    return newEntry.id;
  },

  setTodayEntries: async (entries: ScheduleItem[]) => {
    const { profile } = get();
    if (!profile) return;
    const normalized = buildDaySchedule({
      settings: profile,
      existingItems: normalizeScheduleEntries(entries),
      dateISO: format(new Date(), 'yyyy-MM-dd'),
    });
    set({ todayEntries: normalized });

    const dateISO = format(new Date(), 'yyyy-MM-dd');
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(normalized));

    await get().generateFullDayPlan();
  },
  
  // Update today entry
  updateTodayEntry: async (id: string, updates: Partial<ScheduleItem>) => {
    const { todayEntries, fullDayPlan, profile } = get();
    if (!profile) return;
    const nowISO = new Date().toISOString();
    
    // Check if item exists in todayEntries
    const existingIndex = todayEntries.findIndex(entry => entry.id === id);
    
    let updated: ScheduleItem[];
    
    if (existingIndex >= 0) {
      // Update existing user entry
      updated = todayEntries.map(entry =>
        entry.id === id
          ? {
              ...entry,
              ...updates,
              source: 'user',
              updatedAt: nowISO,
            }
          : entry
      );
    } else {
      // Item is from settings or engine - convert to user entry
      // Find the original item from fullDayPlan
      const originalItem = fullDayPlan?.items.find(item => item.id === id);
      
      if (originalItem) {
        // Add as new user entry with updates
        const newUserEntry: ScheduleItem = {
          ...originalItem,
          ...updates,
          source: 'user',
          status: updates.status || originalItem.status || 'planned',
          createdAt: originalItem.createdAt || nowISO,
          updatedAt: nowISO,
          // Preserve the fixed value from updates, or default to false for user entries
          fixed: updates.fixed !== undefined ? updates.fixed : false,
        };
        updated = [...todayEntries, newUserEntry];
      } else {
        console.warn('[PlanStore] Could not find item to update:', id);
        return;
      }
    }

    updated = applyScheduleMutation({
      currentItems: normalizeScheduleEntries(updated),
      mutation: { kind: 'edit', id, updates },
      settings: profile,
      dateISO: format(new Date(), 'yyyy-MM-dd'),
    });
    
    set({ todayEntries: updated });
    
    // Save to storage
    const dateISO = format(new Date(), 'yyyy-MM-dd');
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));
    
    // Regenerate plan
    await get().generateFullDayPlan();
  },
  
  // Delete today entry
  deleteTodayEntry: async (id: string) => {
    const { todayEntries, profile, fullDayPlan } = get();
    if (!profile) return;

    const generatedEntry = fullDayPlan?.items.find((item) => item.id === id);

    if (generatedEntry && generatedEntry.type !== 'wake' && generatedEntry.type !== 'sleep') {
      const marker: ScheduleItem = {
        id: `suppress-${id}`,
        type: 'custom',
        title: 'Suppressed Item',
        startISO: generatedEntry.startISO,
        endISO: generatedEntry.endISO,
        startTime: generatedEntry.startTime,
        endTime: generatedEntry.endTime,
        startMin: generatedEntry.startMin,
        endMin: generatedEntry.endMin,
        durationMin: generatedEntry.durationMin || 5,
        fixed: false,
        locked: false,
        deletable: false,
        status: 'skipped',
        source: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: 'deleted-marker',
        meta: {
          suppressedId: id,
        },
      };

      const withoutTarget = todayEntries.filter((entry) => entry.id !== id);
      const withoutOldMarkers = withoutTarget.filter((entry) => entry.meta?.suppressedId !== id);
      const withMarker = normalizeScheduleEntries([...withoutOldMarkers, marker]);
      set({ todayEntries: withMarker });
      const dateISO = format(new Date(), 'yyyy-MM-dd');
      await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(withMarker));
      await get().generateFullDayPlan();
      return;
    }

    const updated = applyScheduleMutation({
      currentItems: normalizeScheduleEntries(todayEntries),
      mutation: { kind: 'delete', id },
      settings: profile,
      dateISO: format(new Date(), 'yyyy-MM-dd'),
    });

    set({ todayEntries: updated });

    const dateISO = format(new Date(), 'yyyy-MM-dd');
    await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(updated));
    
    // Regenerate plan
    await get().generateFullDayPlan();
  },

  getTomorrowPreview: async () => {
    const { profile, dayState } = get();
    const tomorrow = addMinutes(new Date(), 24 * 60);
    const dateISO = format(tomorrow, 'yyyy-MM-dd');

    if (!profile) {
      return {
        dateISO,
        wakeTime: '07:00',
        sleepTime: '23:00',
        anchors: [
          { title: 'Meal 1', time: '08:30' },
          { title: 'Lunch', time: '12:30' },
          { title: 'Workout / Walk', time: '17:30' },
        ],
        generated: false,
      };
    }

    const generated = buildTimelinePlan({
      dateISO,
      settings: profile,
      todayEntries: [],
      constraints: dayState?.constraints,
      plannedMeals: dayState?.plannedMeals,
      plannedWorkouts: dayState?.plannedWorkouts,
    });

    return {
      dateISO,
      wakeTime: profile.wakeTime,
      sleepTime: profile.sleepTime,
      workStartTime: profile.workStartTime,
      workEndTime: profile.workEndTime,
      anchors: generated.items
        .filter((item) => item.type === 'wake' || item.type === 'work' || item.type === 'lunch' || item.type === 'meal' || item.type === 'snack' || item.type === 'walk' || item.type === 'workout' || item.type === 'sleep')
        .slice(0, 10)
        .map((item) => ({ title: item.title, time: minutesToHHmm(item.startMin || 0) })),
      items: generated.items,
      suggestions: generated.recommendations,
      generated: true,
    };
  },
  
  // Add event (generic)
  addEvent: async (event: Event) => {
    const { dayState } = get();
    if (!dayState) return;
    
    const updatedState: DayState = {
      ...dayState,
      events: [...dayState.events, event],
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Update event
  updateEvent: async (eventId: string, updates: Partial<Event>) => {
    const { dayState } = get();
    if (!dayState) return;
    
    const updatedEvents = dayState.events.map(e => {
      // Match by time and type (simple strategy)
      const timeMatch = updates.time && e.time.getTime() === updates.time.getTime();
      const typeMatch = e.type === updates.type;
      return (timeMatch && typeMatch) ? { ...e, ...updates } as Event : e;
    });
    
    const updatedState: DayState = {
      ...dayState,
      events: updatedEvents,
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Mark event as done
  markDone: async (eventId: string) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;
    
    // Find event in computed plan
    const step = computedPlan.scheduleItems.find(s => s.id === eventId);
    if (!step) return;
    
    const doneEvent: Event = {
      ...step.event,
      status: 'DONE',
    };
    
    const updatedState: DayState = {
      ...dayState,
      events: [...dayState.events, doneEvent],
      completedEvents: [...dayState.completedEvents, doneEvent],
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Mark event as skipped
  markSkipped: async (eventId: string) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;
    
    const step = computedPlan.scheduleItems.find(s => s.id === eventId);
    if (!step) return;
    
    const skippedEvent: Event = {
      ...step.event,
      status: 'SKIPPED',
    };
    
    const updatedState: DayState = {
      ...dayState,
      events: [...dayState.events, skippedEvent],
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Delete event
  deleteEvent: async (eventId: string) => {
    const { dayState } = get();
    if (!dayState) return;
    
    // Add to removedStepIds
    const updatedState: DayState = {
      ...dayState,
      removedStepIds: [...dayState.removedStepIds, eventId],
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Delay meal
  delayMeal: async (mealId: string, minutes: number) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;
    
    const step = computedPlan.scheduleItems.find(s => s.id === mealId);
    if (!step || step.event.type !== 'meal') return;
    
    const delayedEvent: MealEvent = {
      ...step.event as MealEvent,
      time: addMinutes(step.event.time, minutes),
      originalPlannedTime: step.event.time,
    };
    
    const updatedState: DayState = {
      ...dayState,
      modifiedEvents: {
        ...dayState.modifiedEvents,
        [mealId]: delayedEvent,
      },
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Add comfort meal
  addComfortMeal: async (time: Date) => {
    const comfortMeal: MealEvent = {
      type: 'meal',
      time,
      mealType: 'comfort-meal',
      source: 'USER',
      status: 'PLANNED',
      meal: {
        category: 'COMFORT',
        template: 'Comfort Window Meal',
      },
    };
    
    await get().addEvent(comfortMeal);
  },
  
  // Add meeting block
  addMeetingBlock: async (start: Date, end: Date, description?: string) => {
    const { dayState } = get();
    if (!dayState) return;
    
    const meeting: ConstraintBlock = {
      start,
      end,
      type: 'meeting',
      description,
    };
    
    const updatedState: DayState = {
      ...dayState,
      constraints: [...dayState.constraints, meeting],
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Shorten walk
  shortenWalk: async (walkId: string, newDuration: number) => {
    const { dayState, computedPlan } = get();
    if (!dayState || !computedPlan) return;
    
    const step = computedPlan.scheduleItems.find(s => s.id === walkId);
    if (!step || step.event.type !== 'walk') return;
    
    const updatedWalk: WalkEvent = {
      ...step.event as WalkEvent,
      duration: newDuration,
    };
    
    const updatedState: DayState = {
      ...dayState,
      modifiedEvents: {
        ...dayState.modifiedEvents,
        [walkId]: updatedWalk,
      },
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Set stress level
  setStress: async (level: number) => {
    const { dayState } = get();
    if (!dayState) return;
    
    const updatedState: DayState = {
      ...dayState,
      stressLevel: level,
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Set sleep level
  setSleep: async (level: number) => {
    const { dayState } = get();
    if (!dayState) return;
    
    const updatedState: DayState = {
      ...dayState,
      sleepQuality: level,
    };
    
    set({ dayState: updatedState });
    await get().generatePlan(true);
  },
  
  // Sync to API
  syncToAPI: async () => {
    const { deviceId, dayState, syncStatus } = get();
    
    if (!deviceId || !dayState) return;
    if (syncStatus === 'syncing') return; // Prevent concurrent syncs
    
    set({ syncStatus: 'syncing' });
    
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);
      
      const response = await fetch(`${API_BASE_URL}/day/${deviceId}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dayState),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      set({ syncStatus: 'synced', lastSyncAt: new Date(), syncError: null });
    } catch (error: any) {
      console.warn('[PlanStore] API sync failed:', error.message);
      // Don't set error status for network errors (offline is acceptable)
      set({ syncStatus: 'offline', syncError: error.message });
    }
  },
  
  enableAutoRefresh: () => set({ autoRefreshEnabled: true }),
  disableAutoRefresh: () => set({ autoRefreshEnabled: false }),
}));

// Auto-refresh hook (call in root component)
let autoRefreshTimer: NodeJS.Timeout | null = null;

export function startAutoRefresh() {
  if (autoRefreshTimer) return;
  
  autoRefreshTimer = setInterval(() => {
    const state = usePlanStore.getState();
    
    if (!state.autoRefreshEnabled) return;
    
    const staleness = state.checkStaleness();
    
    if (staleness === 'STALE' || staleness === 'CRITICAL') {
      console.log('[PlanStore] Auto-refreshing stale plan');
      state.generatePlan(true).catch(err => {
        console.error('[PlanStore] Auto-refresh failed:', err);
      });
    }
  }, usePlanStore.getState().autoRefreshIntervalMs);
}

export function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}
```

## apps/mobile/src/screens/ChatScreen.tsx

```
/**
 * AlignOS AI Advisor Screen
 * Decision Engine Interface
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlanStore } from '../store/planStore';
import { haptics } from '../utils/haptics';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { addMinutes, format, parse } from 'date-fns';
import { ask as askAdvisor, presetBank } from '../advisor';
import type { AdvisorResponse } from '../advisor';
import type { ScheduleItem } from '@physiology-engine/shared';
import { 
  useTheme, 
  Card, 
  Chip, 
  PrimaryButton, 
  SecondaryButton,
  SectionTitle,
  AppIcon,
  Divider,
} from '@physiology-engine/ui';


interface Message {
  id: string;
  type: 'user' | 'advisor';
  text: string;
  timestamp: Date;
  response?: AdvisorResponse;
}

export default function ChatScreen({ navigation }: any) {
  const { colors, typography, spacing, radius } = useTheme();
  const {
    profile,
    deviceId,
    todayEntries,
    addTodayEntry,
    deleteTodayEntry,
    generatePlan,
    generateFullDayPlan,
  } = usePlanStore();
  const API_BASE_URL = getApiBaseUrl();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      type: 'advisor',
      text: 'I\'m your decision engine. Ask specific questions like: "When should I eat lunch?" or "Best time to workout?"',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Meals');
  const [isProcessing, setIsProcessing] = useState(false);
  const [addedInsertIds, setAddedInsertIds] = useState<string[]>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<ScheduleItem[] | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const categories = ['Meals', 'Snacks', 'Treats', 'Caffeine', 'Workout', 'Energy', 'Sleep', 'Stress', 'Schedule'];

  const categoryMap: Record<string, string[]> = {
    Meals: ['meal', 'breakfast', 'lunch', 'dinner'],
    Snacks: ['snack'],
    Treats: ['treat', 'comfort', 'dessert', 'candy'],
    Caffeine: ['caffeine', 'coffee'],
    Workout: ['workout', 'exercise', 'training', 'walk'],
    Energy: ['energy', 'dip', 'tired', 'fatigue'],
    Sleep: ['sleep', 'bedtime', 'winddown'],
    Stress: ['stress', 'anxiety', 'overwhelm'],
    Schedule: ['schedule', 'reschedule', 'shift', 'timing', 'weekend'],
  };

  const filteredQuestionBank = presetBank
    .filter((item: any) => categoryMap[selectedCategory].some((keyword) =>
      item.tags?.some((tag: string) => tag.toLowerCase().includes(keyword)) ||
      item.title.toLowerCase().includes(keyword)
    ))
    .filter((item: any) =>
      !questionSearch.trim() || item.title.toLowerCase().includes(questionSearch.trim().toLowerCase())
    )
    .slice(0, 25);

  const handleSend = async (rawText?: string) => {
    const prompt = (rawText ?? inputText).trim();
    if (!prompt || !profile) return;
    
    haptics.light();
    const text = prompt;
    setInputText('');
    
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // Get structured response from advisor
    try {
      const response = await askAdvisor(text);
      
      const advisorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'advisor',
        text: response.directAnswer,
        timestamp: new Date(),
        response,
      };
      
      setMessages(prev => [...prev, advisorMessage]);
      haptics.success();
    } catch (error) {
      console.error('Failed to get advisor response:', error);
      haptics.error();
    } finally {
      setIsProcessing(false);
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleQuickQuestion = (question: string) => {
    haptics.light();
    setInputText(question);
  };

  const handleQuestionBankTap = async (question: string) => {
    setInputText(question);
    await handleSend(question);
  };

  const recomputeWithBackendAndRefresh = async () => {
    try {
      if (deviceId && profile) {
        await fetch(`${API_BASE_URL}/day/${deviceId}/recompute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
      }
    } catch (error) {
      console.warn('[Chat] Recompute endpoint unavailable, using local refresh', error);
    }

    await generatePlan(true);
    await generateFullDayPlan();
  };

  const parseInsertToScheduleItem = (insert: NonNullable<AdvisorResponse['inserts']>[number]): Omit<ScheduleItem, 'id'> => {
    const now = new Date();
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
      fixed: false,
      source: 'advisor_added',
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes: insert.notes || 'Added from AI Advisor',
    };
  };

  const handleAdvisorAction = async (actionId: string) => {
    if (actionId === 'OPEN_HELP') {
      navigation.navigate('Help');
      return;
    }

    if (actionId === 'OPEN_TOMORROW_PREVIEW') {
      navigation.navigate('TomorrowPreview');
      return;
    }

    if (actionId === 'INSERT_WALK_10') {
      const now = new Date();
      await addTodayEntry({
        type: 'walk',
        title: '10min Walk',
        startISO: now.toISOString(),
        endISO: addMinutes(now, 10).toISOString(),
        fixed: false,
        source: 'advisor_added',
        status: 'planned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: 'Advisor action insert',
      });
      await recomputeWithBackendAndRefresh();
    }
  };

  const handleAddToSchedule = async (message: Message) => {
    if (!message.response) return;

    const hasAddAction = message.response.actions?.some((action) => action.id === 'ADD_INSERTS_TO_PLAN');
    const inserts = message.response.inserts || [];
    if (!hasAddAction && inserts.length === 0) return;

    const snapshot = [...todayEntries];
    setUndoSnapshot(snapshot);

    const insertedIds: string[] = [];
    for (const insert of inserts) {
      const id = await addTodayEntry(parseInsertToScheduleItem(insert));
      insertedIds.push(id);
    }

    await recomputeWithBackendAndRefresh();
    setAddedInsertIds(insertedIds);
    setShowUndo(true);
    haptics.success();
    setTimeout(() => setShowUndo(false), 5000);
  };

  const handleUndoAdd = async () => {
    const dateISO = format(new Date(), 'yyyy-MM-dd');

    if (undoSnapshot) {
      usePlanStore.setState({ todayEntries: undoSnapshot });
      await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(undoSnapshot));
      await generateFullDayPlan();
      await generatePlan(true);
    } else {
      for (const id of addedInsertIds) {
        await deleteTodayEntry(id);
      }
    }

    setAddedInsertIds([]);
    setUndoSnapshot(null);
    setShowUndo(false);
    haptics.light();
  };

  const quickQuestions = [
    "When should I eat lunch?",
    "Best time to workout?",
    "When can I have coffee?",
    "Can I snack between meals?",
  ];

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <AppIcon name="brain" size={24} color={colors.accentPrimary} />
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <Text style={[typography.titleL, { color: colors.textPrimary }]}>AI Advisor</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 13 }]}>
              Decision Engine
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Help', { term: 'fasting window' })}>
            <AppIcon name="info" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.questionBankContainer, { borderBottomColor: colors.border }]}> 
        <Text style={[typography.bodyM, { color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }]}>Question Bank</Text>
        <TextInput
          style={[styles.bankSearchInput, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
          value={questionSearch}
          onChangeText={setQuestionSearch}
          placeholder="Search question bank..."
          placeholderTextColor={colors.textMuted}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {categories.map((category) => (
            <TouchableOpacity key={category} onPress={() => setSelectedCategory(category)}>
              <Chip variant={selectedCategory === category ? 'accent' : 'default'} style={{ marginRight: spacing.xs }}>
                {category}
              </Chip>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {filteredQuestionBank.map((question: any) => (
            <TouchableOpacity key={question.id} onPress={() => handleQuestionBankTap(question.title)}>
              <Chip style={{ marginRight: spacing.xs }}>
                {question.title}
              </Chip>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onAddToSchedule={() => handleAddToSchedule(message)}
            onAction={handleAdvisorAction}
          />
        ))}

        {isProcessing && (
          <View style={{ marginBottom: spacing.lg, alignItems: 'flex-start' }}>
            <Card style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
              <Text style={[typography.bodyM, { color: colors.textMuted }]}>
                Processing...
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>

      {messages.length <= 1 && (
        <View style={[styles.quickQuestionsContainer, { borderTopColor: colors.border }]}>
          <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }]}>
            Quick questions
          </Text>
          <View style={styles.quickQuestions}>
            {quickQuestions.map((q, i) => (
              <TouchableOpacity key={i} onPress={() => handleQuickQuestion(q)}>
                <Chip>
                  {q}
                </Chip>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about meal timing, workouts, energy..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendButton,
            { 
              backgroundColor: inputText.trim() ? colors.accentPrimary : colors.surface,
              borderColor: colors.borderSubtle,
            }
          ]}
          onPress={() => {
            void handleSend();
          }}
          disabled={!inputText.trim()}
        >
          <AppIcon name="chevronUp" size={20} color={inputText.trim() ? colors.background : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {showUndo && (
        <View style={[styles.undoSnackbar, { backgroundColor: colors.surfaceElevated, borderColor: colors.accentPrimary }]}> 
          <Text style={[typography.bodyM, { color: colors.textPrimary, flex: 1 }]}>Added to plan</Text>
          <TouchableOpacity onPress={handleUndoAdd}>
            <Text style={[typography.bodyM, { color: colors.accentPrimary, fontWeight: '600' }]}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ 
  message, 
  onAddToSchedule,
  onAction,
}: { 
  message: Message; 
  onAddToSchedule: () => void;
  onAction: (actionId: string) => Promise<void> | void;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  const isUser = message.type === 'user';
  const [showDetails, setShowDetails] = useState(true);

  if (isUser) {
    return (
      <View style={[styles.messageBubbleContainer, { alignItems: 'flex-end', marginBottom: spacing.md }]}>
        <View style={[
          styles.messageBubble,
          { 
            backgroundColor: colors.accentPrimary,
            borderRadius: radius.md,
            borderBottomRightRadius: 4,
            padding: spacing.md,
            maxWidth: '80%',
          }
        ]}>
          <Text style={[typography.bodyM, { color: colors.background }]}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  // Advisor message with structured response
  return (
    <View style={[styles.messageBubbleContainer, { marginBottom: spacing.lg }]}>
      <Card style={{ width: '100%' }}>
        {/* Direct Answer */}
        <Text style={[typography.bodyM, { color: colors.textPrimary, lineHeight: 22 }]}>
          {message.text}
        </Text>

        {message.response && (
          <>
            {/* Next Moves */}
            {message.response.nextMoves && message.response.nextMoves.length > 0 && showDetails && (
              <View style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <AppIcon name="clock" size={14} color={colors.textSecondary} />
                  <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4 }]}>
                    NEXT MOVES
                  </Text>
                </View>
                {message.response.nextMoves.map((move, i) => (
                  <View key={i} style={{ marginBottom: spacing.sm, flexDirection: 'row' }}>
                    <Text style={[typography.bodyM, { color: colors.accentPrimary, fontFamily: 'monospace', fontSize: 12, width: 60 }]}>
                      {move.time}
                    </Text>
                    <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 13, flex: 1 }]}>
                      {move.title}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* If/Then */}
            {message.response.ifThen && message.response.ifThen.length > 0 && showDetails && (
              <View style={{ marginTop: spacing.md }}>
                <Divider spacing="sm" />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm }}>
                  <AppIcon name="info" size={14} color={colors.textSecondary} />
                  <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4 }]}>
                    IF/THEN
                  </Text>
                </View>
                {message.response.ifThen.map((branch, i) => (
                  <View key={i} style={{ marginBottom: spacing.sm }}>
                    <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12 }]}>
                      {branch.if}
                    </Text>
                    <Text style={[typography.bodyM, { color: colors.textPrimary, fontSize: 13, marginTop: 2 }]}>
                      → {branch.then}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Why */}
            {message.response.why && showDetails && (
              <View style={{ marginTop: spacing.md }}>
                <Divider spacing="sm" />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm }}>
                  <AppIcon name="brain" size={14} color={colors.textSecondary} />
                  <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4 }]}>
                    WHY
                  </Text>
                </View>
                <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 13, lineHeight: 20 }]}>
                  {message.response.why}
                </Text>
              </View>
            )}

            {/* Add to Plan */}
            {(message.response.inserts && message.response.inserts.length > 0) ||
            message.response.actions?.some((action) => action.id === 'ADD_INSERTS_TO_PLAN') ? (
              <View style={{ marginTop: spacing.md }}>
                <PrimaryButton
                  onPress={onAddToSchedule}
                  style={{ width: '100%' }}
                >
                  Add to Plan
                </PrimaryButton>
              </View>
            ) : null}

            {message.response.actions && message.response.actions.filter((action) => action.id !== 'ADD_INSERTS_TO_PLAN').length > 0 ? (
              <View style={{ marginTop: spacing.sm }}>
                {message.response.actions
                  .filter((action) => action.id !== 'ADD_INSERTS_TO_PLAN')
                  .slice(0, 2)
                  .map((action) => (
                    <SecondaryButton key={action.id} onPress={() => void onAction(action.id)} style={{ marginTop: spacing.xs }}>
                      {action.label}
                    </SecondaryButton>
                  ))}
              </View>
            ) : null}
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionBankContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  bankSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    width: '100%',
  },
  messageBubble: {
    maxWidth: '80%',
  },
  quickQuestionsContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  quickQuestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
  },
  input: {
    fontSize: 15,
    padding: 12,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoSnackbar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
```

## packages/ui/icons/icons.ts

```
/**
 * AlignOS Icon System
 * Semantic icon names mapped to vector icons
 */

import { Ionicons } from '@expo/vector-icons';

export const iconMap = {
  // Time & Schedule
  sun: 'sunny-outline',
  moon: 'moon-outline',
  clock: 'time-outline',
  calendar: 'calendar-outline',
  sunrise: 'partly-sunny-outline',
  sunset: 'moon-outline',
  
  // Activity
  walk: 'walk-outline',
  run: 'fitness-outline',
  workout: 'barbell-outline',
  stretch: 'body-outline',
  
  // Nutrition
  meal: 'restaurant-outline',
  snack: 'nutrition-outline',
  water: 'water-outline',
  coffee: 'cafe-outline',
  apple: 'nutrition-outline',
  
  // Work & Focus
  focus: 'eye-outline',
  brain: 'bulb-outline',
  meditation: 'leaf-outline',
  work: 'briefcase-outline',
  meeting: 'people-outline',
  laptop: 'laptop-outline',
  
  // Rest & Recovery
  break: 'cafe-outline',
  winddown: 'moon-outline',
  
  // Status & Actions
  check: 'checkmark-circle-outline',
  checkCircle: 'checkmark-circle',
  plus: 'add-circle-outline',
  plusCircle: 'add-circle',
  info: 'information-circle-outline',
  alert: 'alert-circle-outline',
  trophy: 'trophy-outline',
  star: 'star-outline',
  lock: 'lock-closed-outline',
  
  // Navigation
  home: 'home-outline',
  settings: 'settings-outline',
  chat: 'chatbubble-outline',
  history: 'stats-chart-outline',
  chart: 'analytics-outline',
  back: 'arrow-back',
  forward: 'arrow-forward',
  
  // UI
  chevronRight: 'chevron-forward',
  chevronLeft: 'chevron-back',
  chevronUp: 'chevron-up',
  chevronDown: 'chevron-down',
  close: 'close',
  menu: 'menu-outline',
  more: 'ellipsis-horizontal',
  refresh: 'refresh-outline',
  
  // Biometrics
  heart: 'heart-outline',
  pulse: 'pulse-outline',
  sleep: 'bed-outline',
  
  // Weather & Environment
  cloud: 'cloud-outline',
  thermometer: 'thermometer-outline',
  
  // Social
  people: 'people-outline',
  person: 'person-outline',
  
  // Energy & Performance
  flash: 'flash-outline',
  battery: 'battery-half-outline',
  trending: 'trending-up-outline',
  
  // Misc
  flame: 'flame-outline',
  leaf: 'leaf-outline',
  sparkles: 'sparkles-outline',
  bookmark: 'bookmark-outline',
  location: 'location-outline',
} as const;

export type IconName = keyof typeof iconMap;

// Re-export Ionicons for direct use
export { Ionicons };
```

## apps/mobile/src/components/EnergyForecast.tsx

```
/**
 * AlignOS Energy Forecast Component
 * Clean OS-level energy prediction with teal/cyan palette only
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import type { DayPlan, UserProfile } from '@physiology-engine/shared';
import { AppIcon } from '../ui/components/AppIcon';
import { Colors } from '../ui/theme/colors';
import { Spacing } from '../ui/theme/spacing';
import { Radius } from '../ui/theme/radius';
import { Typography, FontWeight } from '../ui/theme/typography';
import { Shadows } from '../ui/theme/shadows';
import { formatNumber } from '../ui/utils/format';

interface EnergyForecastProps {
  profile: UserProfile;
  plan?: DayPlan;
  deviceId?: string;
  dateISO?: string;
  onAction?: (actionId: string) => void;
}

interface EnergyPoint {
  hour: number;
  energy: number; // 0-100
  label: string;
}

interface ForecastConfidence {
  score: number;
  label: 'High' | 'Med' | 'Low';
}

interface ForecastResult {
  points: EnergyPoint[];
  confidence: ForecastConfidence;
}

interface InsightAction {
  id: 'INSERT_WALK_10' | 'SHIFT_LUNCH_EARLIER_15' | 'RECOMPUTE_FROM_NOW';
  label: string;
}

interface EnergyInsight {
  icon: string;
  text: string;
  action?: InsightAction;
}

export default function EnergyForecast({ profile, plan, deviceId, dateISO, onAction }: EnergyForecastProps) {
  const activeDateISO = dateISO || plan?.dateISO || format(new Date(), 'yyyy-MM-dd');
  const forecastKey = buildForecastKey(profile, plan, activeDateISO, deviceId);

  const forecastResult = React.useMemo(
    () => generateEnergyForecast(profile, plan, activeDateISO, deviceId),
    [forecastKey]
  );

  const forecast = forecastResult.points;
  const currentHour = new Date().getHours();
  const currentEnergy = forecast.find(p => p.hour === currentHour)?.energy || 50;
  const showApproxNow = forecastResult.confidence.label === 'Low';
  const insights = React.useMemo(
    () => getEnergyInsights(forecast, currentHour, profile, plan, forecastResult.confidence),
    [forecastKey, currentHour]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <AppIcon name="energy" size={16} color={Colors.TextPrimary} />
          <Text style={styles.title}>Energy Forecast</Text>
        </View>
        <View style={styles.currentBadge}>
          <Text style={styles.currentText}>{showApproxNow ? `Now ~${formatNumber(currentEnergy, 0)}%` : `Now ${formatNumber(currentEnergy, 0)}%`}</Text>
          <Text style={styles.confidenceText}>Confidence: {forecastResult.confidence.label}</Text>
        </View>
      </View>

      {/* Energy curve visualization */}
      <View style={styles.chartContainer}>
        <View style={styles.chart}>
          {forecast.map((point, index) => {
            const isCurrent = point.hour === currentHour;
            const height = Math.max(point.energy, 10);
            const isLow = height < 40;
            const isHigh = height > 70;

            return (
              <View key={point.hour} style={styles.barContainer}>
                <View style={styles.barWrapper}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${height}%`,
                        backgroundColor: isLow ? Colors.TextMuted :
                                       isHigh ? Colors.AccentPrimary :
                                       Colors.AccentSecondary,
                        opacity: isCurrent ? 1 : 0.7,
                      },
                    ]}
                  />
                  {isCurrent && (
                    <View style={styles.nowIndicator} />
                  )}
                </View>
                {(point.hour % 3 === 0) && (
                  <Text style={styles.timeLabel}>
                    {format(new Date().setHours(point.hour, 0, 0, 0), 'ha')}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Subtle gridlines */}
        <View style={styles.gridlines}>
          <View style={[styles.gridline, { bottom: '25%' }]} />
          <View style={[styles.gridline, { bottom: '50%' }]} />
          <View style={[styles.gridline, { bottom: '75%' }]} />
        </View>
      </View>

      {/* Key insights - max 3 */}
      <View style={styles.insights}>
        {insights.slice(0, 3).map((insight, i) => (
          <View key={i} style={styles.insight}>
            <AppIcon name={insight.icon as any} size={13} color={Colors.TextSecondary} />
            <View style={styles.insightContent}>
              <Text style={styles.insightText}>{insight.text}</Text>
              {insight.action ? (
                <Text style={styles.insightActionText} onPress={() => onAction?.(insight.action!.id)}>
                  Action: {insight.action.label}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function generateEnergyForecast(
  profile: UserProfile,
  plan: DayPlan | undefined,
  dateISO: string,
  deviceId?: string
): ForecastResult {
  const wakeTime = parseHour(profile.wakeTime, 7);
  const sleepTime = parseHour(profile.sleepTime, 23);
  const confidence = computeConfidence(profile, plan);
  const seedKey = buildForecastKey(profile, plan, dateISO, deviceId);
  const rng = mulberry32(hashStringToSeed(seedKey));

  const hourlyEnergy = new Array<number>(24).fill(50);

  for (let hour = 0; hour < 24; hour++) {
    let energy = 50; // baseline

    // Circadian rhythm curve
    if (hour >= wakeTime && hour < sleepTime) {
      // Awake hours
      const hoursAwake = hour - wakeTime;
      
      // Morning rise (cortisol awakening response)
      if (hoursAwake < 2) {
        energy = 50 + (hoursAwake * 15); // Gradual rise
      }
      // Mid-morning peak
      else if (hoursAwake >= 2 && hoursAwake < 5) {
        energy = 82;
      }
      // Post-lunch dip (natural circadian trough)
      else if (hoursAwake >= 5 && hoursAwake < 7) {
        energy = 55 - ((hoursAwake - 5) * 5); // Dip to ~45%
      }
      // Afternoon recovery
      else if (hoursAwake >= 7 && hoursAwake < 10) {
        energy = 45 + ((hoursAwake - 7) * 10); // Rise to ~75%
      }
      // Evening plateau
      else if (hoursAwake >= 10 && hoursAwake < 12) {
        energy = 75 - ((hoursAwake - 10) * 5);
      }
      // Pre-sleep decline (melatonin rise)
      else {
        energy = Math.max(30, 65 - ((hoursAwake - 12) * 15));
      }
    } else {
      // Sleep hours - very low energy
      energy = 13;
    }

    // Fitness goal adjustments
    const goal = profile.fitnessGoal || 'MAINTENANCE';
    if (goal === 'FAT_LOSS' || goal === 'WEIGHT_LOSS') {
      // Calorie deficit can reduce energy slightly
      energy -= 5;
    } else if (goal === 'PERFORMANCE') {
      // Well-fueled athletes have higher baseline
      energy += 5;
    }

    if (isNoiseWindow(hour, wakeTime, sleepTime)) {
      energy += seededOffset(rng, 2);
    }

    hourlyEnergy[hour] = clampEnergy(energy);
  }

  applyPlanModifiers(hourlyEnergy, plan);

  const points = hourlyEnergy.map((energy, hour) => ({
    hour,
    energy: Math.round(clampEnergy(energy)),
    label: format(new Date().setHours(hour, 0, 0, 0), 'ha'),
  }));

  return { points, confidence };
}

function getEnergyInsights(
  forecast: EnergyPoint[],
  currentHour: number,
  profile: UserProfile,
  plan: DayPlan | undefined,
  confidence: ForecastConfidence
): EnergyInsight[] {
  const insights: EnergyInsight[] = [];

  const peakPoint = forecast.reduce((max, p) => p.energy > max.energy ? p : max, forecast[0]);
  const peakEndHour = (peakPoint.hour + 1) % 24;
  const nearbyAnchor = plan?.items.find((item) => {
    const hour = new Date(item.startISO).getHours();
    return Math.abs(hour - peakPoint.hour) <= 1 && (item.type === 'workout' || item.type === 'walk' || item.type === 'meal' || item.type === 'snack');
  });
  const peakWhy = nearbyAnchor
    ? `supported by ${nearbyAnchor.type} anchor`
    : `from wake timing (${profile.wakeTime}) and circadian rise`;

  insights.push({
    icon: 'target',
    text: `Peak window: ${format(new Date().setHours(peakPoint.hour, 0, 0, 0), 'ha')}-${format(new Date().setHours(peakEndHour, 0, 0, 0), 'ha')} (${peakWhy})`,
    action: { id: 'RECOMPUTE_FROM_NOW', label: 'Recompute from now for peak block' },
  });

  const dipWindow = forecast.filter(point => point.hour >= 13 && point.hour <= 16);
  const dipPoint = dipWindow.reduce((min, point) => point.energy < min.energy ? point : min, dipWindow[0] || forecast[0]);
  const hasMealInDipWindow = (plan?.items || []).some((item) => {
    if (item.type !== 'meal' && item.type !== 'snack') return false;
    const mealHour = new Date(item.startISO).getHours();
    return mealHour >= 12 && mealHour <= 16;
  });
  const estimatedSleepHours = estimateSleepHours(profile.wakeTime, profile.sleepTime);
  const poorSleep = estimatedSleepHours < 7;
  const highStress = profile.stressBaseline >= 7;

  if (hasMealInDipWindow || poorSleep || highStress) {
    const dipReason = hasMealInDipWindow
      ? 'meal timing overlap'
      : poorSleep
        ? `short sleep (${estimatedSleepHours.toFixed(1)}h)`
        : `higher stress baseline (${profile.stressBaseline}/10)`;

    insights.push({
      icon: 'clock',
      text: `Likely dip near ${format(new Date().setHours(dipPoint.hour, 0, 0, 0), 'ha')} due to ${dipReason}`,
      action: hasMealInDipWindow
        ? { id: 'SHIFT_LUNCH_EARLIER_15', label: 'Shift lunch earlier by 15 min' }
        : { id: 'INSERT_WALK_10', label: 'Insert 10-min walk before dip' },
    });
  }

  const currentEnergy = forecast.find(p => p.hour === currentHour)?.energy || 50;
  if (currentHour >= 13 && currentHour <= 16) {
    if (currentEnergy < 45) {
      insights.push({
        icon: 'walk',
        text: `Current dip active (~${currentEnergy}%) — use short movement and low-cognitive work`,
        action: { id: 'INSERT_WALK_10', label: 'Insert 10-min walk now' },
      });
    }
  }

  if (insights.length < 3 && currentEnergy > 72 && currentHour >= 6 && currentHour < 22) {
    insights.push({
      icon: 'energy',
      text: `High output now (${currentEnergy}%) — best time for demanding work or training`,
    });
  } else if (insights.length < 3 && currentEnergy < 40 && currentHour >= 6 && currentHour < 22) {
    insights.push({
      icon: 'walk',
      text: `Low state now (${currentEnergy}%) — favor recovery tasks until rebound`,
      action: { id: 'INSERT_WALK_10', label: 'Insert 10-min walk now' },
    });
  }

  if (insights.length < 3 && confidence.label === 'Low') {
    insights.push({
      icon: 'info',
      text: 'Forecast confidence is low: add consistent meal and movement anchors for tighter accuracy.',
    });
  }

  return insights.slice(0, 3);
}

function applyPlanModifiers(hourlyEnergy: number[], plan?: DayPlan): void {
  if (!plan?.items?.length) return;

  const effectiveItems = selectEffectiveItems(plan.items);

  for (const item of effectiveItems) {
    const itemHour = new Date(item.startISO).getHours();
    const workoutKind = inferWorkoutKind(item.title, item.notes);
    const mealKind = inferMealKind(item.title, item.notes);
    const isLateWorkout = itemHour >= 19;

    if (item.type === 'walk') {
      applyDelta(hourlyEnergy, itemHour, 4);
      applyDelta(hourlyEnergy, itemHour + 1, 2);
    }

    if (item.type === 'workout') {
      if (workoutKind === 'cardio') {
        applyDelta(hourlyEnergy, itemHour, 5);
        applyDelta(hourlyEnergy, itemHour + 1, 3);
      } else {
        applyDelta(hourlyEnergy, itemHour, 3);
        applyDelta(hourlyEnergy, itemHour + 1, 6);
        applyDelta(hourlyEnergy, itemHour + 2, 6);
      }

      if (isLateWorkout) {
        applyDelta(hourlyEnergy, itemHour, -2);
      }
    }

    if (item.type === 'meal' || item.type === 'snack') {
      if (mealKind === 'lean') {
        applyDelta(hourlyEnergy, itemHour, -2);
        applyDelta(hourlyEnergy, itemHour + 1, 2);
      } else if (mealKind === 'comfort') {
        applyDelta(hourlyEnergy, itemHour, -6);
        applyDelta(hourlyEnergy, itemHour + 1, -2);
        applyDelta(hourlyEnergy, itemHour + 2, 1);
      }
    }

    if (isCaffeineItem(item.title, item.notes, item.type)) {
      applyDelta(hourlyEnergy, itemHour, 6);
      applyDelta(hourlyEnergy, itemHour + 1, 6);
      applyDelta(hourlyEnergy, itemHour + 3, -4);
      applyDelta(hourlyEnergy, itemHour + 4, -4);
      applyDelta(hourlyEnergy, itemHour + 5, -4);
    }
  }

  for (let i = 0; i < hourlyEnergy.length; i++) {
    hourlyEnergy[i] = clampEnergy(hourlyEnergy[i]);
  }
}

function selectEffectiveItems(items: DayPlan['items']): DayPlan['items'] {
  const buckets = new Map<string, DayPlan['items'][number]>();

  for (const item of items) {
    const hour = new Date(item.startISO).getHours();
    const anchorType = getAnchorType(item);
    const key = `${anchorType}:${hour}`;
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, item);
      continue;
    }

    const existingActual = existing.origin === 'actual';
    const incomingActual = item.origin === 'actual';

    if (!existingActual && incomingActual) {
      buckets.set(key, item);
    }
  }

  return Array.from(buckets.values()).sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
}

function getAnchorType(item: DayPlan['items'][number]): 'meal' | 'walk' | 'workout' | 'caffeine' | 'other' {
  if (item.type === 'meal' || item.type === 'snack' || item.type === 'walk' || item.type === 'workout') {
    return item.type === 'snack' ? 'meal' : item.type;
  }
  if (item.meta?.actualType === 'meal' || item.meta?.actualType === 'snack' || item.meta?.actualType === 'walk' || item.meta?.actualType === 'workout') {
    return item.meta.actualType === 'snack' ? 'meal' : item.meta.actualType;
  }
  if (isCaffeineItem(item.title, item.notes, item.type)) return 'caffeine';
  return 'other';
}

function computeConfidence(profile: UserProfile, plan?: DayPlan): ForecastConfidence {
  const hasWakeSleep = Boolean(profile.wakeTime && profile.sleepTime);
  const hasWorkBlock = Boolean(profile.workStartTime && profile.workEndTime);
  const mealAnchors = (plan?.items || []).filter((item) => item.type === 'meal' || item.type === 'snack').length;
  const movementAnchors = (plan?.items || []).filter((item) => item.type === 'walk' || item.type === 'workout').length;
  const actualCount = (plan?.items || []).filter((item) => item.status === 'actual' || item.origin === 'actual').length;

  let score = 0;
  if (hasWakeSleep) score += 40;
  if (hasWorkBlock) score += 20;
  if (mealAnchors >= 2) score += 20;
  if (movementAnchors >= 1) score += 20;
  if (actualCount >= 2) score += 10;
  if (actualCount >= 4) score += 10;

  const capped = Math.min(100, score);
  const label: ForecastConfidence['label'] = capped >= 75 ? 'High' : capped >= 50 ? 'Med' : 'Low';
  return { score: capped, label };
}

export function buildForecastKey(
  profile: UserProfile,
  plan: DayPlan | undefined,
  dateISO: string,
  deviceId?: string
): string {
  const identity = deviceId || (profile as { id?: string }).id || 'anonymous';
  const planSummary = (plan?.items || [])
    .map((item) => {
      const hour = new Date(item.startISO).getHours();
      return `${item.type}@${hour}:${item.title.toLowerCase().trim()}:${(item.notes || '').toLowerCase().trim()}`;
    })
    .sort()
    .join('|');

  return [
    dateISO,
    identity,
    profile.wakeTime,
    profile.sleepTime,
    profile.workStartTime || '-',
    profile.workEndTime || '-',
    planSummary,
  ].join('::');
}

function parseHour(time: string | undefined, fallback: number): number {
  if (!time) return fallback;
  const parsed = Number(time.split(':')[0]);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function clampEnergy(value: number): number {
  return Math.max(10, Math.min(95, value));
}

function estimateSleepHours(wakeTime: string, sleepTime: string): number {
  const wakeHour = parseHour(wakeTime, 7);
  const sleepHour = parseHour(sleepTime, 23);

  if (sleepHour > wakeHour) {
    return 24 - sleepHour + wakeHour;
  }
  return wakeHour - sleepHour;
}

function applyDelta(hourlyEnergy: number[], hour: number, delta: number): void {
  const normalizedHour = ((hour % 24) + 24) % 24;
  hourlyEnergy[normalizedHour] += delta;
}

function seededOffset(rng: () => number, maxAbs: number): number {
  const span = maxAbs * 2 + 1;
  return Math.floor(rng() * span) - maxAbs;
}

function isNoiseWindow(hour: number, wakeHour: number, sleepHour: number): boolean {
  const awake = hour >= wakeHour && hour < sleepHour;
  if (!awake) return true;

  const hoursAwake = hour - wakeHour;
  return (hoursAwake >= 2 && hoursAwake <= 5) || (hoursAwake >= 10 && hoursAwake <= 12);
}

function normalizeText(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function inferWorkoutKind(title: string, notes?: string): 'strength' | 'cardio' {
  const text = normalizeText(title, notes);
  if (/cardio|run|running|cycle|bike|hiit|jog/.test(text)) return 'cardio';
  return 'strength';
}

function inferMealKind(title: string, notes?: string): 'lean' | 'comfort' | 'neutral' {
  const text = normalizeText(title, notes);
  if (/comfort|carb|dessert|treat|pudding|sweet|heavy/.test(text)) return 'comfort';
  if (/lean|protein|chicken|fish|eggs|turkey/.test(text)) return 'lean';
  return 'neutral';
}

function isCaffeineItem(title: string, notes: string | undefined, type: string): boolean {
  if (type === 'custom') {
    return /coffee|caffeine|espresso|tea|pre-workout/.test(normalizeText(title, notes));
  }
  return /coffee|caffeine|espresso|tea|pre-workout/.test(normalizeText(title, notes));
}

function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.SurfaceElevated,
    borderWidth: 1,
    borderColor: Colors.Border,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: Typography.Body,
    fontWeight: FontWeight.Semi,
    color: Colors.TextPrimary,
  },
  currentBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: `${Colors.AccentPrimary}1A`, // 10% opacity
    borderWidth: 1,
    borderColor: Colors.AccentPrimary,
  },
  currentText: {
    fontSize: Typography.Caption,
    fontWeight: FontWeight.Semi,
    color: Colors.AccentPrimary,
    letterSpacing: 0.3,
  },
  confidenceText: {
    fontSize: Typography.Micro,
    color: Colors.TextSecondary,
    marginTop: 2,
    letterSpacing: 0.2,
  },
  chartContainer: {
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  chart: {
    flexDirection: 'row',
    height: 100,
    alignItems: 'flex-end',
    gap: 2,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barWrapper: {
    width: '100%',
    height: 100,
    justifyContent: 'flex-end',
    position: 'relative',
  },
  bar: {
    width: '100%',
    minHeight: 10,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  nowIndicator: {
    position: 'absolute',
    top: -6,
    left: '50%',
    marginLeft: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.AccentPrimary,
  },
  timeLabel: {
    fontSize: Typography.Micro,
    color: Colors.TextMuted,
    letterSpacing: 0.4,
  },
  gridlines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  gridline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.Border,
    opacity: 0.2,
  },
  insights: {
    gap: Spacing.sm,
  },
  insight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  insightContent: {
    flex: 1,
  },
  insightText: {
    fontSize: Typography.Caption,
    color: Colors.TextSecondary,
    lineHeight: 16,
  },
  insightActionText: {
    fontSize: Typography.Micro,
    color: Colors.AccentPrimary,
    marginTop: 2,
  },
});
```

## services/api/src/index.ts

```
/**
 * PHYSIOLOGY ENGINE API
 * Handles day state storage and sync for mobile clients.
 * Uses shared engine for server-side plan generation.
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { generatePlan } from '@physiology-engine/engine';
import { 
  DayStateSchema, 
  EngineInputSchema,
  type DayState,
  type EngineInput,
  type ClockTime,
} from '@physiology-engine/shared';
import advisorRoutes from './routes/advisorRoutes';
import {
  applyRhythmToSchedule,
  loadRhythmProfile,
  resetRhythmProfile,
  updateRhythmFromEvents,
} from './services/rhythmService';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, '../data');

// Middleware
app.use(cors());
app.use(express.json());

const hhmmToMinutes = (value?: string): number | undefined => {
  if (!value) return undefined;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
};

const parseClockTime = (input?: string): ClockTime | null => {
  if (!input) return null;
  const withPeriod = input.match(/^(\d{1,2}):(\d{2})\s*([aApP][mM])$/);
  if (withPeriod) {
    const hour = Number.parseInt(withPeriod[1], 10);
    const minute = Number.parseInt(withPeriod[2], 10);
    const period = withPeriod[3].toUpperCase() as 'AM' | 'PM';
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    return { hour, minute, period };
  }

  const hhmm = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!hhmm) return null;
  const hour24 = Number.parseInt(hhmm[1], 10);
  const minute = Number.parseInt(hhmm[2], 10);
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;
  return {
    hour: (hour24 % 12) || 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
};

const clockFromISO = (iso?: string): ClockTime | null => {
  if (!iso) return null;
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return parseClockTime(`${match[1]}:${match[2]}`);
};

const normalizeScheduleItemsForResponse = (items: any[]): any[] => {
  return items.map((item) => {
    const startISO = item.startISO || item.time?.toISOString?.() || item.time;
    const endISO = item.endISO || item.endTimeISO;
    const type = item.type || item.event?.type || 'custom';
    const startTime = item.startTime || clockFromISO(startISO || undefined) || parseClockTime(item.timeLabel);
    const endTime = item.endTime || clockFromISO(endISO || undefined);
    return {
      ...item,
      type,
      startISO,
      endISO,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      source:
        item.source === 'user' || item.source === 'advisor' || item.source === 'system'
          ? item.source
          : item.source === 'advisor_added'
            ? 'advisor'
            : item.source === 'user_added'
              ? 'user'
              : 'system',
      status:
        item.status === 'actual' || item.status === 'skipped' || item.status === 'adjusted'
          ? item.status
          : item.status === 'auto_adjusted'
            ? 'adjusted'
            : 'planned',
      locked: type === 'wake' || type === 'sleep',
      deletable: type !== 'wake' && type !== 'sleep',
    };
  });
};

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true }).catch(console.error);

// Mount advisor routes
app.use('/api', advisorRoutes);

// Check for OpenAI API key on startup
if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  WARNING: OPENAI_API_KEY not set. Advisor endpoint will return fallback responses.');
} else {
  console.log('✅ OpenAI API key configured');
}

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * GET /day/:deviceId/today
 * Get today's day state and computed plan for a device
 */
app.get('/day/:deviceId/today', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const dayState = JSON.parse(data, (key, value) => {
        // Revive Date objects
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });
      
      res.json(dayState);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Day state not found' });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('GET /day/:deviceId/today error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /day/:deviceId/:date
 * Fetch a specific day's stored state and normalized full-day plan (YYYY-MM-DD)
 */
app.get('/day/:deviceId/:date(\\d{4}-\\d{2}-\\d{2})', async (req: Request, res: Response) => {
  try {
    const { deviceId, date } = req.params;
    const filePath = path.join(DATA_DIR, `${deviceId}_${date}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const dayState = JSON.parse(data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });

      const storedItems = Array.isArray(dayState?.fullDayPlan?.items)
        ? dayState.fullDayPlan.items
        : normalizeScheduleItemsForResponse(dayState?.computedPlan || []);

      return res.json({
        dateISO: date,
        dayState: {
          dayMode: dayState?.dayMode,
          sleepQuality: dayState?.sleepQuality,
          stressLevel: dayState?.stressLevel,
          currentTime: dayState?.currentTime,
        },
        fullDayPlan: {
          dateISO: date,
          items: storedItems,
          summary: dayState?.fullDayPlan?.summary || dayState?.planMeta?.dayOneLiner,
          recommendations: dayState?.fullDayPlan?.recommendations || [],
        },
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Day state not found' });
      }
      throw error;
    }
  } catch (error) {
    console.error('GET /day/:deviceId/:date error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /day/:deviceId/tomorrow
 * Return tomorrow preview or lightweight template based on available state
 */
app.get('/day/:deviceId/tomorrow', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateKey = tomorrow.toISOString().split('T')[0];
    const tomorrowPath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);

    try {
      const data = await fs.readFile(tomorrowPath, 'utf-8');
      const tomorrowState = JSON.parse(data);
      return res.json({
        dateKey,
        source: 'saved',
        wakeTime: '07:00',
        sleepTime: '23:00',
        wakeMin: hhmmToMinutes('07:00'),
        sleepMin: hhmmToMinutes('23:00'),
        workStartTime: tomorrowState?.workStartTime,
        workEndTime: tomorrowState?.workEndTime,
        workStartMin: hhmmToMinutes(tomorrowState?.workStartTime),
        workEndMin: hhmmToMinutes(tomorrowState?.workEndTime),
        anchors: [
          { title: 'Meal 1', time: '08:30', timeMin: hhmmToMinutes('08:30') },
          { title: 'Lunch', time: '12:30', timeMin: hhmmToMinutes('12:30') },
          { title: 'Workout / Walk', time: '17:30', timeMin: hhmmToMinutes('17:30') },
        ],
      });
    } catch {
      const todayKey = new Date().toISOString().split('T')[0];
      const todayPath = path.join(DATA_DIR, `${deviceId}_${todayKey}.json`);
      let wakeTime = '07:00';
      let sleepTime = '23:00';

      try {
        const todayData = await fs.readFile(todayPath, 'utf-8');
        const todayState = JSON.parse(todayData);
        const events = todayState?.computedPlan || [];
        const wake = events.find((event: any) => event?.event?.type === 'activation-routine');
        if (wake?.time) {
          const wakeDate = new Date(wake.time);
          wakeTime = `${String(wakeDate.getHours()).padStart(2, '0')}:${String(wakeDate.getMinutes()).padStart(2, '0')}`;
        }
      } catch {
        // Fallback template remains
      }

      return res.json({
        dateKey,
        source: 'template',
        wakeTime,
        sleepTime,
        wakeMin: hhmmToMinutes(wakeTime),
        sleepMin: hhmmToMinutes(sleepTime),
        anchors: [
          { title: 'Meal 1', time: '08:30', timeMin: hhmmToMinutes('08:30') },
          { title: 'Lunch', time: '12:30', timeMin: hhmmToMinutes('12:30') },
          { title: 'Workout / Walk', time: '17:30', timeMin: hhmmToMinutes('17:30') },
        ],
      });
    }
  } catch (error) {
    console.error('GET /day/:deviceId/tomorrow error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/tomorrow/generate
 * Generate tomorrow preview/state using profile + rhythm aggregates and store by tomorrow date key
 */
app.post('/day/:deviceId/tomorrow/generate', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { profile } = req.body || {};
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateKey = tomorrow.toISOString().split('T')[0];
    const tomorrowPath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);

    const rhythm = await loadRhythmProfile(DATA_DIR, deviceId);
    const wakeTime = rhythm.rollingMedians.wake || profile?.wakeTime || '07:00';
    const sleepTime = rhythm.rollingMedians.sleep || profile?.sleepTime || '23:00';
    const workStartTime = profile?.workStartTime;
    const workEndTime = profile?.workEndTime;
    const lunchTime = rhythm.rollingMedians.lunch || profile?.lunchTime || '12:30';

    const anchors = [
      { title: 'Meal 1', time: rhythm.rollingMedians.firstMeal || '08:30' },
      { title: 'Lunch', time: lunchTime },
      { title: 'Workout / Walk', time: rhythm.commonBins.workout?.[0] || rhythm.commonBins.walk?.[0] || '17:30' },
    ];

    const suggestions = [
      rhythm.commonBins.workout?.[0]
        ? `Best workout window is around ${rhythm.commonBins.workout[0]}; place your main session there.`
        : 'Protect a 45–60 minute movement block in late afternoon.',
      rhythm.disruptionWindows?.length
        ? `You often edit around ${rhythm.disruptionWindows[0]}:00; add buffer around that hour.`
        : 'Keep lunch fixed to stabilize your afternoon energy.',
      rhythm.adherenceScore >= 0.7
        ? 'Adherence is strong; copy your core anchors from today.'
        : 'Use fewer but firmer anchors tomorrow to improve adherence.',
    ];

    const generatedState = {
      dateKey,
      generatedAt: new Date().toISOString(),
      wakeTime,
      sleepTime,
      wakeMin: hhmmToMinutes(wakeTime),
      sleepMin: hhmmToMinutes(sleepTime),
      workStartTime,
      workEndTime,
      workStartMin: hhmmToMinutes(workStartTime),
      workEndMin: hhmmToMinutes(workEndTime),
      lunchTime,
      lunchStartMin: hhmmToMinutes(lunchTime),
      anchors: anchors.map((anchor) => ({
        ...anchor,
        timeMin: hhmmToMinutes(anchor.time),
      })),
      suggestions,
      source: 'generated',
    };

    await fs.writeFile(tomorrowPath, JSON.stringify(generatedState, null, 2));
    res.json({ success: true, ...generatedState });
  } catch (error) {
    console.error('POST /day/:deviceId/tomorrow/generate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /day/:deviceId/rhythm
 * Return learned rhythm aggregates for device
 */
app.get('/day/:deviceId/rhythm', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const rhythm = await loadRhythmProfile(DATA_DIR, deviceId);
    res.json(rhythm);
  } catch (error) {
    console.error('GET /day/:deviceId/rhythm error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/rhythm/reset
 * Reset learned rhythm aggregates for device
 */
app.post('/day/:deviceId/rhythm/reset', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const rhythm = await resetRhythmProfile(DATA_DIR, deviceId);
    res.json({ success: true, rhythm });
  } catch (error) {
    console.error('POST /day/:deviceId/rhythm/reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/state
 * Save/update day state for a device
 */
app.post('/day/:deviceId/state', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const dayState: DayState = req.body;
    
    // Validate with zod
    const validated = DayStateSchema.parse(dayState);
    
    const dateKey = validated.dateKey || new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
    // Save to file
    await fs.writeFile(filePath, JSON.stringify(validated, null, 2));
    
    res.json({ success: true, dateKey });
  } catch (error: any) {
    console.error('POST /day/:deviceId/state error:', error);
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Invalid day state', details: error.errors });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

/**
 * POST /day/:deviceId/events
 * Add/update events and recompute plan
 */
app.post('/day/:deviceId/events', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { event, events, profile } = req.body;
    const incomingEvents = Array.isArray(events)
      ? events
      : event
        ? [event]
        : [];
    
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
    // Load existing state
    let dayState: DayState;
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      dayState = JSON.parse(data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Day state not found. Create state first.' });
      }
      throw error;
    }
    
    // Add/update events
    dayState.events = [...dayState.events, ...incomingEvents];
    
    // Recompute plan using engine
    const input: EngineInput = {
      now: new Date(),
      profile,
      dayState,
      options: { forceRecompute: true, stalenessThresholdMinutes: 15 },
    };
    
    const output = generatePlan(input);

    const rhythm = await updateRhythmFromEvents(DATA_DIR, deviceId, dayState, profile, incomingEvents);
    output.scheduleItems = applyRhythmToSchedule(output.scheduleItems, rhythm, profile);
    
    // Update day state with new computed plan
    dayState.lastComputedAt = new Date();
    dayState.computedPlan = output.scheduleItems;
    dayState.planMeta = {
      mode: dayState.dayMode,
      score: output.score,
      dayOneLiner: output.dayInOneLine,
      warnings: output.warnings,
    };
    
    // Save updated state
    await fs.writeFile(filePath, JSON.stringify(dayState, null, 2));
    
    res.json({
      success: true,
      output: {
        ...output,
        scheduleItems: normalizeScheduleItemsForResponse(output.scheduleItems),
      },
      rhythm,
    });
  } catch (error: any) {
    console.error('POST /day/:deviceId/events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /day/:deviceId/recompute
 * Force recompute plan with server time
 */
app.post('/day/:deviceId/recompute', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { profile } = req.body;
    
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
    // Load existing state
    let dayState: DayState;
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      dayState = JSON.parse(data, (key, value) => {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: 'Day state not found' });
      }
      throw error;
    }
    
    // Recompute with server now
    const input: EngineInput = {
      now: new Date(),
      profile,
      dayState,
      options: { forceRecompute: true, stalenessThresholdMinutes: 15 },
    };
    
    const output = generatePlan(input);
    const rhythm = await loadRhythmProfile(DATA_DIR, deviceId);
    output.scheduleItems = applyRhythmToSchedule(output.scheduleItems, rhythm, profile);
    
    // Update state
    dayState.lastComputedAt = new Date();
    dayState.computedPlan = output.scheduleItems;
    dayState.planMeta = {
      mode: dayState.dayMode,
      score: output.score,
      dayOneLiner: output.dayInOneLine,
      warnings: output.warnings,
    };
    
    await fs.writeFile(filePath, JSON.stringify(dayState, null, 2));
    
    res.json({
      success: true,
      output: {
        ...output,
        scheduleItems: normalizeScheduleItemsForResponse(output.scheduleItems),
      },
      rhythm,
    });
  } catch (error) {
    console.error('POST /day/:deviceId/recompute error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /day/:deviceId/export/today
 * Export today's state as JSON download
 */
app.get('/day/:deviceId/export/today', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const dateKey = new Date().toISOString().split('T')[0];
    const filePath = path.join(DATA_DIR, `${deviceId}_${dateKey}.json`);
    
    const data = await fs.readFile(filePath, 'utf-8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${deviceId}_${dateKey}.json"`);
    res.send(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Day state not found' });
    } else {
      console.error('GET /day/:deviceId/export/today error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});

export default app;
```

## apps/mobile/src/utils/recommendationContext.ts

```
import type { DayPlan, DayState, ScheduleItem, UserProfile } from '@physiology-engine/shared';

export interface RecommendationContext {
  date: string;
  now: string;
  wakeTime: string;
  sleepTime: string;
  workStart?: string;
  workEnd?: string;
  lunchTime?: string;
  dayMode: string;
  fitnessGoal: string;
  dietFoundation: string;
  mealSequencePreference: string;
  fastingHours: number;
  sleepScore: number;
  stressLevel: number;
  currentHeartRate?: number;
  quickStatus?: string;
  timelineItems: ScheduleItem[];
  actualEvents: ScheduleItem[];
  rhythmProfile?: any;
}

export function buildRecommendationContext(input: {
  dateISO: string;
  profile: UserProfile;
  dayState?: DayState | null;
  plan?: DayPlan | null;
  todayEntries?: ScheduleItem[];
  rhythmProfile?: any;
}): RecommendationContext {
  const timelineItems = input.plan?.items || [];
  const actualEvents = (input.todayEntries || []).filter(
    (item) => item.status === 'actual' || item.origin === 'actual'
  );

  return {
    date: input.dateISO,
    now: new Date().toISOString(),
    wakeTime: input.profile.wakeTime,
    sleepTime: input.profile.sleepTime,
    workStart: input.profile.workStartTime,
    workEnd: input.profile.workEndTime,
    lunchTime: input.profile.lunchTime,
    dayMode: input.dayState?.dayMode || input.profile.defaultDayMode || 'flex',
    fitnessGoal: input.profile.fitnessGoal || 'MAINTENANCE',
    dietFoundation: input.profile.dietFoundation || 'BALANCED',
    mealSequencePreference: input.profile.mealSequencePreference || 'balanced',
    fastingHours: input.profile.preferredFastingHours || 14,
    sleepScore: input.dayState?.sleepQuality || 7,
    stressLevel: input.dayState?.stressLevel || 5,
    currentHeartRate: (input.dayState as any)?.currentHeartRate,
    quickStatus: (input.dayState as any)?.quickStatus,
    timelineItems,
    actualEvents,
    rhythmProfile: input.rhythmProfile,
  };
}
```

## apps/mobile/src/utils/recommendationEngine.ts

```
import { parseTimeToMinutes } from './time';
import type { RecommendationContext } from './recommendationContext';

export interface RecommendationAction {
  id: 'INSERT_WALK_8' | 'INSERT_WALK_10' | 'SHIFT_LUNCH_EARLIER_15' | 'DELAY_CAFFEINE_20' | 'RECOMPUTE_FROM_NOW';
  label: string;
}

export interface RecommendationOutput {
  cards: string[];
  actions: RecommendationAction[];
}

export function generateRecommendationsFromContext(context: RecommendationContext): RecommendationOutput {
  const cards: string[] = [];
  const actions: RecommendationAction[] = [];

  const mealCount = context.timelineItems.filter((item) => item.type === 'meal' || item.type === 'snack').length;
  const workoutCount = context.timelineItems.filter((item) => item.type === 'workout').length;
  const walkCount = context.timelineItems.filter((item) => item.type === 'walk').length;

  const lunchMin = parseTimeToMinutes(context.lunchTime || '12:30') || 750;
  const lateLunch = context.timelineItems.some((item) => (item.type === 'meal' || item.type === 'lunch') && (item.startMin || 0) >= lunchMin + 60);

  if (context.fitnessGoal === 'FAT_LOSS' || context.fitnessGoal === 'WEIGHT_LOSS') {
    cards.push('Prioritize post-meal movement to improve glucose control and support fat loss.');
    cards.push('Keep meal timing stable and avoid compressing calories late in the day.');
    if (walkCount < 2) actions.push({ id: 'INSERT_WALK_8', label: 'Insert 8-min walk' });
  } else if (context.fitnessGoal === 'MUSCLE_GAIN' || context.fitnessGoal === 'MUSCLE_BUILDING') {
    cards.push('Protect workout placement and add protein-forward fueling around training.');
    cards.push('Use a strategic snack between meals when training density is high.');
    if (workoutCount === 0) actions.push({ id: 'RECOMPUTE_FROM_NOW', label: 'Add training structure' });
  } else {
    cards.push('Keep anchors consistent to preserve energy stability through the day.');
  }

  if (context.dayMode === 'tight' || context.dayMode === 'high-output') {
    cards.push('Tight mode active: keep anchors fixed and reduce discretionary inserts.');
    actions.push({ id: 'RECOMPUTE_FROM_NOW', label: 'Tighten afternoon' });
  }

  if (context.dayMode === 'recovery' || context.sleepScore <= 6 || context.stressLevel >= 7) {
    cards.push('Recovery bias: lower intensity and prioritize hydration, walking, and winddown protection.');
    if (context.stressLevel >= 7) actions.push({ id: 'DELAY_CAFFEINE_20', label: 'Delay caffeine 20 min' });
  }

  if (context.dietFoundation === 'KETO' || context.dietFoundation === 'CARNIVORE') {
    cards.push('Align meals with your diet foundation: emphasize protein/fat and reduce opportunistic carb snacking.');
  } else if (context.dietFoundation === 'MEDITERRANEAN') {
    cards.push('Favor mediterranean composition: fiber-rich plants, olive oil, and balanced protein distribution.');
  }

  if (context.mealSequencePreference === 'protein-first') {
    cards.push('Meal sequence set to protein-first: start each meal/snack with protein to blunt glucose spikes.');
  } else if (context.mealSequencePreference === 'carb-last') {
    cards.push('Meal sequence set to carb-last: keep carbs toward the end of meals for steadier energy.');
  }

  if (mealCount < 3) {
    cards.push('Low meal/snack density detected; add one bridge snack to avoid late-day energy crashes.');
  }

  if (lateLunch) {
    actions.push({ id: 'SHIFT_LUNCH_EARLIER_15', label: 'Shift lunch earlier' });
  }

  if (context.fastingHours >= 16) {
    cards.push(`Fasting target is ${context.fastingHours}h: avoid random intake outside your planned window.`);
  }

  return {
    cards: Array.from(new Set(cards)).slice(0, 6),
    actions: dedupeActions(actions).slice(0, 3),
  };
}

function dedupeActions(actions: RecommendationAction[]): RecommendationAction[] {
  const seen = new Set<string>();
  const deduped: RecommendationAction[] = [];
  for (const action of actions) {
    if (seen.has(action.id)) continue;
    seen.add(action.id);
    deduped.push(action);
  }
  return deduped;
}
```

## apps/mobile/src/advisor/types.ts

```
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
```

## apps/mobile/src/advisor/buildContext.ts

```
/**
 * AlignOS Advisor - Context Builder
 * Assembles DayState context for decision engine
 */

import type { DecisionContext } from './types';
import type { UserProfile, DayPlan, DayState } from '@physiology-engine/shared';
import { buildRecommendationContext } from '../utils/recommendationContext';

export function buildDecisionContext(
  query: string,
  profile: UserProfile,
  dayState: DayState | null,
  currentPlan: DayPlan | null
): DecisionContext {
  const dateISO = new Date().toISOString().split('T')[0];

  return {
    query,
    profile,
    dayState,
    currentPlan: currentPlan ?? undefined,
    currentTime: new Date(),
    recommendationContext: buildRecommendationContext({
      dateISO,
      profile,
      dayState,
      plan: currentPlan,
      todayEntries: currentPlan?.items || [],
    }),
  };
}

/**
 * Get current context summary for display in Context Bar
 */
export function getContextSummary(dayState: DayState | null, currentPlan: DayPlan | null) {
  if (!dayState || !currentPlan) {
    return {
      dayMode: 'flex',
      sleepScore: 7,
      stressLevel: 'low',
      fastingHours: 16,
      nextMeal: null,
      nowTime: new Date(),
    };
  }

  const now = new Date();
  const nextMealItem = currentPlan.items.find(
    item => item.type === 'meal' && new Date(item.startISO) > now
  );

  return {
    dayMode: dayState.dayMode || 'flex',
    sleepScore: dayState.sleepQuality || 7,
    stressLevel: dayState.stressLevel === 0 ? 'low' : dayState.stressLevel === 1 ? 'medium' : 'high',
    fastingHours: 16, // Default, could calculate from profile
    nextMeal: nextMealItem ? {
      title: nextMealItem.title,
      time: new Date(nextMealItem.startISO),
    } : null,
    nowTime: now,
  };
}
```

