import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import type { Event, MealType, CaffeineType, HRZone, ActivationType } from '@physiology-engine/shared';
import { format } from 'date-fns';

interface EditEventModalProps {
  visible: boolean;
  event: Event;
  time: Date;
  onClose: () => void;
  onSave: (updatedEvent: Event, delayMinutes: number) => void;
  onDelete: () => void;
}

export default function EditEventModal({
  visible,
  event,
  time,
  onClose,
  onSave,
  onDelete,
}: EditEventModalProps) {
  const [delayMinutes, setDelayMinutes] = useState('0');
  const [editedEvent, setEditedEvent] = useState<Event>(event);

  const handleSave = () => {
    onSave(editedEvent, parseInt(delayMinutes) || 0);
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove Event',
      'Remove this from your plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onDelete();
            onClose();
          },
        },
      ]
    );
  };

  const updateEventField = (field: string, value: any) => {
    setEditedEvent({ ...editedEvent, [field]: value } as Event);
  };

  const renderEventSpecificFields = () => {
    switch (event.type) {
      case 'meal':
        const mealTypes: MealType[] = ['lean-protein', 'richer-protein', 'carb-heavy', 'comfort-meal'];
        return (
          <>
            <Text style={styles.label}>Meal Type</Text>
            <View style={styles.optionsContainer}>
              {mealTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.option,
                    editedEvent.type === 'meal' && editedEvent.mealType === type && styles.optionSelected,
                  ]}
                  onPress={() => updateEventField('mealType', type)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      editedEvent.type === 'meal' && editedEvent.mealType === type && styles.optionTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );

      case 'caffeine':
        const caffeineTypes: CaffeineType[] = ['espresso', 'coffee', 'tea', 'pre-workout'];
        return (
          <>
            <Text style={styles.label}>Caffeine Type</Text>
            <View style={styles.optionsContainer}>
              {caffeineTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.option,
                    editedEvent.type === 'caffeine' && editedEvent.caffeineType === type && styles.optionSelected,
                  ]}
                  onPress={() => updateEventField('caffeineType', type)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      editedEvent.type === 'caffeine' && editedEvent.caffeineType === type && styles.optionTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Amount (mg)</Text>
            <TextInput
              style={styles.input}
              value={editedEvent.type === 'caffeine' ? editedEvent.amount.toString() : ''}
              onChangeText={(text) => updateEventField('amount', parseInt(text) || 0)}
              keyboardType="numeric"
            />
          </>
        );

      case 'walk':
        const hrZones: HRZone[] = ['zone1', 'zone2', 'zone3', 'zone4', 'zone5'];
        return (
          <>
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              value={editedEvent.type === 'walk' ? editedEvent.duration.toString() : ''}
              onChangeText={(text) => updateEventField('duration', parseInt(text) || 0)}
              keyboardType="numeric"
            />
            <Text style={styles.label}>Heart Rate Zone</Text>
            <View style={styles.optionsContainer}>
              {hrZones.map((zone) => (
                <TouchableOpacity
                  key={zone}
                  style={[
                    styles.option,
                    editedEvent.type === 'walk' && editedEvent.hrZone === zone && styles.optionSelected,
                  ]}
                  onPress={() => updateEventField('hrZone', zone)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      editedEvent.type === 'walk' && editedEvent.hrZone === zone && styles.optionTextSelected,
                    ]}
                  >
                    {zone}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );

      case 'workout':
        const intensities = ['light', 'moderate', 'hard', 'very-hard'] as const;
        return (
          <>
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              value={editedEvent.type === 'workout' ? editedEvent.duration.toString() : ''}
              onChangeText={(text) => updateEventField('duration', parseInt(text) || 0)}
              keyboardType="numeric"
            />
            <Text style={styles.label}>Intensity</Text>
            <View style={styles.optionsContainer}>
              {intensities.map((intensity) => (
                <TouchableOpacity
                  key={intensity}
                  style={[
                    styles.option,
                    editedEvent.type === 'workout' && editedEvent.intensity === intensity && styles.optionSelected,
                  ]}
                  onPress={() => updateEventField('intensity', intensity)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      editedEvent.type === 'workout' && editedEvent.intensity === intensity && styles.optionTextSelected,
                    ]}
                  >
                    {intensity}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );

      case 'activation':
        const activationTypes: ActivationType[] = ['pre-walk', 'pre-meal', 'midday-reset', 'night-routine', 'posture-core'];
        return (
          <>
            <Text style={styles.label}>Activation Type</Text>
            <View style={styles.optionsContainer}>
              {activationTypes.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.option,
                    editedEvent.type === 'activation' && editedEvent.activationType === type && styles.optionSelected,
                  ]}
                  onPress={() => updateEventField('activationType', type)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      editedEvent.type === 'activation' && editedEvent.activationType === type && styles.optionTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Duration (minutes)</Text>
            <TextInput
              style={styles.input}
              value={editedEvent.type === 'activation' ? editedEvent.duration.toString() : ''}
              onChangeText={(text) => updateEventField('duration', parseInt(text) || 0)}
              keyboardType="numeric"
            />
          </>
        );

      case 'hydration':
        return (
          <>
            <Text style={styles.label}>Amount (ml)</Text>
            <TextInput
              style={styles.input}
              value={editedEvent.type === 'hydration' ? editedEvent.amount.toString() : ''}
              onChangeText={(text) => updateEventField('amount', parseInt(text) || 0)}
              keyboardType="numeric"
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView>
            <Text style={styles.title}>Edit {event.type}</Text>
            <Text style={styles.subtitle}>
              {format(time, 'h:mm a')}
            </Text>

            {renderEventSpecificFields()}

            <Text style={styles.label}>Adjust Time</Text>
            <View style={styles.timeAdjustRow}>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setDelayMinutes((parseInt(delayMinutes) - 15).toString())}
              >
                <Text style={styles.timeButtonText}>-15 min</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.timeInput}
                value={delayMinutes}
                onChangeText={setDelayMinutes}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#666"
              />
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setDelayMinutes((parseInt(delayMinutes) + 15).toString())}
              >
                <Text style={styles.timeButtonText}>+15 min</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>Remove</Text>
              </TouchableOpacity>
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save & Regenerate</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
    marginTop: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  option: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: '#22D3EE',
    backgroundColor: 'rgba(34, 211, 238, 0.08)',
  },
  optionText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#22D3EE',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  timeAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    alignItems: 'center',
  },
  timeButtonText: {
    color: '#22D3EE',
    fontSize: 14,
    fontWeight: '600',
  },
  timeInput: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    minWidth: 80,
  },
  actions: {
    marginTop: 32,
    marginBottom: 16,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#d32f2f',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#d32f2f',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#22D3EE',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
