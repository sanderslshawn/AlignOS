import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView, Switch, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import type { ScheduleItem } from '@physiology-engine/shared';
import { ensureStartEnd } from '../utils/time';
import ClockTimeField from './ClockTimeField';
import { addMinutes, clockTimeFromISO, parseClockTime, toISOWithClockTime, toSortableMinutes } from '../utils/clockTime';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { canDeleteScheduleItem } from '../engine/normalizeTimeline';

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
  { value: 'commute', label: 'Commute' },
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

  const canDelete = canDeleteScheduleItem(editedItem);

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
                <Text style={styles.label}>Treat as fixed anchor</Text>
                <Text style={styles.hint}>Fixed anchors define timeline placement but can still be edited or deleted</Text>
              </View>
              <Switch
                value={Boolean(editedItem.isFixedAnchor || editedItem.fixed || (editedItem.meta && (editedItem.meta as any).isAnchor))}
                onValueChange={(value) =>
                  setEditedItem({
                    ...editedItem,
                    isSystemAnchor: editedItem.type === 'wake' || editedItem.type === 'sleep',
                    isFixedAnchor: value,
                    fixed: value,
                    meta: {
                      ...(editedItem.meta || {}),
                      isAnchor: value,
                    },
                  })
                }
                trackColor={{ false: '#444', true: '#22D3EE' }}
                thumbColor="#fff"
                disabled={Boolean(editedItem.isSystemAnchor || editedItem.type === 'wake' || editedItem.type === 'sleep')}
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
