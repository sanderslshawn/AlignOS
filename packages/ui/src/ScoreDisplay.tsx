import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function ScoreDisplay() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Score Display Component</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#0a0a0a', borderRadius: 8 },
  text: { color: '#fff', fontSize: 16 },
});
