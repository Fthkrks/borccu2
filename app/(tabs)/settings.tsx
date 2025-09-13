import {
    Bell,
    ChevronRight,
    CreditCard,
    CreditCard as Edit,
    CircleHelp as HelpCircle,
    LogOut,
    Mail,
    Phone,
    Settings,
    Shield,
    User
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import '../../global.css';
import { profileService } from '../../services/api';

interface UserProfile {
  name: string;
  email: string;
  phone: string;
  memberSince: string;
}

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactElement;
  color: string;
  action: string;
}

export default function SettingsScreen() {
  const { signOut, user } = useAuth();
  
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Kullanıcı',
    email: 'user@example.com',
    phone: '-',
    memberSince: 'January 2024',
  });

  const [menuItems] = useState<MenuItem[]>([
    {
      id: '1',
      title: 'Account Settings',
      subtitle: 'Manage your account details',
      icon: <Settings size={24} color="#6B7280" />,
      color: '#F3F4F6',
      action: 'account',
    },
    {
      id: '2',
      title: 'Notifications',
      subtitle: 'Manage notification preferences',
      icon: <Bell size={24} color="#3B82F6" />,
      color: '#DBEAFE',
      action: 'notifications',
    },
    {
      id: '3',
      title: 'Payment Methods',
      subtitle: 'Add or manage payment methods',
      icon: <CreditCard size={24} color="#10B981" />,
      color: '#D1FAE5',
      action: 'payments',
    },
    {
      id: '4',
      title: 'Privacy & Security',
      subtitle: 'Control your privacy settings',
      icon: <Shield size={24} color="#F59E0B" />,
      color: '#FEF3C7',
      action: 'security',
    },
    {
      id: '5',
      title: 'Help & Support',
      subtitle: 'Get help or contact support',
      icon: <HelpCircle size={24} color="#8B5CF6" />,
      color: '#EDE9FE',
      action: 'help',
    },
  ]);

  // Load user profile data
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!user) return;
      
      try {
        const { data: profile, error } = await profileService.getProfile(user.id);
        if (error) throw error;

        if (profile) {
          setUserProfile({
            name: profile.full_name || user.email || 'Kullanıcı',
            email: profile.email || user.email || '',
            phone: profile.phone || '-',
            memberSince: new Date(profile.created_at).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            }),
          });
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      }
    };

    loadUserProfile();
  }, [user]);

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              // The auth context will automatically redirect to AuthScreen
            } catch (error) {
              Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu.');
            }
          },
        },
      ]
    );
  };


  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.editButton}>
            <Edit size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <User size={40} color="#6B7280" />
              </View>
              <View style={styles.onlineIndicator} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{userProfile.name}</Text>
              <Text style={styles.memberSince}>Member since {userProfile.memberSince}</Text>
            </View>
          </View>


          {/* Contact Information */}
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Contact Information</Text>
            <View style={styles.contactItem}>
              <Mail size={16} color="#6B7280" />
              <Text style={styles.contactText}>{userProfile.email}</Text>
            </View>
            <View style={styles.contactItem}>
              <Phone size={16} color="#6B7280" />
              <Text style={styles.contactText}>{userProfile.phone}</Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={styles.menuItem}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: item.color }]}>
                  {item.icon}
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                  )}
                </View>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={styles.appVersion}>Borccu v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  editButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  contactSection: {
    paddingTop: 16,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#6B7280',
  },
  menuSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  menuItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  logoutButton: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  appVersion: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 24,
    marginBottom: 24,
  },
});
