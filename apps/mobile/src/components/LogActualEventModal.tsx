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
