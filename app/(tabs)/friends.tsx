import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/buton';
import { useAuth } from '../../contexts/AuthContext';
import '../../global.css';
import { friendService } from '../../services/api';

type SuggestedFriend = {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  isAdded: boolean;
  isPending: boolean;
};

export default function FriendScreen() {
  const { user } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestedFriends, setSuggestedFriends] = useState<SuggestedFriend[]>([]);
  const [searchResults, setSearchResults] = useState<SuggestedFriend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [existingFriends, setExistingFriends] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);

  // Load suggested friends from profiles
  useEffect(() => {
    const loadSuggestedFriends = async () => {
      if (!user) {
        console.log('❌ No user found in loadSuggestedFriends');
        return;
      }
      
      console.log('👤 Loading suggested friends for user:', user.id);
      setLoading(true);
      try {
        // Load existing friends
        const { data: friends, error: friendsError } = await friendService.getFriends(user.id);
        if (friendsError) throw friendsError;

        // Load outgoing friend requests
        const { data: outgoingRequests, error: requestsError } = await friendService.getOutgoingFriendRequests(user.id);
        if (requestsError) throw requestsError;

        const friendIds = (friends || []).map((f: any) => f.profiles?.id || f.friend_id);
        const pendingIds = (outgoingRequests || []).map((r: any) => r.profiles?.id || r.friend_id);
        
        console.log('🔍 Friends data:', { friends, friendIds, pendingIds });
        
        setExistingFriends(friendIds);
        setPendingRequests(pendingIds);

        // Load suggested users (non-friends)
        const { data: suggestions, error: searchError } = await friendService.searchUsers(user.id, '');
        if (searchError) throw searchError;

        const suggestedUsers = (suggestions || []).map((profile: any) => ({
          id: profile.id,
          name: profile.full_name || profile.email || 'Kullanıcı',
          email: profile.email,
          phone: profile.phone || '-',
          avatar: '👤',
          isAdded: friendIds.includes(profile.id), // Arkadaş durumunu kontrol et
          isPending: pendingIds.includes(profile.id)
        }));

        console.log('🔍 Suggested users mapped:', suggestedUsers);
        setSuggestedFriends(suggestedUsers);
      } catch (error) {
        console.error('Error loading suggested friends:', error);
        Alert.alert('Hata', 'Arkadaş önerileri yüklenirken hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    loadSuggestedFriends();
  }, [user]);

  // Search profiles in real-time
  useEffect(() => {
    const searchProfiles = async () => {
      if (!searchQuery.trim() || !user) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        // Use the new searchUsers function that includes all users with friendship status
        const { data: profiles, error } = await friendService.searchUsers(user.id, searchQuery);
        if (error) throw error;

        const results = (profiles || []).map((profile: any) => ({
          id: profile.id,
          name: profile.full_name || profile.email || 'Kullanıcı',
          email: profile.email,
          phone: profile.phone || '-',
          avatar: '👤',
          isAdded: profile.isFriend || false, // Arkadaş durumu
          isPending: profile.isPending || false // Bekleyen istek durumu
        }));

        setSearchResults(results);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    const timeoutId = setTimeout(searchProfiles, 300); // Debounce search
    return () => clearTimeout(timeoutId);
  }, [searchQuery, user]);

  // Show search results if searching, otherwise show suggested friends
  const filteredFriends = searchQuery.trim() ? searchResults : suggestedFriends;

  const handleAddFriend = async (friendId: string) => {
    console.log('🔍 handleAddFriend called with friendId:', friendId);
    console.log('🔍 Current user:', user?.id);
    
    if (!user) {
      console.log('❌ No user found, returning early');
      return;
    }

    try {
      console.log('📤 Sending friend request...');
      const { error } = await friendService.sendFriendRequest(user.id, friendId);
      
      if (error) {
        console.log('❌ Friend request error:', error);
        throw error;
      }

      console.log('✅ Friend request sent successfully');
      
      // Başarılı mesajı göster
      Alert.alert('Başarılı', 'Arkadaşlık isteği gönderildi!');
      
      // Update local state to show as pending
      setSuggestedFriends(prev => 
        prev.map(friend => 
          friend.id === friendId 
            ? { ...friend, isPending: true }
            : friend
        )
      );
      
      // Update search results if currently searching
      if (searchQuery.trim()) {
        setSearchResults(prev => 
          prev.map(friend => 
            friend.id === friendId 
              ? { ...friend, isPending: true }
              : friend
          )
        );
      }
      
      // Add to pending requests
      setPendingRequests(prev => [...prev, friendId]);
    } catch (error: any) {
      console.error('❌ Add friend error:', error);
      Alert.alert('Hata', error.message || 'Arkadaşlık isteği gönderilirken hata oluştu');
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user) return;

    Alert.alert(
      'Arkadaşlıktan Çıkar',
      'Bu kişiyi arkadaşlıktan çıkarmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Çıkar', 
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await friendService.removeFriend(user.id, friendId);
              if (error) throw error;

              Alert.alert('Başarılı', 'Arkadaşlıktan çıkarıldı');
              
              // Update local state to show as not added and not pending
              setSuggestedFriends(prev => 
                prev.map(friend => 
                  friend.id === friendId 
                    ? { ...friend, isAdded: false, isPending: false }
                    : friend
                )
              );
              
              // Update search results if currently searching
              if (searchQuery.trim()) {
                setSearchResults(prev => 
                  prev.map(friend => 
                    friend.id === friendId 
                      ? { ...friend, isAdded: false, isPending: false }
                      : friend
                  )
                );
              }
              
              // Remove from pending requests
              setPendingRequests(prev => prev.filter(id => id !== friendId));
            } catch (error: any) {
              Alert.alert('Hata', error.message || 'Arkadaşlık kaldırılırken hata oluştu');
              console.error('Remove friend error:', error);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Arkadaşlar</Text>
        </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Search Section */}
        <View style={styles.searchSection}>
          <Text style={styles.searchTitle}>Arkadaş Ara</Text>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="İsim veya e-posta ile ara..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.searchClearButton}>×</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Suggested Friends Section */}
        <View style={styles.friendsSection}>
          <View style={styles.friendsSectionHeader}>
            <Text style={styles.friendsSectionTitle}>
              {searchQuery ? `Arama Sonuçları (${filteredFriends.length})` : 'Önerilen Arkadaşlar'}
            </Text>
            {!searchQuery && (
              <Button
                title="Davet Et"
                backgroundColor="bg-gray-900"
                textColor="text-white"
                size="small"
                shape="rounded"
                onPress={() => console.log('Invite friends')}
              />
            )}
          </View>
          
          {loading || searchLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Yükleniyor...</Text>
            </View>
          ) : filteredFriends.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'Sonuç bulunamadı' : 'Henüz öneri yok'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery 
                  ? 'Farklı bir arama terimi deneyin' 
                  : 'Tüm kullanıcılar zaten arkadaşınız'
                }
              </Text>
            </View>
          ) : (
            filteredFriends.map((friend, index) => (
              <View 
                key={friend.id}
                style={[styles.friendCard, index === filteredFriends.length - 1 && styles.friendCardLast]}
              >
                {/* Friend Info */}
                <View style={styles.friendCardContent}>
                  <View style={styles.friendInfo}>
                    <View style={styles.friendAvatar}>
                      <Text style={styles.friendAvatarText}>{friend.avatar}</Text>
                    </View>
                    <View style={styles.friendDetails}>
                      <Text style={styles.friendName}>
                        {friend.name}
                      </Text>

                      <Text style={styles.friendPhone}>
                        {friend.phone}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Action Button */}
                  <View style={styles.friendActionContainer}>
                    {friend.isAdded ? (
                      <Button
                        title="Arkadaşsınız"
                        backgroundColor="bg-gray-200"
                        textColor="text-gray-700"
                        size="small"
                        shape="rounded"
                        onPress={() => handleRemoveFriend(friend.id)}
                      />
                    ) : friend.isPending ? (
                      <Button
                        title="İstek Gönderildi"
                        backgroundColor="bg-yellow-100"
                        textColor="text-yellow-700"
                        size="small"
                        shape="rounded"
                        onPress={() => handleRemoveFriend(friend.id)}
                      />
                    ) : (
                      <Button
                        title="Arkadaş Ekle"
                        backgroundColor="bg-blue-600"
                        textColor="text-white"
                        size="small"
                        shape="rounded"
                        onPress={() => handleAddFriend(friend.id)}
                      />
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>


      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 85,
    flexGrow: 1,
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  searchClearButton: {
    color: '#9ca3af',
    fontSize: 18,
    marginLeft: 8,
  },
  friendsSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  friendsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  friendsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  friendCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  friendCardLast: {
    marginBottom: 0,
  },
  friendCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 48,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    fontSize: 20,
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  friendPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  friendActionContainer: {
    marginLeft: 12,
  },
});
