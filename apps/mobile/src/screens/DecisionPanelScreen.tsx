/**
 * AlignOS Decision Panel
 * OS-level structured advisor with context-aware actions
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { usePlanStore } from '../store/planStore';
import { haptics } from '../utils/haptics';
import { format } from 'date-fns';
import { 
  ask as askAdvisor,
  getRemainingCustomQuestions,
  getCustomQuestionsUsedToday,
} from '../advisor';
import type { AdvisorResponse, Action } from '../advisor';
import { 
  useTheme, 
  Card, 
  Chip, 
  PrimaryButton, 
  SecondaryButton,
  AppIcon,
  Divider,
  Pill,
} from '@physiology-engine/ui';

export default function DecisionPanelScreen({ navigation }: any) {
  const { colors, typography, spacing, radius } = useTheme();
  const { 
    profile, 
    dayState, 
    fullDayPlan, 
    addTodayEntry, 
    updateTodayEntry,
    generateFullDayPlan,
  } = usePlanStore();
  
  const [inputText, setInputText] = useState('');
  const [currentResponse, setCurrentResponse] = useState<AdvisorResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [remainingQuestions, setRemainingQuestions] = useState(5);
  const scrollRef = useRef<ScrollView>(null);

  // Load remaining questions on mount and refresh
  React.useEffect(() => {
    getRemainingCustomQuestions().then(setRemainingQuestions);
  }, [currentResponse]);

  const handleAsk = async () => {
    if (!inputText.trim() || !profile) return;
    
    haptics.light();
    const query = inputText.trim();
    setInputText('');
    setIsProcessing(true);
    
    try {
      const response = await askAdvisor(query);
      setCurrentResponse(response);
      haptics.success();
      
      // Refresh remaining questions count
      const remaining = await getRemainingCustomQuestions();
      setRemainingQuestions(remaining);
    } catch (error) {
      console.error('Failed to get advisor response:', error);
      haptics.error();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickIntent = (intent: string) => {
    haptics.light();
    setInputText(intent);
  };

  const handleAction = async (action: Action) => {
    haptics.medium();
    // TODO: Implement action execution
    // For now, just show success feedback
    setLastAction(action.label);
    setShowUndo(true);
    haptics.success();
    
    // Hide undo after 4 seconds
    setTimeout(() => setShowUndo(false), 4000);
  };
  
  const handleSuggestionTap = async (suggestionTitle: string) => {
    // When user taps a clarify suggestion, treat it as a new question
    haptics.light();
    setInputText(suggestionTitle);
    // Optionally auto-submit:
    setTimeout(() => {
      setInputText(suggestionTitle);
      handleAsk();
    }, 100);
  };

  const quickIntents = [
    { label: 'Meal timing', query: 'When should I eat lunch?' },
    { label: 'Snack', query: 'Can I snack between meals?' },
    { label: 'Comfort meal', query: 'When can I have pudding?' },
    { label: 'Caffeine', query: 'Best time for coffee?' },
    { label: 'Workout', query: 'When should I train?' },
    { label: 'Low energy', query: 'Feeling sluggish' },
  ];

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <AppIcon name="alert" size={48} color={colors.textSecondary} />
          <Text style={[typography.bodyM, { color: colors.textSecondary, marginTop: spacing.lg }]}>
            Set up your profile to use the Decision Panel
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* A) CONTEXT BAR - Shows current day state */}
      <View style={[styles.contextBar, { backgroundColor: colors.surface, borderBottomColor: colors.borderSubtle }]}>
        <View style={styles.contextRow}>
          <Pill variant="accent" label={dayState?.dayMode || profile?.defaultDayMode || 'flex'} />
          <View style={styles.contextDot} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            {format(new Date(), 'h:mma')}
          </Text>
          <View style={styles.contextDot} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Sleep {dayState?.sleepQuality || 7}/10
          </Text>
          <View style={styles.contextDot} />
          <Text style={[typography.caption, { color: colors.textSecondary }]}>
            Stress {dayState?.stressLevel || profile?.stressBaseline || 5}
          </Text>
        </View>
        {/* Custom questions remaining */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <AppIcon name="sparkles" size={12} color={remainingQuestions > 0 ? colors.accentPrimary : colors.textMuted} />
          <Text style={[typography.micro, { color: colors.textMuted, marginLeft: 4 }]}>
            Custom questions today: {remainingQuestions}/5 remaining
          </Text>
        </View>
      </View>

      <ScrollView 
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* B) ASK AREA */}
        <View style={[styles.askArea, { marginHorizontal: spacing.lg, marginTop: spacing.lg }]}>
          <Text style={[typography.titleM, { color: colors.textPrimary, marginBottom: spacing.sm }]}>
            Ask a Question
          </Text>
          
          <View style={[styles.inputContainer, { 
            backgroundColor: colors.surfaceElevated, 
            borderColor: colors.borderSubtle,
            borderRadius: radius.md,
          }]}>
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="e.g., When should I eat the banana pudding?"
              placeholderTextColor={colors.textMuted}
              style={[
                typography.bodyM,
                styles.input,
                { color: colors.textPrimary },
              ]}
              multiline
              onSubmitEditing={handleAsk}
              editable={!isProcessing}
            />
            <TouchableOpacity
              onPress={handleAsk}
              disabled={!inputText.trim() || isProcessing}
              style={[styles.sendButton, { 
                backgroundColor: inputText.trim() ? colors.accentPrimary : colors.borderSubtle,
                opacity: isProcessing ? 0.5 : 1,
              }]}
            >
              <AppIcon 
                name="chevronUp" 
                size={20} 
                color={inputText.trim() ? colors.background : colors.textMuted} 
              />
            </TouchableOpacity>
          </View>

          {/* Quick Intent Chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.quickIntents}
          >
            {quickIntents.map((intent, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => handleQuickIntent(intent.query)}
              >
                <Chip style={{ marginRight: spacing.xs }}>
                  {intent.label}
                </Chip>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* C) ANSWER CARD */}
        {currentResponse && (
          <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xl }}>
            <Text style={[typography.titleM, { color: colors.textPrimary, marginBottom: spacing.md }]}>
              {currentResponse.source === 'clarify' ? 'Did you mean...' : 'Decision'}
            </Text>
            
            <Card>
              {/* Direct Answer */}
              <Text style={[typography.bodyM, { color: colors.textPrimary, lineHeight: 22, marginBottom: spacing.md }]}>
                {currentResponse.directAnswer}
              </Text>

              <Divider />

              {/* Recommended Insert */}
              {currentResponse.inserts && currentResponse.inserts.length > 0 && (
                <>
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <AppIcon name="calendar" size={16} color={colors.accentPrimary} />
                      <Text style={[typography.bodyM, { 
                        color: colors.textSecondary, 
                        fontSize: 12, 
                        fontWeight: '600',
                        marginLeft: 4,
                      }]}>
                        RECOMMENDED INSERT
                      </Text>
                    </View>
                    {currentResponse.inserts.map((insert, i) => (
                      <View key={i} style={styles.insertItem}>
                        <AppIcon name="plus" size={14} color={colors.textMuted} />
                        <Text style={[typography.bodyM, { color: colors.textPrimary, marginLeft: spacing.xs }]}>
                          {insert.title}
                        </Text>
                        {insert.startTime && (
                          <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12, marginLeft: spacing.xs }]}>
                            {insert.startTime}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                  <Divider />
                </>
              )}

              {/* Next 3 Moves - Clarify mode shows as tappable suggestions */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AppIcon name="clock" size={16} color={colors.accentPrimary} />
                  <Text style={[typography.bodyM, { 
                    color: colors.textSecondary, 
                    fontSize: 12, 
                    fontWeight: '600',
                    marginLeft: 4,
                  }]}>
                    {currentResponse.source === 'clarify' ? 'SUGGESTIONS' : 'NEXT MOVES'}
                  </Text>
                </View>
                {currentResponse.nextMoves.map((move, i) => (
                  <TouchableOpacity 
                    key={i} 
                    style={styles.moveRow}
                    onPress={currentResponse.source === 'clarify' ? () => handleSuggestionTap(move.title) : undefined}
                    disabled={currentResponse.source !== 'clarify'}
                  >
                    {move.time && (
                      <Text style={[typography.bodyM, { 
                        color: colors.accentPrimary, 
                        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                        fontSize: 12,
                        width: 60,
                      }]}>
                        {move.time}
                      </Text>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 13 }]}>
                        {move.title}
                      </Text>
                      {move.reason && (
                        <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                          {move.reason}
                        </Text>
                      )}
                    </View>
                    {currentResponse.source === 'clarify' && (
                      <AppIcon name="chevronRight" size={16} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* If/Then */}
              {currentResponse.ifThen && currentResponse.ifThen.length > 0 && (
                <>
                  <Divider />
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <AppIcon name="info" size={16} color={colors.accentPrimary} />
                      <Text style={[typography.bodyM, { 
                        color: colors.textSecondary, 
                        fontSize: 12, 
                        fontWeight: '600',
                        marginLeft: 4,
                      }]}>
                        IF/THEN
                      </Text>
                    </View>
                    {currentResponse.ifThen.map((branch, i) => (
                      <View key={i} style={styles.ifThenRow}>
                        <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12 }]}>
                          {branch.if}
                        </Text>
                        <Text style={[typography.bodyM, { color: colors.textPrimary, fontSize: 13, marginTop: 2 }]}>
                          → {branch.then}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Why */}
              <Divider />
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <AppIcon name="brain" size={16} color={colors.accentPrimary} />
                  <Text style={[typography.bodyM, { 
                    color: colors.textSecondary, 
                    fontSize: 12, 
                    fontWeight: '600',
                    marginLeft: 4,
                  }]}>
                    WHY
                  </Text>
                </View>
                <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 13, lineHeight: 20 }]}>
                  {currentResponse.why}
                </Text>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* D) ACTION TRAY - Bottom sticky */}
      {currentResponse && currentResponse.actions && currentResponse.actions.length > 0 && (
        <View style={[styles.actionTray, { 
          backgroundColor: colors.surface, 
          borderTopColor: colors.borderSubtle,
        }]}>
          {currentResponse.actions.map((action, i) => (
            <PrimaryButton
              key={i}
              onPress={() => handleAction(action)}
              style={styles.actionButton}
            >
              {action.label}
            </PrimaryButton>
          ))}
        </View>
      )}

      {/* Undo Snackbar */}
      {showUndo && lastAction && (
        <View style={[styles.undoSnackbar, { 
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.accentPrimary,
        }]}>
          <AppIcon name="check" size={16} color={colors.success} />
          <Text style={[typography.bodyM, { color: colors.textPrimary, marginLeft: spacing.sm, flex: 1 }]}>
            {lastAction}
          </Text>
          <TouchableOpacity onPress={() => setShowUndo(false)}>
            <Text style={[typography.bodyM, { color: colors.accentPrimary, fontWeight: '600' }]}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  contextBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  contextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#666',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  askArea: {},
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    padding: 12,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  quickIntents: {
    marginTop: 12,
  },
  contextToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  section: {
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  moveRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  ifThenRow: {
    marginTop: 8,
  },
  actionTray: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  actionButton: {
    width: '100%',
  },
  undoSnackbar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
});
