import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { GLOSSARY, FAQ } from '../data/glossary';

export default function HelpScreen({ route }: any) {
  const [search, setSearch] = useState(route?.params?.term || '');

  const filteredGlossary = useMemo(() => {
    if (!search.trim()) return GLOSSARY;
    const query = search.toLowerCase();
    return GLOSSARY.filter((entry) =>
      entry.term.toLowerCase().includes(query) || entry.definition.toLowerCase().includes(query)
    );
  }, [search]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Help</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How AlignOS Works</Text>
        <Text style={styles.body}>
          AlignOS builds your day from wake to sleep, lets you edit blocks quickly, then reorders and recomputes so the timeline stays coherent.
          The advisor provides context-based suggestions that can be inserted directly into your plan.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Glossary</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search glossary terms"
          placeholderTextColor="#666"
        />
        {filteredGlossary.map((item) => (
          <View key={item.term} style={styles.glossaryItem}>
            <Text style={styles.term}>{item.term}</Text>
            <Text style={styles.definition}>{item.definition}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>FAQ</Text>
        {FAQ.map((entry) => (
          <Text key={entry} style={styles.faqItem}>• {entry}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#121212',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionTitle: {
    color: '#22D3EE',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  body: {
    color: '#cfcfcf',
    fontSize: 14,
    lineHeight: 22,
  },
  searchInput: {
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    marginBottom: 12,
  },
  glossaryItem: {
    marginBottom: 12,
  },
  term: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  definition: {
    color: '#b0b0b0',
    fontSize: 13,
    lineHeight: 20,
  },
  faqItem: {
    color: '#cfcfcf',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
});
