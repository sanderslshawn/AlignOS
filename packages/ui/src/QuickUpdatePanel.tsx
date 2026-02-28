import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function QuickUpdatePanel() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Quick Update Panel Component</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#0a0a0a' },
  text: { color: '#fff', fontSize: 16 },
});
