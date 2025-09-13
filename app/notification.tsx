import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import '../global.css';
import { friendService } from '../services/api';

type FriendRequest = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  created_at: string;
  from_user: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
};

export default function NotificationScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Bildirim tipine göre ikon ve renk döndüren fonksiyon
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'payment_received':
        return { name: 'cash' as const, color: '#10B981' }; // Yeşil
      case 'payment_request':
        return { name: 'mail' as const, color: '#3B82F6' }; // Mavi
      case 'debt_reminder':
        return { name: 'time' as const, color: '#F59E0B' }; // Sarı
      case 'group_expense':
        return { name: 'people' as const, color: '#8B5CF6' }; // Mor
      case 'settlement':
        return { name: 'checkmark-circle' as const, color: '#10B981' }; // Yeşil
      case 'friend_request':
        return { name: 'person-add' as const, color: '#6366F1' }; // İndigo
      default:
        return { name: 'notifications' as const, color: '#6B7280' }; // Gri
    }
  };

  // Load friend requests from database
  useEffect(() => {
    const loadFriendRequests = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const { data, error } = await friendService.getFriendRequests(user.id);
        if (error) throw error;
        
        setFriendRequests(data || []);
      } catch (error) {
        console.error('Error loading friend requests:', error);
        Alert.alert('Hata', 'Bildirimler yüklenirken hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    loadFriendRequests();
  }, [user]);

  // Helper function to get time ago
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}dk önce`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}sa önce`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}g önce`;
    }
  };

  // Convert friend requests to notification format
  const allNotifications = friendRequests.map(request => ({
    id: request.id,
    type: 'friend_request',
    title: 'Arkadaşlık İsteği',
    description: `${request.from_user?.full_name || 'Bilinmeyen Kullanıcı'} size arkadaşlık isteği gönderdi`,
    time: getTimeAgo(request.created_at),
    isRead: request.status !== 'pending',
    from_user: request.from_user,
    request_id: request.id
  }));

  const unreadNotifications = allNotifications.filter(notification => !notification.isRead);
  const currentNotifications = activeTab === 'all' ? allNotifications : unreadNotifications;

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'payment_received':
        return styles.notificationGreen;
      case 'payment_request':
        return styles.notificationBlue;
      case 'debt_reminder':
        return styles.notificationOrange;
      case 'debt_settled':
        return styles.notificationGreen;
      case 'group_expense':
        return styles.notificationPurple;
      case 'friend_added':
        return styles.notificationBlue;
      case 'friend_request':
        return styles.notificationIndigo;
      case 'expense_split':
        return styles.notificationYellow;
      default:
        return styles.notificationGray;
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!user) return;
    
    try {
      const { error } = await friendService.respondFriendRequest(requestId, 'accepted');
      if (error) {
        // Check if it's a duplicate key error
        if ((error as any).code === '23505') {
          Alert.alert('Bilgi', 'Bu kişi zaten arkadaşınız');
        } else {
          throw error;
        }
      } else {
        Alert.alert('Başarılı', 'Arkadaşlık isteği kabul edildi');
      }
      
      // Reload friend requests regardless of success/failure
      const { data, error: reloadError } = await friendService.getFriendRequests(user.id);
      if (reloadError) {
        console.error('Error reloading friend requests:', reloadError);
      } else {
        setFriendRequests(data || []);
      }
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Hata', error.message || 'İstek kabul edilirken hata oluştu');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!user) return;
    
    try {
      const { error } = await friendService.respondFriendRequest(requestId, 'declined');
      if (error) throw error;
      
      Alert.alert('Başarılı', 'Arkadaşlık isteği reddedildi');
      
      // Reload friend requests
      const { data, error: reloadError } = await friendService.getFriendRequests(user.id);
      if (reloadError) {
        console.error('Error reloading friend requests:', reloadError);
      } else {
        setFriendRequests(data || []);
      }
    } catch (error: any) {
      console.error('Error declining friend request:', error);
      Alert.alert('Hata', error.message || 'İstek reddedilirken hata oluştu');
    }
  };

  const getActionButton = (notification: any) => {
    if (notification.type === 'friend_request' && notification.isRead === false) {
      return (
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity 
            style={styles.acceptButton}
            onPress={() => handleAcceptRequest(notification.request_id)}
          >
            <Text style={styles.actionButtonText}>Kabul</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.declineButton}
            onPress={() => handleDeclineRequest(notification.request_id)}
          >
            <Text style={styles.actionButtonText}>Red</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const renderNotificationItem = (item: any) => {
    return (
      <TouchableOpacity 
        key={item.id} 
        style={[styles.notificationItem, getNotificationStyle(item.type), !item.isRead && styles.notificationItemUnread]}
      >
        <View style={styles.notificationContent}>
          <View style={styles.notificationIcon}>
            <Ionicons 
              name={getNotificationIcon(item.type).name} 
              size={24} 
              color={getNotificationIcon(item.type).color} 
            />
          </View>
          
          <View style={styles.notificationInfo}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitle}>{item.title}</Text>
              {!item.isRead && (
                <View style={styles.unreadIndicator}></View>
              )}
            </View>
            
            <Text style={styles.notificationDescription}>{item.description}</Text>
            
            <View style={styles.notificationFooter}>
              <Text style={styles.notificationTime}>{item.time}</Text>
              {getActionButton(item)}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirimler</Text>
        <TouchableOpacity>
          <Text style={styles.clearButton}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'all' && styles.tabButtonActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' ? styles.tabTextActive : styles.tabTextInactive]}>
            Tümü ({allNotifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'unread' && styles.tabButtonActive]}
          onPress={() => setActiveTab('unread')}
        >
          <Text style={[styles.tabText, activeTab === 'unread' ? styles.tabTextActive : styles.tabTextInactive]}>
            Okunmamış ({unreadNotifications.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
          </View>
        ) : currentNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>
              {activeTab === 'unread' ? 'Okunmamış bildirim yok' : 'Henüz bildirim yok'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'unread' 
                ? 'Tüm bildirimlerinizi okumuşsunuz!' 
                : 'Borç ve ödeme bildirimleriniz burada görünecek'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsContainer}>
            {/* Bugün */}
            {currentNotifications.some(n => n.time.includes('dk') || n.time.includes('sa')) && (
              <>
                <Text style={styles.sectionHeader}>Bugün</Text>
                {currentNotifications
                  .filter(n => n.time.includes('dk') || n.time.includes('sa'))
                  .map(renderNotificationItem)
                }
              </>
            )}
            
            {/* Bu Hafta */}
            {currentNotifications.some(n => n.time.includes('g')) && (
              <>
                <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>Bu Hafta</Text>
                {currentNotifications
                  .filter(n => n.time.includes('g'))
                  .map(renderNotificationItem)
                }
              </>
            )}
          </View>
        )}

        {/* Bildirim ayarları */}
        {currentNotifications.length > 0 && (
          <View style={styles.settingsContainer}>
            <TouchableOpacity style={styles.settingsButton}>
              <View style={styles.settingsContent}>
                <View style={styles.settingsInfo}>
                  <Text style={styles.settingsIcon}>⚙️</Text>
                  <View>
                    <Text style={styles.settingsTitle}>Bildirim Ayarları</Text>
                    <Text style={styles.settingsSubtitle}>Hangi bildirimleri almak istediğinizi seçin</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    fontSize: 24,
    color: '#374151',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  clearButton: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#3b82f6',
  },
  tabTextInactive: {
    color: '#6b7280',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
  },
  notificationsContainer: {
    paddingVertical: 8,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHeaderSpaced: {
    paddingTop: 16,
  },
  notificationItem: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  notificationItemUnread: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  notificationGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  notificationBlue: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  notificationOrange: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  notificationPurple: {
    backgroundColor: '#faf5ff',
    borderColor: '#e9d5ff',
  },
  notificationIndigo: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  notificationYellow: {
    backgroundColor: '#fefce8',
    borderColor: '#fef08a',
  },
  notificationGray: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  notificationInfo: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  notificationTitle: {
    fontWeight: '600',
    color: '#111827',
    fontSize: 16,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  notificationDescription: {
    color: '#374151',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notificationTime: {
    color: '#6b7280',
    fontSize: 12,
  },
  settingsContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  settingsButton: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
  },
  settingsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  settingsTitle: {
    fontWeight: '600',
    color: '#111827',
  },
  settingsSubtitle: {
    color: '#6b7280',
    fontSize: 14,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  declineButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});