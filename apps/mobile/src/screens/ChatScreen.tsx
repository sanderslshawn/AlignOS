/**
 * AlignOS AI Advisor Screen
 * Decision Engine Interface
 */

import React, { useEffect, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlanStore } from '../store/planStore';
import { haptics } from '../utils/haptics';
import { getApiBaseUrl } from '../utils/apiBaseUrl';
import { addMinutes, format } from 'date-fns';
import { ask as askAdvisor, presetBank } from '../advisor';
import type { AdvisorResponse } from '../advisor';
import type { ScheduleItem } from '@physiology-engine/shared';
import { extractTimelineInserts, hasTimelineSuggestion, mapAdvisorInsertToScheduleItem } from '../advisor/utils/timelineInsert';
import { 
  useTheme, 
  Card, 
  Chip, 
  PrimaryButton, 
  SecondaryButton,
  SectionTitle,
  AppIcon,
  Divider,
} from '@physiology-engine/ui';


interface Message {
  id: string;
  type: 'user' | 'advisor';
  text: string;
  timestamp: Date;
  response?: AdvisorResponse;
}

export const ADVISOR_STARTER_PROMPTS = [
  'Why am I feeling low energy right now?',
  'What is the best time to work out today?',
  'Why did AlignOS suggest a walk?',
  'Should I move my lunch earlier?',
  'How can I improve my momentum today?',
];

export default function ChatScreen({ navigation }: any) {
  const { colors, typography, spacing, radius } = useTheme();
  const {
    profile,
    deviceId,
    todayEntries,
    addTodayEntry,
    deleteTodayEntry,
    generatePlan,
    generateFullDayPlan,
  } = usePlanStore();
  const API_BASE_URL = getApiBaseUrl();
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      type: 'advisor',
      text: 'I\'m your decision engine. Ask specific questions like: "When should I eat lunch?" or "Best time to workout?"',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Meals');
  const [isProcessing, setIsProcessing] = useState(false);
  const [addedInsertIds, setAddedInsertIds] = useState<string[]>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<ScheduleItem[] | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const categories = ['Meals', 'Snacks', 'Treats', 'Caffeine', 'Workout', 'Energy', 'Sleep', 'Stress', 'Schedule'];

  const categoryMap: Record<string, string[]> = {
    Meals: ['meal', 'breakfast', 'lunch', 'dinner'],
    Snacks: ['snack'],
    Treats: ['treat', 'comfort', 'dessert', 'candy'],
    Caffeine: ['caffeine', 'coffee'],
    Workout: ['workout', 'exercise', 'training', 'walk'],
    Energy: ['energy', 'dip', 'tired', 'fatigue'],
    Sleep: ['sleep', 'bedtime', 'winddown'],
    Stress: ['stress', 'anxiety', 'overwhelm'],
    Schedule: ['schedule', 'reschedule', 'shift', 'timing', 'weekend'],
  };

  const filteredQuestionBank = presetBank
    .filter((item: any) => categoryMap[selectedCategory].some((keyword) =>
      item.tags?.some((tag: string) => tag.toLowerCase().includes(keyword)) ||
      item.title.toLowerCase().includes(keyword)
    ))
    .filter((item: any) =>
      !questionSearch.trim() || item.title.toLowerCase().includes(questionSearch.trim().toLowerCase())
    )
    .slice(0, 25);

  const handleSend = async (rawText?: string) => {
    const prompt = (rawText ?? inputText).trim();
    if (!prompt || !profile) return;
    
    haptics.light();
    const text = prompt;
    setInputText('');
    
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
    
    // Get structured response from advisor
    try {
      const response = await askAdvisor(text);
      
      const advisorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'advisor',
        text: response.directAnswer,
        timestamp: new Date(),
        response,
      };
      
      setMessages(prev => [...prev, advisorMessage]);
      haptics.success();
    } catch (error) {
      console.error('Failed to get advisor response:', error);
      haptics.error();
    } finally {
      setIsProcessing(false);
      
      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleQuickQuestion = (question: string) => {
    haptics.light();
    setInputText(question);
  };

  const handleQuestionBankTap = async (question: string) => {
    setInputText(question);
    await handleSend(question);
  };

  const recomputeWithBackendAndRefresh = async () => {
    try {
      if (deviceId && profile) {
        await fetch(`${API_BASE_URL}/day/${deviceId}/recompute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile }),
        });
      }
    } catch (error) {
      console.warn('[Chat] Recompute endpoint unavailable, using local refresh', error);
    }

    await generatePlan(true);
    await generateFullDayPlan();
  };

  const handleAdvisorAction = async (actionId: string) => {
    if (actionId === 'OPEN_HELP') {
      navigation.navigate('HelpCenter');
      return;
    }

    if (actionId === 'OPEN_TOMORROW_PREVIEW') {
      navigation.navigate('MainTabs', { screen: 'Tomorrow' });
      return;
    }

    if (actionId === 'INSERT_WALK_10') {
      const now = new Date();
      await addTodayEntry({
        type: 'walk',
        title: '10min Walk',
        startISO: now.toISOString(),
        endISO: addMinutes(now, 10).toISOString(),
        isSystemAnchor: false,
        isFixedAnchor: false,
        fixed: false,
        source: 'advisor_added',
        status: 'planned',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: 'Advisor action insert',
      });
      await recomputeWithBackendAndRefresh();
    }
  };

  const handleAddToSchedule = async (message: Message) => {
    if (!message.response) return;

    const inserts = extractTimelineInserts(message.response);
    if (inserts.length === 0) return;

    const snapshot = [...todayEntries];
    setUndoSnapshot(snapshot);

    const insertedIds: string[] = [];
    for (const insert of inserts) {
      const id = await addTodayEntry(mapAdvisorInsertToScheduleItem(insert));
      insertedIds.push(id);
    }

    await recomputeWithBackendAndRefresh();
    setAddedInsertIds(insertedIds);
    setShowUndo(true);
    haptics.success();
    setTimeout(() => setShowUndo(false), 5000);
  };

  const handleUndoAdd = async () => {
    const dateISO = format(new Date(), 'yyyy-MM-dd');

    if (undoSnapshot) {
      usePlanStore.setState({ todayEntries: undoSnapshot });
      await AsyncStorage.setItem(`todayEntries_${dateISO}`, JSON.stringify(undoSnapshot));
      await generateFullDayPlan();
      await generatePlan(true);
    } else {
      for (const id of addedInsertIds) {
        await deleteTodayEntry(id);
      }
    }

    setAddedInsertIds([]);
    setUndoSnapshot(null);
    setShowUndo(false);
    haptics.light();
  };

  const quickQuestions = ADVISOR_STARTER_PROMPTS;

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <AppIcon name="brain" size={24} color={colors.accentPrimary} />
          <View style={{ marginLeft: spacing.sm, flex: 1 }}>
            <Text style={[typography.titleL, { color: colors.textPrimary }]}>AI Advisor</Text>
            <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 13 }]}>
              Decision Engine
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Help', { term: 'fasting window' })}>
            <AppIcon name="info" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.questionBankContainer, { borderBottomColor: colors.border }]}> 
        <Text style={[typography.bodyM, { color: colors.textSecondary, fontWeight: '600', marginBottom: spacing.xs }]}>Question Bank</Text>
        <TextInput
          style={[styles.bankSearchInput, { backgroundColor: colors.surfaceElevated, color: colors.textPrimary, borderColor: colors.borderSubtle }]}
          value={questionSearch}
          onChangeText={setQuestionSearch}
          placeholder="Search question bank..."
          placeholderTextColor={colors.textMuted}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {categories.map((category) => (
            <TouchableOpacity key={category} onPress={() => setSelectedCategory(category)}>
              <Chip variant={selectedCategory === category ? 'accent' : 'default'} style={{ marginRight: spacing.xs }}>
                {category}
              </Chip>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {filteredQuestionBank.map((question: any) => (
            <TouchableOpacity key={question.id} onPress={() => handleQuestionBankTap(question.title)}>
              <Chip style={{ marginRight: spacing.xs }}>
                {question.title}
              </Chip>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onAddToSchedule={() => handleAddToSchedule(message)}
            onAction={handleAdvisorAction}
          />
        ))}

        {isProcessing && (
          <View style={{ marginBottom: spacing.lg, alignItems: 'flex-start' }}>
            <Card style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
              <Text style={[typography.bodyM, { color: colors.textMuted }]}>
                Processing...
              </Text>
            </Card>
          </View>
        )}
      </ScrollView>

      {messages.length <= 1 && (
        <View style={[styles.quickQuestionsContainer, { borderTopColor: colors.border }]}>
          <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm }]}>
            Quick questions
          </Text>
          <View style={styles.quickQuestions}>
            {quickQuestions.map((q, i) => (
              <TouchableOpacity key={i} onPress={() => handleQuickQuestion(q)}>
                <Chip>
                  {q}
                </Chip>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderSubtle }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about meal timing, workouts, energy..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.sendButton,
            { 
              backgroundColor: inputText.trim() ? colors.accentPrimary : colors.surface,
              borderColor: colors.borderSubtle,
            }
          ]}
          onPress={() => {
            void handleSend();
          }}
          disabled={!inputText.trim()}
        >
          <AppIcon name="chevronUp" size={20} color={inputText.trim() ? colors.background : colors.textMuted} />
        </TouchableOpacity>
      </View>

      {showUndo && (
        <View style={[styles.undoSnackbar, { backgroundColor: colors.surfaceElevated, borderColor: colors.accentPrimary }]}> 
          <Text style={[typography.bodyM, { color: colors.textPrimary, flex: 1 }]}>Added to plan</Text>
          <TouchableOpacity onPress={handleUndoAdd}>
            <Text style={[typography.bodyM, { color: colors.accentPrimary, fontWeight: '600' }]}>Undo</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ 
  message, 
  onAddToSchedule,
  onAction,
}: { 
  message: Message; 
  onAddToSchedule: () => void;
  onAction: (actionId: string) => Promise<void> | void;
}) {
  const { colors, typography, spacing, radius } = useTheme();
  const isUser = message.type === 'user';
  const [showDetails, setShowDetails] = useState(true);

  if (isUser) {
    return (
      <View style={[styles.messageBubbleContainer, { alignItems: 'flex-end', marginBottom: spacing.md }]}>
        <View style={[
          styles.messageBubble,
          { 
            backgroundColor: colors.accentPrimary,
            borderRadius: radius.md,
            borderBottomRightRadius: 4,
            padding: spacing.md,
            maxWidth: '80%',
          }
        ]}>
          <Text style={[typography.bodyM, { color: colors.background }]}>
            {message.text}
          </Text>
        </View>
      </View>
    );
  }

  // Advisor message with structured response
  return (
    <View style={[styles.messageBubbleContainer, { marginBottom: spacing.lg }]}>
      <Card style={{ width: '100%' }}>
        {/* Direct Answer */}
        <Text style={[typography.bodyM, { color: colors.textPrimary, lineHeight: 22 }]}>
          {message.text}
        </Text>

        {message.response && (
          <>
            {/* Next Moves */}
            {message.response.nextMoves && message.response.nextMoves.length > 0 && showDetails && (
              <View style={{ marginTop: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                  <AppIcon name="clock" size={14} color={colors.textSecondary} />
                  <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4 }]}>
                    NEXT MOVES
                  </Text>
                </View>
                {message.response.nextMoves.map((move, i) => (
                  <View key={i} style={{ marginBottom: spacing.sm, flexDirection: 'row' }}>
                    <Text style={[typography.bodyM, { color: colors.accentPrimary, fontFamily: 'monospace', fontSize: 12, width: 60 }]}>
                      {move.time}
                    </Text>
                    <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 13, flex: 1 }]}>
                      {move.title}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* If/Then */}
            {message.response.ifThen && message.response.ifThen.length > 0 && showDetails && (
              <View style={{ marginTop: spacing.md }}>
                <Divider spacing="sm" />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm }}>
                  <AppIcon name="info" size={14} color={colors.textSecondary} />
                  <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4 }]}>
                    IF/THEN
                  </Text>
                </View>
                {message.response.ifThen.map((branch, i) => (
                  <View key={i} style={{ marginBottom: spacing.sm }}>
                    <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 12 }]}>
                      {branch.if}
                    </Text>
                    <Text style={[typography.bodyM, { color: colors.textPrimary, fontSize: 13, marginTop: 2 }]}>
                      → {branch.then}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Why */}
            {message.response.why && showDetails && (
              <View style={{ marginTop: spacing.md }}>
                <Divider spacing="sm" />
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm }}>
                  <AppIcon name="brain" size={14} color={colors.textSecondary} />
                  <Text style={[typography.bodyM, { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4 }]}>
                    WHY
                  </Text>
                </View>
                <Text style={[typography.bodyM, { color: colors.textMuted, fontSize: 13, lineHeight: 20 }]}>
                  {message.response.why}
                </Text>
              </View>
            )}

            {/* Add to Plan */}
            {hasTimelineSuggestion(message.response) ? (
              <View style={{ marginTop: spacing.md }}>
                <PrimaryButton
                  onPress={onAddToSchedule}
                  style={{ width: '100%' }}
                >
                  Add to Timeline
                </PrimaryButton>
              </View>
            ) : null}

            {message.response.actions && message.response.actions.filter((action) => action.id !== 'ADD_INSERTS_TO_PLAN').length > 0 ? (
              <View style={{ marginTop: spacing.sm }}>
                {message.response.actions
                  .filter((action) => action.id !== 'ADD_INSERTS_TO_PLAN')
                  .slice(0, 2)
                  .map((action) => (
                    <SecondaryButton key={action.id} onPress={() => void onAction(action.id)} style={{ marginTop: spacing.xs }}>
                      {action.label}
                    </SecondaryButton>
                  ))}
              </View>
            ) : null}
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  questionBankContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  bankSearchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    width: '100%',
  },
  messageBubble: {
    maxWidth: '80%',
  },
  quickQuestionsContainer: {
    padding: 16,
    borderTopWidth: 1,
  },
  quickQuestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
  },
  input: {
    fontSize: 15,
    padding: 12,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoSnackbar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
