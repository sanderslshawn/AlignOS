/**
 * AI Chat Store
 * Manages conversations with the physiology AI advisor
 * Enhanced with biometric data integration
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyzeQuery, getQuickSuggestion, type AIAdvice } from '../utils/physiologyAI';
import { useBiometricStore } from './biometricStore';
import type { UserProfile, DayPlan } from '@physiology-engine/shared';

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  text: string;
  timestamp: Date;
  advice?: AIAdvice;
  planUpdateApplied?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  isTyping: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  sendMessage: (text: string, profile: UserProfile, currentPlan?: DayPlan) => Promise<void>;
  clearHistory: () => Promise<void>;
  getQuickTip: (profile: UserProfile) => string;
  markPlanUpdateApplied: (messageId: string) => void;
}

const STORAGE_KEY = '@chat_history';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isTyping: false,

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          messages: data.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        });
      } else {
        // Add welcome message
        set({
          messages: [{
            id: generateId(),
            type: 'ai',
            text: '👋 Hi! I\'m your **Physiology AI Advisor**. I can help you optimize meal timing, workout scheduling, and energy management based on science.\n\nTry asking:\n• "When should I eat BBQ chicken?"\n• "Best time to workout?"\n• "Why am I tired at 3pm?"',
            timestamp: new Date(),
          }],
        });
      }
    } catch (error) {
      console.error('[ChatStore] Failed to initialize:', error);
    }
  },

  sendMessage: async (text: string, profile: UserProfile, currentPlan?: DayPlan) => {
    const state = get();
    
    // Add user message
    const userMessage: ChatMessage = {
      id: generateId(),
      type: 'user',
      text,
      timestamp: new Date(),
    };
    
    set({ 
      messages: [...state.messages, userMessage],
      isTyping: true,
    });

    // Simulate thinking delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));

    // Get latest biometric data for context-aware advice
    const biometricStore = useBiometricStore.getState();
    const latestRecovery = biometricStore.recoveryScores[0];

    // Get AI response (now async with new AI Advisor)
    const advice = await analyzeQuery({
      query: text,
      profile,
      currentPlan,
      currentTime: new Date(),
      recoveryScore: latestRecovery, // Include biometric context
    });

    // Format AI response
    let aiResponse = advice.answer;
    
    if (advice.suggestedTime) {
      aiResponse += `\n\n📅 **Suggested Time**: ${advice.suggestedTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })}`;
    }

    if (advice.confidence === 'high') {
      aiResponse += '\n\n💯 **High confidence** - backed by research';
    } else if (advice.confidence === 'medium') {
      aiResponse += '\n\n⚠️ **Medium confidence** - consider individual factors';
    }

    // Add plan update prompt if available - make it conversational like Copilot
    if (advice.suggestedPlanUpdate) {
      aiResponse += `\n\n✨ ${advice.suggestedPlanUpdate.reason}.`;
    }

    const aiMessage: ChatMessage = {
      id: generateId(),
      type: 'ai',
      text: aiResponse,
      timestamp: new Date(),
      advice,
    };

    const newMessages = [...state.messages, userMessage, aiMessage];

    set({ 
      messages: newMessages,
      isTyping: false,
    });

    // Save to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        messages: newMessages.slice(-50), // Keep last 50 messages
      }));
    } catch (error) {
      console.error('[ChatStore] Failed to save:', error);
    }
  },

  clearHistory: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({ messages: [] });
    } catch (error) {
      console.error('[ChatStore] Failed to clear:', error);
    }
  },

  getQuickTip: (profile: UserProfile) => {
    return getQuickSuggestion(profile, new Date());
  },

  markPlanUpdateApplied: (messageId: string) => {
    const state = get();
    const updatedMessages = state.messages.map(msg => 
      msg.id === messageId ? { ...msg, planUpdateApplied: true } : msg
    );
    set({ messages: updatedMessages });
    
    // Save to storage
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      messages: updatedMessages.slice(-50),
    })).catch(error => console.error('[ChatStore] Failed to save:', error));
  },
}));
