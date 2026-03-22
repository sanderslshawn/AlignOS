import React, { useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import type { ClockTime } from '@physiology-engine/shared';
import { formatClockTime, fromDateToClockTime, parseClockTime, toSortableMinutes } from '../utils/clockTime';

interface ClockTimeFieldProps {
  label?: string;
  value?: ClockTime | null;
  onChange: (value: ClockTime) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ClockTimeField({
  label,
  value,
  onChange,
  placeholder = 'Select time',
  disabled = false,
}: ClockTimeFieldProps) {
  const parsedValue = useMemo(() => (value ? parseClockTime(value) : null), [value]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState(() => {
    const initial = parsedValue || { hour: 12, minute: 0, period: 'AM' as const };
    const sortable = toSortableMinutes(initial);
    return new Date(2000, 0, 1, Math.floor(sortable / 60), sortable % 60, 0, 0);
  });

  const openPicker = () => {
    if (disabled) return;
    const base = parsedValue || { hour: 12, minute: 0, period: 'AM' as const };
    const sortable = toSortableMinutes(base);
    setTempDate(new Date(2000, 0, 1, Math.floor(sortable / 60), sortable % 60, 0, 0));
    setPickerVisible(true);
  };

  const onTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setPickerVisible(false);
      return;
    }

    if (!selectedDate) return;
    setTempDate(selectedDate);

    if (Platform.OS === 'android' && event.type === 'set') {
      onChange(fromDateToClockTime(selectedDate));
      setPickerVisible(false);
    }
  };

  const confirmIOS = () => {
    onChange(fromDateToClockTime(tempDate));
    setPickerVisible(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        style={[styles.field, disabled && styles.fieldDisabled]}
        onPress={openPicker}
        disabled={disabled}
      >
        <Text style={[styles.valueText, !parsedValue && styles.placeholderText]}>
          {parsedValue ? formatClockTime(parsedValue) : placeholder}
        </Text>
      </TouchableOpacity>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Time</Text>
            <DateTimePicker
              value={tempDate}
              mode="time"
              display="spinner"
              is24Hour={false}
              locale={Platform.OS === 'ios' ? 'en_US' : undefined}
              onChange={onTimeChange}
            />
            {Platform.OS === 'ios' ? (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => setPickerVisible(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={confirmIOS}>
                  <Text style={styles.confirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '600',
    marginBottom: 8,
  },
  field: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  valueText: {
    color: '#fff',
    fontSize: 16,
  },
  placeholderText: {
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    color: '#aaa',
    fontWeight: '600',
  },
  confirmText: {
    color: '#22D3EE',
    fontWeight: '700',
  },
});
