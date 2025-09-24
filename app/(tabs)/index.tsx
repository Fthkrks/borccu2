import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { debtService, friendService, groupService, notificationService } from '../../services/api';

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  
  // State
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Filter and pagination states
  const [debtFilter, setDebtFilter] = useState('');
  const [debtTypeFilter, setDebtTypeFilter] = useState('all'); // 'all', 'owe', 'owed'
  const [groupFilter, setGroupFilter] = useState('');
  const [groupTypeFilter, setGroupTypeFilter] = useState('all'); // 'all', 'owe', 'owed'
  const [debtPage, setDebtPage] = useState(1);
  const [groupPage, setGroupPage] = useState(1);
  const [showDebtFilter, setShowDebtFilter] = useState(false);
  const [showGroupFilter, setShowGroupFilter] = useState(false);
  
  const ITEMS_PER_PAGE = 5;

  // Data fetching
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Ekran tekrar odaklandığında verileri yenile
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadData();
      }
    }, [user])
  );

  const loadData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        console.warn('Supabase not configured, using mock data');
        // Mock data for testing
        setDebts([]);
        setGroups([]);
        setHasNotifications(false);
        setHasData(false);
        return;
      }

      // Borçları, grupları ve bildirimleri paralel olarak yükle
      const [debtsResult, groupsResult, notificationsResult, unreadNotificationsResult] = await Promise.all([
        debtService.getDebts(user.id),
        groupService.getGroups(user.id),
        friendService.getFriendRequests(user.id),
        notificationService.getNotifications(user.id)
      ]);

      if (debtsResult.data) {
        setDebts(debtsResult.data);
      }
      
      if (groupsResult.data) {
        setGroups(groupsResult.data);
      }

      // Check if there are pending friend requests
      setHasNotifications((notificationsResult.data?.length || 0) > 0);
      
      // Calculate unread notification count
      if (unreadNotificationsResult.data) {
        const unreadCount = unreadNotificationsResult.data.filter((notification: any) => !notification.read).length;
        setNotificationCount(unreadCount);
        setHasNotifications(unreadCount > 0);
      } else {
        setNotificationCount(0);
        setHasNotifications(false);
      }
      
      setHasData((debtsResult.data?.length || 0) > 0 || (groupsResult.data?.length || 0) > 0);
    } catch (error) {
      console.error('Data loading error:', error);
      // Set safe defaults on error
      setDebts([]);
      setGroups([]);
      setHasNotifications(false);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  };

  // Hesaplanan değerler - API'den gelen işlenmiş veriye göre
  const debtsData = {
    youwillreceive: debts
      .filter(d => !d.is_settled && d.creditor_id === user?.id)
      .reduce((sum, d) => sum + (d.youwillreceive || 0), 0),
    youwillgive: debts
      .filter(d => !d.is_settled && d.debtor_id === user?.id)
      .reduce((sum, d) => sum + (d.youwillgive || 0), 0),
    allDebts: debts
      .filter(d => !d.is_settled)
      .map(d => {
        console.log('🔍 Debt mapping DEBUG:', { 
          id: d.id, 
          youwillreceive: d.youwillreceive, 
          youwillgive: d.youwillgive,
          other_party: d.other_party
        });
        
        // Kullanıcının perspektifinden borç miktarını hesapla
        const isCreditor = d.creditor_id === user?.id;
        const amount = isCreditor ? (d.youwillreceive || 0) : (d.youwillgive || 0);
        const type = isCreditor ? 'owe' as const : 'owed' as const;
        const name = d.other_party?.full_name || d.other_party?.email || 'Bilinmeyen';
        
        console.log('🔍 Mapped result:', { amount, type, name });
        
        return {
          id: d.id,
          name: name,
          type: type,
          amount: amount,
          youwillreceive: d.youwillreceive || 0,
          youwillgive: d.youwillgive || 0,
          description: d.description,
          pay_date: d.pay_date || undefined
        };
      })
      .filter(debt => debt.amount > 0), // 0 tutarlı borçları filtrele
    groups: groups.map(group => ({
      id: group.id,
      name: group.name,
      memberCount: group.group_members?.length || 0,
      type: 'group' as const
    }))
  };

  // Filter functions
  const filteredDebts = debtsData.allDebts.filter(debt => {
    const nameMatch = debt.name?.toLowerCase().includes(debtFilter.toLowerCase()) || false;
    const typeMatch = debtTypeFilter === 'all' || debt.type === debtTypeFilter;
    return nameMatch && typeMatch;
  });

  const filteredGroups = debtsData.groups.filter(group => {
    const nameMatch = group.name.toLowerCase().includes(groupFilter.toLowerCase());
    return nameMatch; // Gruplar için tip filtresi kaldırıldı
  });

  // Pagination functions
  const startIndexDebts = (debtPage - 1) * ITEMS_PER_PAGE;
  const endIndexDebts = startIndexDebts + ITEMS_PER_PAGE;
  const paginatedDebts = filteredDebts.slice(startIndexDebts, endIndexDebts);
  
  const startIndexGroups = (groupPage - 1) * ITEMS_PER_PAGE;
  const endIndexGroups = startIndexGroups + ITEMS_PER_PAGE;
  const paginatedGroups = filteredGroups.slice(startIndexGroups, endIndexGroups);

  const totalDebtPages = Math.ceil(filteredDebts.length / ITEMS_PER_PAGE);
  const totalGroupPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <View style={styles.headerSpacer}></View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Borçlar</Text>
          <View style={styles.headerSpacer}></View>
        </View>

        {/* Loading State */}
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Yükleniyor...
          </Text>
          <Text style={[styles.loadingSubText, { color: colors.textTertiary }]}>
            Borç bilgileriniz getiriliyor
          </Text>
        </View>
      </View>
    );
  }

  if (!hasData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.push('/notification')} style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color={colors.icon} />
          {hasNotifications && (
            <View style={[styles.notificationBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.notificationBadgeText}>
                {notificationCount > 99 ? '99+' : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Borçlar</Text>
          <View style={styles.headerSpacer}></View>
        </View>

        {/* Empty State */}
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Henüz borç kaydınız yok
          </Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Ne borçlusunuz ne de kimseye borç verdiniz.{'\n'}
            İlk harcamanızı ekleyin!
          </Text>
        </View>

        {/* Floating Action Button */}
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: '#111827' }]}
          onPress={() => {
            console.log('Add new debt pressed');
            router.push('/add-debt');
          }}
        >
          <Text style={[styles.fabText, { color: 'white' }]}>+</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.push('/notification')} style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color={colors.icon} />
          {hasNotifications && (
            <View style={[styles.notificationBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.notificationBadgeText}>
                {notificationCount > 99 ? '99+' : notificationCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Borçlar</Text>
        <View style={styles.headerSpacer}></View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            {/* You'll receive card */}
            <View style={[styles.summaryCard, { backgroundColor: isDark ? '#022C22' : '#DCFCE7', borderColor: isDark ? '#16A34A' : '#86EFAC' }]}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#10B981' : '#166534' }]}>Alacağınız</Text>
              <Text style={[styles.summaryAmount, { color: isDark ? '#10B981' : '#166534' }]}>
                ₺{debtsData.youwillreceive}
              </Text>
            </View>

            {/* You'll give card */}
            <View style={[styles.summaryCard, { backgroundColor: isDark ? '#450A0A' : '#FEE2E2', borderColor: isDark ? '#B91C1C' : '#FCA5A5' }]}>
              <Text style={[styles.summaryLabel, { color: isDark ? '#EF4444' : '#991B1B' }]}>Vereceğiniz</Text>
              <Text style={[styles.summaryAmount, { color: isDark ? '#EF4444' : '#991B1B' }]}>
                ₺{debtsData.youwillgive}
              </Text>
            </View>
          </View>
        </View>

        {/* All debts section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tüm Borçlar</Text>
            <TouchableOpacity 
              onPress={() => setShowDebtFilter(!showDebtFilter)}
              style={styles.filterButton}
            >
              <Ionicons name="search-outline" size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Quick Type Filter */}
          <View style={styles.filterContainer}>
            <View style={styles.filterRow}>
              <TouchableOpacity 
                onPress={() => setDebtTypeFilter('all')}
                style={[styles.filterButtonAll, { backgroundColor: debtTypeFilter === 'all' ? colors.primary : colors.card, borderColor: debtTypeFilter === 'all' ? colors.primary : colors.border }]}
              >
                <Text style={[styles.filterText, { color: debtTypeFilter === 'all' ? colors.primaryText : colors.text }]}>
                  Tümü
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setDebtTypeFilter('owe')}
                style={[styles.filterButtonAll, { backgroundColor: debtTypeFilter === 'owe' ? colors.success : colors.card, borderColor: debtTypeFilter === 'owe' ? colors.success : colors.border }]}
              >
                <Text style={[styles.filterText, { color: debtTypeFilter === 'owe' ? colors.primaryText : colors.text }]}>
                  💰 Alacak
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setDebtTypeFilter('owed')}
                style={[styles.filterButtonAll, { backgroundColor: debtTypeFilter === 'owed' ? colors.error : colors.card, borderColor: debtTypeFilter === 'owed' ? colors.error : colors.border }]}
              >
                <Text style={[styles.filterText, { color: debtTypeFilter === 'owed' ? colors.primaryText : colors.text }]}>
                  💳 Verecek
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed Search Filter */}
          {showDebtFilter && (
            <View style={styles.searchContainer}>
              <View style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <Ionicons name="search-outline" size={18} color={colors.iconSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInputText, { color: colors.text }]}
                  placeholder="Kişi adı ile detaylı arama..."
                  placeholderTextColor={colors.placeholder}
                  value={debtFilter}
                  onChangeText={setDebtFilter}
                  autoCapitalize="none"
                />
                {debtFilter.length > 0 && (
                  <TouchableOpacity onPress={() => setDebtFilter('')}>
                    <Text style={[styles.clearSearchText, { color: colors.textSecondary }]}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          
          {filteredDebts.length === 0 ? (
            <View style={styles.emptyMessage}>
              <Text style={[styles.emptyMessageText, { color: colors.textSecondary }]}>Herhangi bir borç bulunamadı</Text>
            </View>
          ) : paginatedDebts.map((debt) => (
            <TouchableOpacity 
              key={debt.id} 
              style={[styles.debtItem, { borderBottomColor: colors.divider }]}
              onPress={() => {
                console.log('Navigating to DebtDetail with debt:', debt);
                router.push({
                  pathname: '/debt-detail',
                  params: {
                    debtId: debt.id
                  }
                });
              }}
            >
              <View style={styles.debtInfo}>
                <Text style={[styles.debtName, { color: colors.text }]}>
                  {debt.name}
                </Text>
                <Text style={[styles.debtDescription, { color: colors.textSecondary }]}>
                  {debt.type === 'owe' ? 'Size borçlu' : 'Siz borçlusunuz'}
                </Text>
              </View>
              <Text style={[styles.debtAmount, { color: debt.type === 'owe' ? colors.success : colors.error }]}>
                ₺{debt.amount}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Numbered Pagination for Debts */}
          {totalDebtPages > 1 && (
            <View style={styles.paginationContainer}>
              <View style={styles.paginationRow}>
                {/* Previous Button */}
                <TouchableOpacity 
                  onPress={() => setDebtPage(Math.max(1, debtPage - 1))}
                  disabled={debtPage === 1}
                  style={[styles.paginationButton, { backgroundColor: debtPage === 1 ? colors.divider : colors.primary }]}
                >
                  <Text style={[styles.paginationButtonText, { color: debtPage === 1 ? colors.textTertiary : colors.primaryText }]}>‹</Text>
                </TouchableOpacity>

                {/* Page Numbers */}
                {Array.from({ length: totalDebtPages }, (_, i) => i + 1).map((pageNum) => (
                  <TouchableOpacity 
                    key={pageNum}
                    onPress={() => setDebtPage(pageNum)}
                    style={[styles.paginationButton, { backgroundColor: debtPage === pageNum ? colors.primary : colors.divider }]}
                  >
                    <Text style={[styles.paginationButtonText, { color: debtPage === pageNum ? colors.primaryText : colors.text }]}>
                      {pageNum}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Next Button */}
                <TouchableOpacity 
                  onPress={() => setDebtPage(Math.min(totalDebtPages, debtPage + 1))}
                  disabled={debtPage === totalDebtPages}
                  style={[styles.paginationButton, { backgroundColor: debtPage === totalDebtPages ? colors.divider : colors.primary }]}
                >
                  <Text style={[styles.paginationButtonText, { color: debtPage === totalDebtPages ? colors.textTertiary : colors.primaryText }]}>›</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.paginationInfo, { color: colors.textSecondary }]}>
                Sayfa {debtPage} / {totalDebtPages} - Toplam {filteredDebts.length} borç
              </Text>
            </View>
          )}
        </View>

        {/* Groups section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Gruplar</Text>
            <TouchableOpacity 
              onPress={() => setShowGroupFilter(!showGroupFilter)}
              style={styles.filterButton}
            >
              <Ionicons name="search-outline" size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          {/* Quick Type Filter */}
          <View style={styles.filterContainer}>
            <View style={styles.filterRow}>
              <TouchableOpacity 
                onPress={() => setGroupTypeFilter('all')}
                style={[styles.filterButtonAll, { backgroundColor: groupTypeFilter === 'all' ? colors.primary : colors.card, borderColor: groupTypeFilter === 'all' ? colors.primary : colors.border }]}
              >
                <Text style={[styles.filterText, { color: groupTypeFilter === 'all' ? colors.primaryText : colors.text }]}>
                  Tümü
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setGroupTypeFilter('owe')}
                style={[styles.filterButtonAll, { backgroundColor: groupTypeFilter === 'owe' ? colors.success : colors.card, borderColor: groupTypeFilter === 'owe' ? colors.success : colors.border }]}
              >
                <Text style={[styles.filterText, { color: groupTypeFilter === 'owe' ? colors.primaryText : colors.text }]}>
                  👥 Alacak
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setGroupTypeFilter('owed')}
                style={[styles.filterButtonAll, { backgroundColor: groupTypeFilter === 'owed' ? colors.error : colors.card, borderColor: groupTypeFilter === 'owed' ? colors.error : colors.border }]}
              >
                <Text style={[styles.filterText, { color: groupTypeFilter === 'owed' ? colors.primaryText : colors.text }]}>
                  👥 Verecek
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed Search Filter */}
          {showGroupFilter && (
            <View style={styles.searchContainer}>
              <View style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <Ionicons name="search-outline" size={18} color={colors.iconSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInputText, { color: colors.text }]}
                  placeholder="Grup adı ile detaylı arama..."
                  placeholderTextColor={colors.placeholder}
                  value={groupFilter}
                  onChangeText={setGroupFilter}
                  autoCapitalize="none"
                />
                {groupFilter.length > 0 && (
                  <TouchableOpacity onPress={() => setGroupFilter('')}>
                    <Text style={[styles.clearSearchText, { color: colors.textSecondary }]}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          
          {filteredGroups.length === 0 ? (
            <View style={styles.emptyMessage}>
              <Text style={[styles.emptyMessageText, { color: colors.textSecondary }]}>Herhangi bir grup borcu bulunamadı</Text>
            </View>
          ) : paginatedGroups.map((group, index) => (
            <TouchableOpacity 
              key={group.id} 
              style={[styles.groupItem, { borderBottomColor: colors.divider }, index < paginatedGroups.length - 1 && styles.groupItemBorder]}
              onPress={() => {
                console.log('Group item pressed:', group);
                router.push({
                  pathname: '/groups-detail',
                  params: { 
                    groupId: group.id.toString()
                  }
                });
              }}
            >
              <View style={styles.groupInfo}>
                <Text style={[styles.groupName, { color: colors.text }]}>
                  {group.name}
                </Text>
                <Text style={[styles.groupDescription, { color: colors.textSecondary }]}>
                  {group.memberCount} üye
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.iconSecondary} />
            </TouchableOpacity>
          ))}

          {/* Numbered Pagination for Groups */}
          {totalGroupPages > 1 && (
            <View style={styles.paginationContainer}>
              <View style={styles.paginationRow}>
                {/* Previous Button */}
                <TouchableOpacity 
                  onPress={() => setGroupPage(Math.max(1, groupPage - 1))}
                  disabled={groupPage === 1}
                  style={[styles.paginationButton, { backgroundColor: groupPage === 1 ? colors.divider : colors.primary }]}
                >
                  <Text style={[styles.paginationButtonText, { color: groupPage === 1 ? colors.textTertiary : colors.primaryText }]}>‹</Text>
                </TouchableOpacity>

                {/* Page Numbers */}
                {Array.from({ length: totalGroupPages }, (_, i) => i + 1).map((pageNum) => (
                  <TouchableOpacity 
                    key={pageNum}
                    onPress={() => setGroupPage(pageNum)}
                    style={[styles.paginationButton, { backgroundColor: groupPage === pageNum ? colors.primary : colors.divider }]}
                  >
                    <Text style={[styles.paginationButtonText, { color: groupPage === pageNum ? colors.primaryText : colors.text }]}>
                      {pageNum}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Next Button */}
                <TouchableOpacity 
                  onPress={() => setGroupPage(Math.min(totalGroupPages, groupPage + 1))}
                  disabled={groupPage === totalGroupPages}
                  style={[styles.paginationButton, { backgroundColor: groupPage === totalGroupPages ? colors.divider : colors.primary }]}
                >
                  <Text style={[styles.paginationButtonText, { color: groupPage === totalGroupPages ? colors.textTertiary : colors.primaryText }]}>›</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.paginationInfo, { color: colors.textSecondary }]}>
                Sayfa {groupPage} / {totalGroupPages} - Toplam {filteredGroups.length} grup
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: '#111827' }]}
          onPress={() => {
            console.log('Add new debt pressed');
            router.push('/add-debt');
          }}
        >
          <Text style={[styles.fabText, { color: 'white' }]}>+</Text>
        </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingTop: 48,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 32,
  },
  notificationButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingSubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 85,
    flexGrow: 1,
  },
  summaryContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterButton: {
    padding: 8,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButtonAll: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    marginBottom: 16,
  },
  clearSearchText: {
    fontSize: 18,
    marginLeft: 8,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  searchInputText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
  },
  debtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  debtInfo: {
    flex: 1,
  },
  debtName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  debtDescription: {
    fontSize: 14,
  },
  debtAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyMessage: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyMessageText: {
    fontSize: 14,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  groupItemBorder: {
    borderBottomWidth: 1,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
  },
  paginationContainer: {
    marginTop: 16,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  paginationButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  paginationInfo: {
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 4,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    fontSize: 28,
    fontWeight: '200',
  },
});