import { router } from 'expo-router';
import {
  Bell,
  ChevronRight,
  CreditCard,
  CreditCard as Edit,
  CircleHelp as HelpCircle,
  LogOut,
  Mail,
  Moon,
  Phone,
  Settings,
  Shield,
  Sun,
  User
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  
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
      icon: <Settings size={24} color={colors.icon} />,
      color: colors.divider,
      action: 'account',
    },
    {
      id: '2',
      title: 'Notifications',
      subtitle: 'Manage notification preferences',
      icon: <Bell size={24} color={isDark ? '#FFFFFF' : '#111827'} />,
      color: isDark ? '#1E3A8A' : '#DBEAFE',
      action: 'notifications',
    },
    {
      id: '3',
      title: 'Payment Methods',
      subtitle: 'Add or manage payment methods',
      icon: <CreditCard size={24} color={isDark ? '#FFFFFF' : '#111827'} />,
      color: isDark ? '#064E3B' : '#D1FAE5',
      action: 'payments',
    },
    {
      id: '4',
      title: 'Privacy & Security',
      subtitle: 'Control your privacy settings',
      icon: <Shield size={24} color={isDark ? '#FFFFFF' : '#111827'} />,
      color: isDark ? '#92400E' : '#FEF3C7',
      action: 'security',
    },
    {
      id: '5',
      title: 'Help & Support',
      subtitle: 'Get help or contact support',
      icon: <HelpCircle size={24} color={isDark ? '#FFFFFF' : '#111827'} />,
      color: isDark ? '#581C87' : '#EDE9FE',
      action: 'help',
    },
  ]);

  const getThemeIcon = () => {
    if (themeMode === 'light') return <Sun size={24} color={colors.warning} />;
    if (themeMode === 'dark') return <Moon size={24} color={colors.primary} />;
    return <Settings size={24} color={colors.icon} />; // system mode
  };

  const getThemeTitle = () => {
    if (themeMode === 'light') return 'Light Theme';
    if (themeMode === 'dark') return 'Dark Theme';
    return 'System Theme';
  };

  const getThemeSubtitle = () => {
    if (themeMode === 'light') return 'Always use light theme';
    if (themeMode === 'dark') return 'Always use dark theme';
    return 'Follow system settings';
  };

  const handleThemeToggle = () => {
    const modes: Array<'light' | 'dark' | 'system'> = ['system', 'light', 'dark'];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setThemeMode(modes[nextIndex]);
  };

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
    console.log('🔘 Logout button pressed');
    
    if (Platform.OS === 'web') {
      // Web ortamında confirm kullan
      const shouldLogout = window.confirm('Hesabınızdan çıkış yapmak istediğinizden emin misiniz?');
      
      if (shouldLogout) {
        console.log('🚪 Starting logout process...');
        performLogout();
        router.replace('/(auth)/AuthScreen');
      } else {
        console.log('❌ Logout cancelled');
      }
    } else {
      // Mobil ortamda Alert.alert kullan
      Alert.alert(
        'Çıkış Yap',
        'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?',
        [
          {
            text: 'İptal',
            style: 'cancel',
            onPress: () => console.log('❌ Logout cancelled'),
          },
          {
            text: 'Çıkış Yap',
            style: 'destructive',
            onPress: () => {
              console.log('🚪 Starting logout process...');
              performLogout();
              router.replace('/(auth)/AuthScreen');
            },
          },
        ]
      );
    }
  };

  const performLogout = async () => {
    try {
      // SignOut işlemini başlat - loading screen otomatik olarak gösterilecek
      const result = await signOut();
      console.log('📤 SignOut result:', result);
      
      if (result.error) {
        console.error('❌ Logout error:', result.error);
        if (Platform.OS === 'web') {
          alert('Çıkış yapılırken bir hata oluştu: ' + result.error.message);
        } else {
          Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu: ' + result.error.message);
        }
      } else {
        console.log('✅ Logout successful - loading screen will show and then redirect to auth screen');
        // AuthContext'teki signOut fonksiyonu loading state'ini true yapacak
        // Loading screen gösterilecek ve 1.5 saniye sonra auth ekranına yönlendirilecek
      }
    } catch (error) {
      console.error('❌ Logout catch error:', error);
      if (Platform.OS === 'web') {
        alert('Çıkış yapılırken bir hata oluştu: ' + String(error));
      } else {
        Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu: ' + String(error));
      }
    }
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
          <TouchableOpacity style={[styles.editButton, { backgroundColor: colors.divider }]}>
            <Edit size={20} color={colors.icon} />
          </TouchableOpacity>
        </View>

        {/* User Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <View style={[styles.avatar, { backgroundColor: colors.divider }]}>
                <User size={40} color={colors.icon} />
              </View>
              <View style={[styles.onlineIndicator, { backgroundColor: colors.success }]} />
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.userName, { color: colors.text }]}>{userProfile.name}</Text>
              <Text style={[styles.memberSince, { color: colors.textSecondary }]}>Member since {userProfile.memberSince}</Text>
            </View>
          </View>


          {/* Contact Information */}
          <View style={styles.contactSection}>
            <Text style={[styles.contactTitle, { color: colors.text }]}>Contact Information</Text>
            <View style={styles.contactItem}>
              <Mail size={16} color={colors.icon} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]}>{userProfile.email}</Text>
            </View>
            <View style={styles.contactItem}>
              <Phone size={16} color={colors.icon} />
              <Text style={[styles.contactText, { color: colors.textSecondary }]}>{userProfile.phone}</Text>
            </View>
          </View>
        </View>

        {/* Theme Toggle */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Appearance</Text>
          <TouchableOpacity style={[styles.menuItem, { backgroundColor: colors.card }]} onPress={handleThemeToggle}>
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: themeMode === 'light' ? (isDark ? '#92400E' : '#FEF3C7') : themeMode === 'dark' ? (isDark ? '#1E3A8A' : '#DBEAFE') : colors.divider }]}>
                {getThemeIcon()}
              </View>
              <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, { color: colors.text }]}>{getThemeTitle()}</Text>
                <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{getThemeSubtitle()}</Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.iconSecondary} />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
          {menuItems.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.menuItem, { backgroundColor: colors.card }]}>
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: item.color }]}>
                  {item.icon}
                </View>
                <View style={styles.menuContent}>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
                  {item.subtitle && (
                    <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                  )}
                </View>
              </View>
              <ChevronRight size={20} color={colors.iconSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: isDark ? '#7F1D1D' : '#FEE2E2' }]} onPress={handleLogout}>
          <LogOut size={20} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>

        {/* App Version */}
        <Text style={[styles.appVersion, { color: colors.textTertiary }]}>Borccu v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  editButton: {
    borderRadius: 8,
    padding: 8,
  },
  profileCard: {
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
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    marginBottom: 8,
  },
  contactSection: {
    paddingTop: 16,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  menuSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  menuItem: {
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
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 14,
  },
  logoutButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  appVersion: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 24,
    marginBottom: 24,
  },
});
