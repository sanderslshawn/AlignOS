/**
 * AI Chat Screen
 * Natural language interface for physiology advice
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
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useChatStore } from '../store/chatStore';
import { usePlanStore } from '../store/planStore';
import { haptics } from '../utils/haptics';
import { format } from 'date-fns';

export default function ChatScreen({ navigation }: any) {
  const { messages, isTyping, sendMessage, initialize, getQuickTip, markPlanUpdateApplied } = useChatStore();
  const { profile, fullDayPlan, addTodayEntry } = usePlanStore();
  
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const typingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    // Animate typing indicator
    if (isTyping) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(typingAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      typingAnim.setValue(0);
    }
  }, [isTyping]);

  const handleSend = async () => {
    if (!inputText.trim() || !profile) return;
    
    haptics.light();
    const text = inputText.trim();
    setInputText('');
    
    await sendMessage(text, profile, fullDayPlan || undefined);
    
    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleQuickQuestion = async (question: string) => {
    haptics.light();
    setInputText(question);
  };

  const handleAddToSchedule = (message: any) => {
    if (message.advice?.suggestedActivity) {
      haptics.success();
      addTodayEntry(message.advice.suggestedActivity);
      // Show confirmation somehow - could add a toast
    }
  };

  const handleApplyPlanUpdate = (message: any) => {
    if (message.advice?.suggestedPlanUpdate) {
      haptics.success();
      const update = message.advice.suggestedPlanUpdate;
      
      if (update.action === 'add' && update.newItem) {
        addTodayEntry(update.newItem);
      }
      // TODO: Handle 'modify' and 'remove' actions when implemented
      
      markPlanUpdateApplied(message.id);
    }
  };

  const quickQuestions = [
    "When should I eat BBQ chicken?",
    "Best time for strength training?",
    "When's the optimal breakfast time?",
    "Should I workout in the morning?",
  ];

  const quickTip = profile ? getQuickTip(profile) : '';

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <LinearGradient
        colors={['#0a0a0a', '#000000']}
        style={styles.gradient}
      >
        {/* Header with Quick Tip */}
        {quickTip && (
          <View style={styles.quickTipContainer}>
            <LinearGradient
              colors={['#14967F', '#0a7a5a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.quickTipGradient}
            >
              <Text style={styles.quickTipLabel}>💡 Quick Tip</Text>
              <Text style={styles.quickTipText}>{quickTip}</Text>
            </LinearGradient>
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🧬</Text>
              <Text style={styles.emptyTitle}>Your AI Physiology Advisor</Text>
              <Text style={styles.emptyText}>
                Ask me anything about meal timing, workout scheduling, or energy optimization
              </Text>
            </View>
          )}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onAddToSchedule={() => handleAddToSchedule(message)}
              onApplyPlanUpdate={() => handleApplyPlanUpdate(message)}
            />
          ))}

          {isTyping && (
            <View style={styles.typingContainer}>
              <View style={styles.typingBubble}>
                <Animated.View style={[
                  styles.typingDot,
                  { opacity: typingAnim }
                ]} />
                <Animated.View style={[
                  styles.typingDot,
                  { opacity: typingAnim, marginLeft: 4 }
                ]} />
                <Animated.View style={[
                  styles.typingDot,
                  { opacity: typingAnim, marginLeft: 4 }
                ]} />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Quick Questions */}
        {messages.length <= 1 && (
          <View style={styles.quickQuestionsContainer}>
            <Text style={styles.quickQuestionsLabel}>Quick Questions:</Text>
            <View style={styles.quickQuestions}>
              {quickQuestions.map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.quickQuestionButton}
                  onPress={() => handleQuickQuestion(q)}
                >
                  <Text style={styles.quickQuestionText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about meal timing, workouts, energy..."
            placeholderTextColor="#666"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={inputText.trim() ? ['#00ff88', '#14967F'] : ['#333', '#222']}
              style={styles.sendButtonGradient}
            >
              <Text style={styles.sendButtonText}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ 
  message, 
  onAddToSchedule,
  onApplyPlanUpdate 
}: { 
  message: any; 
  onAddToSchedule: () => void;
  onApplyPlanUpdate: () => void;
}) {
  const isUser = message.type === 'user';
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.messageBubbleContainer, isUser && styles.messageBubbleContainerUser]}>
      <View style={[styles.messageBubble, isUser && styles.messageBubbleUser]}>
        <Text style={[styles.messageText, isUser && styles.messageTextUser]}>
          {message.text}
        </Text>
        
        {/* AI message extras */}
        {!isUser && message.advice && (
          <View style={styles.adviceExtras}>
            {/* Plan Update Button */}
            {message.advice.suggestedPlanUpdate && !message.planUpdateApplied && (
              <View style={styles.planUpdateSection}>
                <Text style={styles.planUpdatePrompt}>
                  Would you like me to add this to your schedule?
                </Text>
                <TouchableOpacity
                  style={styles.updatePlanButton}
                  onPress={() => {
                    haptics.success();
                    onApplyPlanUpdate();
                  }}
                >
                  <LinearGradient
                    colors={['#00ff88', '#14967F']}
                    style={styles.updatePlanGradient}
                  >
                    <Text style={styles.updatePlanText}>✓ Add to Schedule</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
            
            {message.planUpdateApplied && (
              <View style={styles.appliedBadge}>
                <Text style={styles.appliedBadgeText}>✓ Added to Schedule</Text>
              </View>
            )}
            
            {/* Reasoning toggle */}
            {message.advice.reasoning && message.advice.reasoning.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.detailsButton}
                  onPress={() => {
                    haptics.light();
                    setExpanded(!expanded);
                  }}
                >
                  <Text style={styles.detailsButtonText}>
                    {expanded ? '▼ Hide Details' : '▶ Show Reasoning'}
                  </Text>
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.reasoningContainer}>
                    {message.advice.reasoning.map((r: string, i: number) => (
                      <Text key={i} style={styles.reasoningText}>{r}</Text>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Add to schedule button */}
            {message.advice.suggestedActivity && (
              <TouchableOpacity
                style={styles.addToScheduleButton}
                onPress={() => {
                  haptics.success();
                  onAddToSchedule();
                }}
              >
                <LinearGradient
                  colors={['#00ff88', '#14967F']}
                  style={styles.addToScheduleGradient}
                >
                  <Text style={styles.addToScheduleText}>+ Add to Schedule</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* References */}
            {message.advice.references && message.advice.references.length > 0 && expanded && (
              <View style={styles.referencesContainer}>
                <Text style={styles.referencesLabel}>📚 References:</Text>
                {message.advice.references.map((ref: string, i: number) => (
                  <Text key={i} style={styles.referenceText}>• {ref}</Text>
                ))}
              </View>
            )}
          </View>
        )}
        
        <Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>
          {format(message.timestamp, 'h:mm a')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  quickTipContainer: {
    padding: 16,
    paddingTop: 8,
  },
  quickTipGradient: {
    padding: 12,
    borderRadius: 12,
  },
  quickTipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    opacity: 0.9,
    marginBottom: 4,
  },
  quickTipText: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00ff88',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  messageBubbleContainer: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  messageBubbleContainerUser: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  messageBubbleUser: {
    backgroundColor: '#14967F',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: '#666',
    marginTop: 6,
  },
  messageTimeUser: {
    color: '#d0f0e0',
    textAlign: 'right',
  },
  adviceExtras: {
    marginTop: 12,
    gap: 8,
  },
  detailsButton: {
    paddingVertical: 6,
  },
  detailsButtonText: {
    fontSize: 13,
    color: '#00ff88',
    fontWeight: '600',
  },
  reasoningContainer: {
    backgroundColor: 'rgba(0, 255, 136, 0.05)',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00ff88',
    gap: 8,
  },
  reasoningText: {
    fontSize: 13,
    color: '#ccc',
    lineHeight: 20,
  },
  addToScheduleButton: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  addToScheduleGradient: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  addToScheduleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  planUpdateSection: {
    marginTop: 12,
  },
  planUpdatePrompt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  updatePlanButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  updatePlanGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  updatePlanText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
  appliedBadge: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  appliedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00ff88',
    textAlign: 'center',
  },
  referencesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  referencesLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  referenceText: {
    fontSize: 11,
    color: '#666',
    lineHeight: 16,
  },
  typingContainer: {
    marginBottom: 16,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 12,
    borderRadius: 16,
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff88',
  },
  quickQuestionsContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  quickQuestionsLabel: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  quickQuestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickQuestionButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  quickQuestionText: {
    fontSize: 13,
    color: '#00ff88',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    color: '#fff',
    fontSize: 15,
    padding: 12,
    borderRadius: 20,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
  },
});
