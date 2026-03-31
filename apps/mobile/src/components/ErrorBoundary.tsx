import React from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: any; info?: any };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  async componentDidCatch(error: any, info: any) {
    this.setState({ hasError: true, error, info });
    try {
      const payload = {
        error: String(error),
        stack: error?.stack,
        info,
        ts: new Date().toISOString(),
      };
      await AsyncStorage.setItem('last_error_report', JSON.stringify(payload));
      // keep console for developers
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] saved error report', payload);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to persist error report', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.text}>{String(this.state.error)}</Text>
            <Text style={styles.text}>{JSON.stringify(this.state.info)}</Text>
          </ScrollView>
          <Button
            title="Reload"
            onPress={() => {
              // try a soft reload
              // eslint-disable-next-line no-restricted-globals
              if ((global as any).ExpoUpdates && (global as any).ExpoUpdates.reloadAsync) {
                (global as any).ExpoUpdates.reloadAsync();
              } else {
                // fallback: reload via location (only in web) or noop
              }
            }}
          />
        </View>
      );
    }

    return this.props.children as any;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', padding: 16, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  scroll: { maxHeight: 300, marginBottom: 12 },
  text: { color: '#ddd', fontSize: 12, marginBottom: 6 },
});
