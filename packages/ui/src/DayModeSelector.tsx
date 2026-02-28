import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function DayModeSelector() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Day Mode Selector Component</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  text: { color: '#fff', fontSize: 16 },
});
