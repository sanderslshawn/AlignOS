import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView, Switch } from 'react-native';
import type { ScheduleItem } from '@physiology-engine/shared';
import { format, parse } from 'date-fns';

interface EditScheduleItemModalProps {
  visible: boolean;
  item: ScheduleItem | null;
  onSave: (item: ScheduleItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const ITEM_TYPES = [
  { value: 'wake', label: 'Wake' },
  { value: 'sleep', label: 'Sleep' },
  { value: 'work', label: 'Work' },
  { value: 'meal', label: 'Meal' },
  { value: 'workout', label: 'Workout' },
  { value: 'walk', label: 'Walk' },
  { value: 'focus', label: 'Focus' },
  { value: 'break', label: 'Break' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'custom', label: 'Custom' },
];

export default function EditScheduleItemModal({ visible, item, onSave, onDelete, onClose }: EditScheduleItemModalProps) {
  const [editedItem, setEditedItem] = useState<ScheduleItem | null>(item);

  React.useEffect(() => {
    if (item) {
      setEditedItem(item);
    }
  }, [item]);

  if (!editedItem) return null;

  const handleSave = () => {
    onSave(editedItem);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onClose();
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return format(date, 'HH:mm');
    } catch {
      return '00:00';
    }
  };

  const updateTime = (isoString: string, timeStr: string) => {
    try {
      const date = new Date(isoString);
      const [hours, minutes] = timeStr.split(':').map(Number);
      date.setHours(hours, minutes);
      return date.toISOString();
    } catch {
      return isoString;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView style={styles.scrollView}>
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
                <TextInput
                  style={styles.input}
                  value={formatTime(editedItem.startISO)}
                  onChangeText={(text) =>
                    setEditedItem({
                      ...editedItem,
                      startISO: updateTime(editedItem.startISO, text),
                    })
                  }
                  placeholder="HH:mm"
                  placeholderTextColor="#666"
                  keyboardType="numbers-and-punctuation"
                />
              </View>

              <View style={[styles.field, styles.half]}>
                <Text style={styles.label}>End Time</Text>
                <TextInput
                  style={styles.input}
                  value={formatTime(editedItem.endISO)}
                  onChangeText={(text) =>
                    setEditedItem({
                      ...editedItem,
                      endISO: updateTime(editedItem.endISO, text),
                    })
                  }
                  placeholder="HH:mm"
                  placeholderTextColor="#666"
                  keyboardType="numbers-and-punctuation"
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
                trackColor={{ false: '#444', true: '#14967F' }}
                thumbColor="#fff"
                disabled={editedItem.type === 'wake' || editedItem.type === 'sleep'}
              />
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              {onDelete && editedItem.type !== 'wake' && editedItem.type !== 'sleep' && (
                <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Save</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
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
    backgroundColor: '#14967F',
    borderColor: '#14967F',
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
    backgroundColor: '#14967F',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
