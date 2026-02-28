import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSocialStore, Friend, Challenge, FeedItem } from '../store/socialStore';
import { haptics } from '../utils/haptics';

type TabType = 'friends' | 'challenges' | 'feed';

export default function SocialScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  
  const {
    friends,
    activeChallenges,
    completedChallenges,
    feed,
    addFriend,
    createChallenge,
    updateChallengeProgress,
    likeFeedItem,
  } = useSocialStore();
  
  const handleTabChange = (tab: TabType) => {
    haptics.light();
    setActiveTab(tab);
  };
  
  // Friends Tab
  const renderFriendsTab = () => {
    const sortedFriends = [...friends].sort((a, b) => b.weeklyScore - a.weeklyScore);
    
    return (
      <View style={styles.tabContent}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            haptics.light();
            setShowAddFriend(true);
          }}
        >
          <LinearGradient
            colors={['#00ff88', '#14967F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Text style={styles.addButtonText}>➕ Add Friend</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        {sortedFriends.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>👥</Text>
            <Text style={styles.emptyStateText}>No friends yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Add friends to compete on challenges and see their progress
            </Text>
          </View>
        ) : (
          <View style={styles.leaderboard}>
            <Text style={styles.sectionTitle}>🏆 Weekly Leaderboard</Text>
            {sortedFriends.map((friend, index) => (
              <FriendCard key={friend.id} friend={friend} rank={index + 1} />
            ))}
          </View>
        )}
      </View>
    );
  };
  
  // Challenges Tab
  const renderChallengesTab = () => {
    return (
      <View style={styles.tabContent}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            haptics.light();
            setShowCreateChallenge(true);
          }}
        >
          <LinearGradient
            colors={['#00ff88', '#14967F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.addButtonGradient}
          >
            <Text style={styles.addButtonText}>🎯 Create Challenge</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        {activeChallenges.length === 0 && completedChallenges.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>🎯</Text>
            <Text style={styles.emptyStateText}>No challenges yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create challenges to compete with friends on streaks, scores, and more
            </Text>
          </View>
        ) : (
          <>
            {activeChallenges.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚡ Active Challenges</Text>
                {activeChallenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    friends={friends}
                    onUpdateProgress={updateChallengeProgress}
                  />
                ))}
              </View>
            )}
            
            {completedChallenges.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✅ Completed</Text>
                {completedChallenges.slice(0, 5).map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    friends={friends}
                    onUpdateProgress={updateChallengeProgress}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    );
  };
  
  // Feed Tab
  const renderFeedTab = () => {
    return (
      <View style={styles.tabContent}>
        {feed.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📰</Text>
            <Text style={styles.emptyStateText}>No activity yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Your social feed will show friend achievements and challenge updates
            </Text>
          </View>
        ) : (
          feed.map((item) => (
            <FeedItemCard
              key={item.id}
              item={item}
              onLike={() => {
                haptics.light();
                likeFeedItem(item.id, 'current_user');
              }}
            />
          ))
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feed' && styles.activeTab]}
          onPress={() => handleTabChange('feed')}
        >
          <Text style={[styles.tabText, activeTab === 'feed' && styles.activeTabText]}>
            Feed
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
          onPress={() => handleTabChange('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
            Friends
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'challenges' && styles.activeTab]}
          onPress={() => handleTabChange('challenges')}
        >
          <Text style={[styles.tabText, activeTab === 'challenges' && styles.activeTabText]}>
            Challenges
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Tab Content */}
      <ScrollView style={styles.scrollView}>
        {activeTab === 'feed' && renderFeedTab()}
        {activeTab === 'friends' && renderFriendsTab()}
        {activeTab === 'challenges' && renderChallengesTab()}
      </ScrollView>
      
      {/* Create Challenge Modal */}
      <CreateChallengeModal
        visible={showCreateChallenge}
        onClose={() => setShowCreateChallenge(false)}
        onSubmit={createChallenge}
        friends={friends}
      />
      
      {/* Add Friend Modal */}
      <AddFriendModal
        visible={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onSubmit={addFriend}
      />
    </View>
  );
}

// Friend Card Component
function FriendCard({ friend, rank }: { friend: Friend; rank: number }) {
  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };
  
  return (
    <View style={styles.friendCard}>
      <View style={styles.friendRank}>
        <Text style={styles.friendRankText}>{getRankEmoji(rank)}</Text>
      </View>
      
      <View style={styles.friendInfo}>
        <View style={styles.friendHeader}>
          <Text style={styles.friendName}>{friend.username}</Text>
          <View style={[styles.statusDot, friend.status === 'online' && styles.onlineStatus]} />
        </View>
        
        <View style={styles.friendStats}>
          <Text style={styles.friendStat}>🔥 {friend.currentStreak} day streak</Text>
          <Text style={styles.friendStat}>⭐ {friend.weeklyScore} pts</Text>
        </View>
      </View>
    </View>
  );
}

// Challenge Card Component
function ChallengeCard({
  challenge,
  friends,
  onUpdateProgress,
}: {
  challenge: Challenge;
  friends: Friend[];
  onUpdateProgress: (challengeId: string, userId: string, progress: number) => void;
}) {
  const isCompleted = challenge.status === 'completed';
  const myProgress = challenge.currentProgress['current_user'] || 0;
  const progressPercent = Math.min((myProgress / challenge.goal) * 100, 100);
  
  const getChallengeIcon = (type: string) => {
    switch (type) {
      case 'streak': return '🔥';
      case 'score': return '⭐';
      case 'steps': return '👟';
      case 'hydration': return '💧';
      case 'sleep': return '😴';
      default: return '🎯';
    }
  };
  
  return (
    <View style={[styles.challengeCard, isCompleted && styles.completedChallenge]}>
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeIcon}>{getChallengeIcon(challenge.type)}</Text>
        <View style={styles.challengeInfo}>
          <Text style={styles.challengeTitle}>{challenge.title}</Text>
          <Text style={styles.challengeDescription}>{challenge.description}</Text>
        </View>
      </View>
      
      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={isCompleted ? ['#FFD700', '#FFA500'] : ['#00ff88', '#14967F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progressPercent}%` }]}
          />
        </View>
        <Text style={styles.progressText}>
          {myProgress} / {challenge.goal}
        </Text>
      </View>
      
      {/* Participants */}
      <View style={styles.participants}>
        <Text style={styles.participantsLabel}>Participants:</Text>
        {challenge.participants.map((participantId) => {
          const progress = challenge.currentProgress[participantId] || 0;
          const participant = friends.find(f => f.id === participantId);
          const name = participantId === 'current_user' ? 'You' : participant?.username || 'Unknown';
          
          return (
            <View key={participantId} style={styles.participantRow}>
              <Text style={styles.participantName}>{name}</Text>
              <Text style={styles.participantProgress}>{progress}</Text>
            </View>
          );
        })}
      </View>
      
      {isCompleted && challenge.winner && (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>
            🏆 Winner: {challenge.winner === 'current_user' ? 'You!' : friends.find(f => f.id === challenge.winner)?.username}
          </Text>
        </View>
      )}
    </View>
  );
}

// Feed Item Card Component
function FeedItemCard({ item, onLike }: { item: FeedItem; onLike: () => void }) {
  const isLiked = item.likes.includes('current_user');
  
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'achievement': return '🏆';
      case 'challenge_complete': return '🎯';
      case 'streak_milestone': return '🔥';
      case 'friend_joined': return '👋';
      default: return '📰';
    }
  };
  
  return (
    <View style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <Text style={styles.feedIcon}>{getItemIcon(item.type)}</Text>
        <View style={styles.feedInfo}>
          <Text style={styles.feedUsername}>{item.username}</Text>
          <Text style={styles.feedTimestamp}>
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.feedTitle}>{item.title}</Text>
      <Text style={styles.feedDescription}>{item.description}</Text>
      
      <TouchableOpacity style={styles.likeButton} onPress={onLike}>
        <Text style={styles.likeIcon}>{isLiked ? '❤️' : '🤍'}</Text>
        <Text style={styles.likeCount}>{item.likes.length}</Text>
      </TouchableOpacity>
    </View>
  );
}

// Create Challenge Modal
function CreateChallengeModal({
  visible,
  onClose,
  onSubmit,
  friends,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (challenge: any) => void;
  friends: Friend[];
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<Challenge['type']>('streak');
  const [goal, setGoal] = useState('7');
  const [duration, setDuration] = useState('7');
  
  const handleSubmit = () => {
    if (!title.trim()) return;
    
    haptics.medium();
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + parseInt(duration));
    
    onSubmit({
      type,
      title,
      description: `Reach ${goal} ${type} within ${duration} days`,
      participants: ['current_user'], // Start with current user
      startDate: new Date(),
      endDate,
      goal: parseInt(goal),
      reward: parseInt(duration) * 10, // 10 points per day
    });
    
    setTitle('');
    setGoal('7');
    setDuration('7');
    onClose();
  };
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Create Challenge</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Challenge Title"
            placeholderTextColor="#666"
            value={title}
            onChangeText={setTitle}
          />
          
          <View style={styles.typeSelector}>
            {(['streak', 'score', 'steps', 'hydration', 'sleep'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeButton, type === t && styles.selectedType]}
                onPress={() => {
                  haptics.light();
                  setType(t);
                }}
              >
                <Text style={[styles.typeButtonText, type === t && styles.selectedTypeText]}>
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TextInput
            style={styles.input}
            placeholder="Goal (e.g., 7 for 7-day streak)"
            placeholderTextColor="#666"
            value={goal}
            onChangeText={setGoal}
            keyboardType="numeric"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Duration (days)"
            placeholderTextColor="#666"
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <LinearGradient
                colors={['#00ff88', '#14967F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>Create</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Add Friend Modal
function AddFriendModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (friend: Friend) => void;
}) {
  const [username, setUsername] = useState('');
  
  const handleSubmit = () => {
    if (!username.trim()) return;
    
    haptics.medium();
    
    // In a real app, this would search for the user by username
    onSubmit({
      id: `friend_${Date.now()}`,
      username: username.trim(),
      currentStreak: 0,
      totalScore: 0,
      weeklyScore: 0,
      lastActive: new Date(),
      status: 'offline',
    });
    
    setUsername('');
    onClose();
  };
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Friend</Text>
          
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
              <LinearGradient
                colors={['#00ff88', '#14967F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                <Text style={styles.submitButtonText}>Add</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00ff88',
  },
  tabText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#00ff88',
  },
  scrollView: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  addButton: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  leaderboard: {
    marginBottom: 16,
  },
  friendCard: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  friendRank: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendRankText: {
    fontSize: 24,
  },
  friendInfo: {
    flex: 1,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  friendName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
  },
  onlineStatus: {
    backgroundColor: '#00ff88',
  },
  friendStats: {
    flexDirection: 'row',
    gap: 16,
  },
  friendStat: {
    color: '#888',
    fontSize: 14,
  },
  challengeCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  completedChallenge: {
    borderColor: '#FFD700',
    opacity: 0.8,
  },
  challengeHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  challengeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  challengeDescription: {
    color: '#888',
    fontSize: 14,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#222',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
  },
  participants: {
    marginTop: 8,
  },
  participantsLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  participantName: {
    color: '#fff',
    fontSize: 14,
  },
  participantProgress: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '700',
  },
  winnerBanner: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  winnerText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
  feedCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  feedHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  feedIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  feedInfo: {
    flex: 1,
  },
  feedUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  feedTimestamp: {
    color: '#666',
    fontSize: 12,
  },
  feedTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  feedDescription: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  likeIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  likeCount: {
    color: '#888',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedType: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  typeButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedTypeText: {
    color: '#000',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonGradient: {
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
