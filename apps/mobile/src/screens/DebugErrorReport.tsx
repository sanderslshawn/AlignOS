import React, { useEffect, useState } from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DebugErrorReport() {
  const [report, setReport] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem('last_error_report');
        setReport(raw);
      } catch (e) {
        setReport(`Failed to read: ${String(e)}`);
      }
    })();
  }, []);

  const refresh = async () => {
    const raw = await AsyncStorage.getItem('last_error_report');
    setReport(raw);
  };

  const clear = async () => {
    await AsyncStorage.removeItem('last_error_report');
    setReport(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Last Error Report</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 12 }}>
        <Text style={styles.text}>{report || 'No report found'}</Text>
      </ScrollView>
      <View style={styles.buttons}>
        <Button title="Refresh" onPress={refresh} />
        <Button title="Clear" onPress={clear} color="#d33" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  scroll: { flex: 1, backgroundColor: '#081124', borderRadius: 8 },
  text: { color: '#ddd', fontSize: 12 },
  buttons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
});
