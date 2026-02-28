import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function TimelineView() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Timeline View Component</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  text: { color: '#fff', fontSize: 16 },
});
