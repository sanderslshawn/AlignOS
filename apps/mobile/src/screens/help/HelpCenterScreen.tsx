import React, { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@physiology-engine/ui';
import HowAlignOSWorksScreen from './HowAlignOSWorksScreen';
import GlossaryScreen from './GlossaryScreen';
import FaqScreen from './FaqScreen';
import GuidesScreen from './GuidesScreen';
import { useTourProgress } from '../../hooks/useTourProgress';

type HelpTab = 'how' | 'glossary' | 'faq' | 'guides';

interface HelpCenterScreenProps {
  route?: {
    params?: {
      initialTab?: HelpTab;
      term?: string;
    };
  };
  navigation?: any;
}

const TAB_LABELS: Array<{ key: HelpTab; label: string }> = [
  { key: 'how', label: 'How AlignOS Works' },
  { key: 'glossary', label: 'Glossary' },
  { key: 'faq', label: 'FAQs' },
  { key: 'guides', label: 'Guides' },
];

export default function HelpCenterScreen({ route, navigation }: HelpCenterScreenProps) {
  const { colors, typography, spacing, radius } = useTheme();
  const { hasCompletedTour } = useTourProgress();
  const [tab, setTab] = useState<HelpTab>(route?.params?.initialTab || 'how');
  const initialTerm = route?.params?.term;

  const content = useMemo(() => {
    if (tab === 'glossary') return <GlossaryScreen initialTerm={initialTerm} />;
    if (tab === 'faq') return <FaqScreen />;
    if (tab === 'guides') return <GuidesScreen />;
    return <HowAlignOSWorksScreen />;
  }, [tab, initialTerm]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
        <Text style={[typography.titleM, { color: colors.textPrimary }]}>Help Center</Text>
        <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>Learn how AlignOS works and why it recommends what it does</Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
          {TAB_LABELS.map((entry) => {
            const active = tab === entry.key;
            return (
              <TouchableOpacity
                key={entry.key}
                onPress={() => setTab(entry.key)}
                style={{
                  borderWidth: 1,
                  borderColor: active ? colors.accentPrimary : colors.borderSubtle,
                  backgroundColor: active ? colors.accentSoft : colors.surface,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  marginRight: spacing.xs,
                  marginBottom: spacing.xs,
                }}
              >
                <Text style={[typography.caption, { color: active ? colors.accentPrimary : colors.textSecondary }]}>{entry.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {navigation ? (
          <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
            <TouchableOpacity onPress={() => navigation.navigate('HowAlignOSWorks')} style={{ marginRight: spacing.sm }}>
              <Text style={[typography.caption, { color: colors.accentPrimary }]}>Open full pages</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('LearnAlignOSTour')}>
              <Text style={[typography.caption, { color: colors.accentPrimary }]}>{hasCompletedTour ? 'Replay Learn AlignOS Tour' : 'Start Learn AlignOS Tour'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>{content}</View>
    </View>
  );
}
