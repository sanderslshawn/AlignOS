import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function StepCard() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Step Card Component</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#1a1a1a', borderRadius: 8, marginBottom: 12 },
  text: { color: '#fff', fontSize: 16 },
});
