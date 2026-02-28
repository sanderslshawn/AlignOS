import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '@physiology-engine/shared';

// Storage keys
const FRIENDS_KEY = '@friends';
const CHALLENGES_KEY = '@challenges';
const SOCIAL_FEED_KEY = '@social_feed';

// Friend types
export interface Friend {
  id: string;
  username: string;
  avatarUrl?: string;
  currentStreak: number;
  totalScore: number;
  weeklyScore: number;
  lastActive: Date;
  status: 'online' | 'offline';
}

// Challenge types
export type ChallengeType = 'streak' | 'score' | 'steps' | 'hydration' | 'sleep';
export type ChallengeStatus = 'active' | 'completed' | 'failed';

export interface Challenge {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  participants: string[]; // Friend IDs
  creatorId: string;
  startDate: Date;
  endDate: Date;
  status: ChallengeStatus;
  goal: number; // Target value (e.g., 7 days streak, 1000 points, 10000 steps)
  currentProgress: Record<string, number>; // userId -> current value
  winner?: string; // Friend ID
  reward: number; // Bonus achievement points
}

// Social feed item types
export type FeedItemType = 'achievement' | 'challenge_complete' | 'streak_milestone' | 'friend_joined';

export interface FeedItem {
  id: string;
  userId: string;
  username: string;
  type: FeedItemType;
  title: string;
  description: string;
  timestamp: Date;
  likes: string[]; // User IDs who liked
}

interface SocialState {
  // Friends
  friends: Friend[];
  pendingInvites: string[]; // Friend IDs with pending invites
  
  // Challenges
  activeChallenges: Challenge[];
  completedChallenges: Challenge[];
  
  // Social feed
  feed: FeedItem[];
  
  // Actions - Friends
  addFriend: (friend: Friend) => void;
  removeFriend: (friendId: string) => void;
  updateFriendProgress: (friendId: string, updates: Partial<Friend>) => void;
  sendInvite: (friendId: string) => void;
  acceptInvite: (friendId: string) => void;
  
  // Actions - Challenges
  createChallenge: (challenge: Omit<Challenge, 'id' | 'status' | 'currentProgress' | 'creatorId'>) => void;
  joinChallenge: (challengeId: string, userId: string) => void;
  updateChallengeProgress: (challengeId: string, userId: string, progress: number) => void;
  completeChallenge: (challengeId: string, winnerId: string) => void;
  
  // Actions - Feed
  addFeedItem: (item: Omit<FeedItem, 'id' | 'timestamp' | 'likes'>) => void;
  likeFeedItem: (itemId: string, userId: string) => void;
  
  // Persistence
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  // Initial state
  friends: [],
  pendingInvites: [],
  activeChallenges: [],
  completedChallenges: [],
  feed: [],
  
  // Friend actions
  addFriend: (friend) => {
    set((state) => ({
      friends: [...state.friends, friend],
    }));
    get().saveToStorage();
  },
  
  removeFriend: (friendId) => {
    set((state) => ({
      friends: state.friends.filter(f => f.id !== friendId),
    }));
    get().saveToStorage();
  },
  
  updateFriendProgress: (friendId, updates) => {
    set((state) => ({
      friends: state.friends.map(f =>
        f.id === friendId ? { ...f, ...updates } : f
      ),
    }));
    get().saveToStorage();
  },
  
  sendInvite: (friendId) => {
    set((state) => ({
      pendingInvites: [...state.pendingInvites, friendId],
    }));
    get().saveToStorage();
  },
  
  acceptInvite: (friendId) => {
    set((state) => ({
      pendingInvites: state.pendingInvites.filter(id => id !== friendId),
    }));
    
    // Add feed item
    get().addFeedItem({
      userId: friendId,
      username: 'Friend', // Would come from backend in real app
      type: 'friend_joined',
      title: 'New Friend!',
      description: 'You are now connected',
    });
    
    get().saveToStorage();
  },
  
  // Challenge actions
  createChallenge: (challengeData) => {
    const newChallenge: Challenge = {
      ...challengeData,
      id: `challenge_${Date.now()}`,
      status: 'active',
      currentProgress: {},
      creatorId: 'current_user', // Would come from auth in real app
    };
    
    set((state) => ({
      activeChallenges: [...state.activeChallenges, newChallenge],
    }));
    
    // Add feed item
    get().addFeedItem({
      userId: 'current_user',
      username: 'You',
      type: 'challenge_complete',
      title: `New Challenge: ${challengeData.title}`,
      description: challengeData.description,
    });
    
    get().saveToStorage();
  },
  
  joinChallenge: (challengeId, userId) => {
    set((state) => ({
      activeChallenges: state.activeChallenges.map(c =>
        c.id === challengeId
          ? {
              ...c,
              participants: [...c.participants, userId],
              currentProgress: { ...c.currentProgress, [userId]: 0 },
            }
          : c
      ),
    }));
    get().saveToStorage();
  },
  
  updateChallengeProgress: (challengeId, userId, progress) => {
    set((state) => ({
      activeChallenges: state.activeChallenges.map(c =>
        c.id === challengeId
          ? {
              ...c,
              currentProgress: { ...c.currentProgress, [userId]: progress },
            }
          : c
      ),
    }));
    
    // Check if challenge is complete
    const challenge = get().activeChallenges.find(c => c.id === challengeId);
    if (challenge && progress >= challenge.goal) {
      get().completeChallenge(challengeId, userId);
    }
    
    get().saveToStorage();
  },
  
  completeChallenge: (challengeId, winnerId) => {
    let completedChallenge: Challenge | undefined;
    
    set((state) => {
      const challenge = state.activeChallenges.find(c => c.id === challengeId);
      if (!challenge) return state;
      
      completedChallenge = {
        ...challenge,
        status: 'completed',
        winner: winnerId,
      };
      
      return {
        activeChallenges: state.activeChallenges.filter(c => c.id !== challengeId),
        completedChallenges: [...state.completedChallenges, completedChallenge as Challenge],
      };
    });
    
    // Add feed item for winner
    if (completedChallenge) {
      get().addFeedItem({
        userId: winnerId,
        username: winnerId === 'current_user' ? 'You' : 'Friend',
        type: 'challenge_complete',
        title: `🏆 Challenge Won!`,
        description: `Completed ${completedChallenge.title}`,
      });
    }
    
    get().saveToStorage();
  },
  
  // Feed actions
  addFeedItem: (itemData) => {
    const newItem: FeedItem = {
      ...itemData,
      id: `feed_${Date.now()}`,
      timestamp: new Date(),
      likes: [],
    };
    
    set((state) => ({
      feed: [newItem, ...state.feed].slice(0, 50), // Keep last 50 items
    }));
    get().saveToStorage();
  },
  
  likeFeedItem: (itemId, userId) => {
    set((state) => ({
      feed: state.feed.map(item =>
        item.id === itemId
          ? {
              ...item,
              likes: item.likes.includes(userId)
                ? item.likes.filter(id => id !== userId) // Unlike
                : [...item.likes, userId], // Like
            }
          : item
      ),
    }));
    get().saveToStorage();
  },
  
  // Persistence
  loadFromStorage: async () => {
    try {
      const [friendsData, challengesData, feedData] = await Promise.all([
        AsyncStorage.getItem(FRIENDS_KEY),
        AsyncStorage.getItem(CHALLENGES_KEY),
        AsyncStorage.getItem(SOCIAL_FEED_KEY),
      ]);
      
      if (friendsData) {
        const friends = JSON.parse(friendsData);
        set({ friends });
      }
      
      if (challengesData) {
        const { active, completed } = JSON.parse(challengesData);
        set({
          activeChallenges: active,
          completedChallenges: completed,
        });
      }
      
      if (feedData) {
        const feed = JSON.parse(feedData);
        set({ feed });
      }
    } catch (error) {
      console.error('Failed to load social data:', error);
    }
  },
  
  saveToStorage: async () => {
    try {
      const state = get();
      
      await Promise.all([
        AsyncStorage.setItem(FRIENDS_KEY, JSON.stringify(state.friends)),
        AsyncStorage.setItem(
          CHALLENGES_KEY,
          JSON.stringify({
            active: state.activeChallenges,
            completed: state.completedChallenges,
          })
        ),
        AsyncStorage.setItem(SOCIAL_FEED_KEY, JSON.stringify(state.feed)),
      ]);
    } catch (error) {
      console.error('Failed to save social data:', error);
    }
  },
}));
