import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { debtService, friendService, groupService } from '../../services/api';

export default function HomeScreen() {
  const { user } = useAuth();
  
  // State
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debts, setDebts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [hasNotifications, setHasNotifications] = useState(false);
  
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
      const [debtsResult, groupsResult, notificationsResult] = await Promise.all([
        debtService.getDebts(user.id),
        groupService.getGroups(user.id),
        friendService.getFriendRequests(user.id)
      ]);

      if (debtsResult.data) {
        setDebts(debtsResult.data);
      }
      
      if (groupsResult.data) {
        setGroups(groupsResult.data);
      }

      // Check if there are pending friend requests
      setHasNotifications((notificationsResult.data?.length || 0) > 0);
      
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
      .filter(d => !d.is_settled)
      .reduce((sum, d) => sum + (d.youwillreceive || 0), 0),
    youwillgive: debts
      .filter(d => !d.is_settled)
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
        
        const amount = (d.youwillreceive || 0) + (d.youwillgive || 0);
        const type = (d.youwillreceive || 0) > 0 ? 'owe' as const : 'owed' as const;
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
      }),
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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer}></View>
          <Text style={styles.headerTitle}>Borçlar</Text>
          <View style={styles.headerSpacer}></View>
        </View>

        {/* Loading State */}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            Yükleniyor...
          </Text>
          <Text style={styles.loadingSubText}>
            Borç bilgileriniz getiriliyor
          </Text>
        </View>
      </View>
    );
  }

  if (!hasData) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/notification')} style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color="#374151" />
          {hasNotifications && (
            <View style={styles.notificationBadge}></View>
          )}
        </TouchableOpacity>
          <Text style={styles.headerTitle}>Borçlar</Text>
          <View style={styles.headerSpacer}></View>
        </View>

        {/* Empty State */}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>
            Henüz borç kaydınız yok
          </Text>
          <Text style={styles.emptyText}>
            Ne borçlusunuz ne de kimseye borç verdiniz.{'\n'}
            İlk harcamanızı ekleyin!
          </Text>
        </View>

        {/* Floating Action Button */}
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => {
            console.log('Add new debt pressed');
            router.push('/add-debt');
          }}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/notification')} style={styles.notificationButton}>
          <Ionicons name="notifications-outline" size={24} color="#374151" />
          {hasNotifications && (
            <View style={styles.notificationBadge}></View>
          )}
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Borçlar</Text>
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
            <View style={[styles.summaryCard, styles.summaryCardReceive]}>
              <Text style={[styles.summaryLabel, styles.summaryLabelReceive]}>Alacağınız</Text>
              <Text style={[styles.summaryAmount, styles.summaryAmountReceive]}>
                ₺{debtsData.youwillreceive}
              </Text>
            </View>

            {/* You'll give card */}
            <View style={[styles.summaryCard, styles.summaryCardGive]}>
              <Text style={[styles.summaryLabel, styles.summaryLabelGive]}>Vereceğiniz</Text>
              <Text style={[styles.summaryAmount, styles.summaryAmountGive]}>
                ₺{debtsData.youwillgive}
              </Text>
            </View>
          </View>
        </View>

        {/* All debts section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tüm Borçlar</Text>
            <TouchableOpacity 
              onPress={() => setShowDebtFilter(!showDebtFilter)}
              style={styles.filterButton}
            >
              <Ionicons name="search-outline" size={20} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* Quick Type Filter */}
          <View style={styles.filterContainer}>
            <View style={styles.filterRow}>
              <TouchableOpacity 
                onPress={() => setDebtTypeFilter('all')}
                style={[styles.filterButtonAll, debtTypeFilter === 'all' ? styles.filterButtonActive : styles.filterButtonInactive]}
              >
                <Text style={debtTypeFilter === 'all' ? styles.filterTextActive : styles.filterTextInactive}>
                  Tümü
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setDebtTypeFilter('owe')}
                style={[styles.filterButtonAll, debtTypeFilter === 'owe' ? styles.filterButtonOweActive : styles.filterButtonInactive]}
              >
                <Text style={debtTypeFilter === 'owe' ? styles.filterTextActive : styles.filterTextInactive}>
                  💰 Alacak
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setDebtTypeFilter('owed')}
                style={[styles.filterButtonAll, debtTypeFilter === 'owed' ? styles.filterButtonOwedActive : styles.filterButtonInactive]}
              >
                <Text style={debtTypeFilter === 'owed' ? styles.filterTextActive : styles.filterTextInactive}>
                  💳 Verecek
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed Search Filter */}
          {showDebtFilter && (
            <View style={styles.searchContainer}>
              <View style={styles.searchInput}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInputText}
                  placeholder="Kişi adı ile detaylı arama..."
                  placeholderTextColor="#9CA3AF"
                  value={debtFilter}
                  onChangeText={setDebtFilter}
                  autoCapitalize="none"
                />
                {debtFilter.length > 0 && (
                  <TouchableOpacity onPress={() => setDebtFilter('')}>
                    <Text style={styles.clearSearchText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          
          {filteredDebts.length === 0 ? (
            <View style={styles.emptyMessage}>
              <Text style={styles.emptyMessageText}>Herhangi bir borç bulunamadı</Text>
            </View>
          ) : paginatedDebts.map((debt) => (
            <TouchableOpacity 
              key={debt.id} 
              style={styles.debtItem}
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
                <Text style={styles.debtName}>
                  {debt.name}
                </Text>
                <Text style={styles.debtDescription}>
                  {debt.youwillreceive > 0 && debt.youwillgive === 0 ? 'Size borçlu' : 'Siz borçlusunuz'}
                </Text>
              </View>
              <Text style={[styles.debtAmount, debt.youwillreceive > 0 && debt.youwillgive === 0 ? styles.debtAmountReceive : styles.debtAmountGive]}>
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
                  style={[styles.paginationButton, debtPage === 1 ? styles.paginationButtonDisabled : styles.paginationButtonActive]}
                >
                  <Text style={[styles.paginationButtonText, debtPage === 1 ? styles.paginationButtonTextDisabled : styles.paginationButtonTextActive]}>‹</Text>
                </TouchableOpacity>

                {/* Page Numbers */}
                {Array.from({ length: totalDebtPages }, (_, i) => i + 1).map((pageNum) => (
                  <TouchableOpacity 
                    key={pageNum}
                    onPress={() => setDebtPage(pageNum)}
                    style={[styles.paginationButton, debtPage === pageNum ? styles.paginationButtonActive : styles.paginationButtonInactive]}
                  >
                    <Text style={[styles.paginationButtonText, debtPage === pageNum ? styles.paginationButtonTextActive : styles.paginationButtonTextInactive]}>
                      {pageNum}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Next Button */}
                <TouchableOpacity 
                  onPress={() => setDebtPage(Math.min(totalDebtPages, debtPage + 1))}
                  disabled={debtPage === totalDebtPages}
                  style={[styles.paginationButton, debtPage === totalDebtPages ? styles.paginationButtonDisabled : styles.paginationButtonActive]}
                >
                  <Text style={[styles.paginationButtonText, debtPage === totalDebtPages ? styles.paginationButtonTextDisabled : styles.paginationButtonTextActive]}>›</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.paginationInfo}>
                Sayfa {debtPage} / {totalDebtPages} - Toplam {filteredDebts.length} borç
              </Text>
            </View>
          )}
        </View>

        {/* Groups section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Gruplar</Text>
            <TouchableOpacity 
              onPress={() => setShowGroupFilter(!showGroupFilter)}
              style={styles.filterButton}
            >
              <Ionicons name="search-outline" size={20} color="#4B5563" />
            </TouchableOpacity>
          </View>

          {/* Quick Type Filter */}
          <View style={styles.filterContainer}>
            <View style={styles.filterRow}>
              <TouchableOpacity 
                onPress={() => setGroupTypeFilter('all')}
                style={[styles.filterButtonAll, groupTypeFilter === 'all' ? styles.filterButtonActive : styles.filterButtonInactive]}
              >
                <Text style={groupTypeFilter === 'all' ? styles.filterTextActive : styles.filterTextInactive}>
                  Tümü
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setGroupTypeFilter('owe')}
                style={[styles.filterButtonAll, groupTypeFilter === 'owe' ? styles.filterButtonOweActive : styles.filterButtonInactive]}
              >
                <Text style={groupTypeFilter === 'owe' ? styles.filterTextActive : styles.filterTextInactive}>
                  👥 Alacak
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => setGroupTypeFilter('owed')}
                style={[styles.filterButtonAll, groupTypeFilter === 'owed' ? styles.filterButtonOwedActive : styles.filterButtonInactive]}
              >
                <Text style={groupTypeFilter === 'owed' ? styles.filterTextActive : styles.filterTextInactive}>
                  👥 Verecek
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Detailed Search Filter */}
          {showGroupFilter && (
            <View style={styles.searchContainer}>
              <View style={styles.searchInput}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInputText}
                  placeholder="Grup adı ile detaylı arama..."
                  placeholderTextColor="#9CA3AF"
                  value={groupFilter}
                  onChangeText={setGroupFilter}
                  autoCapitalize="none"
                />
                {groupFilter.length > 0 && (
                  <TouchableOpacity onPress={() => setGroupFilter('')}>
                    <Text style={styles.clearSearchText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
          
          {filteredGroups.length === 0 ? (
            <View style={styles.emptyMessage}>
              <Text style={styles.emptyMessageText}>Herhangi bir grup borcu bulunamadı</Text>
            </View>
          ) : paginatedGroups.map((group, index) => (
            <TouchableOpacity 
              key={group.id} 
              style={[styles.groupItem, index < paginatedGroups.length - 1 && styles.groupItemBorder]}
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
                <Text style={styles.groupName}>
                  {group.name}
                </Text>
                <Text style={styles.groupDescription}>
                  {group.memberCount} üye
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
                  style={[styles.paginationButton, groupPage === 1 ? styles.paginationButtonDisabled : styles.paginationButtonActive]}
                >
                  <Text style={[styles.paginationButtonText, groupPage === 1 ? styles.paginationButtonTextDisabled : styles.paginationButtonTextActive]}>‹</Text>
                </TouchableOpacity>

                {/* Page Numbers */}
                {Array.from({ length: totalGroupPages }, (_, i) => i + 1).map((pageNum) => (
                  <TouchableOpacity 
                    key={pageNum}
                    onPress={() => setGroupPage(pageNum)}
                    style={[styles.paginationButton, groupPage === pageNum ? styles.paginationButtonActive : styles.paginationButtonInactive]}
                  >
                    <Text style={[styles.paginationButtonText, groupPage === pageNum ? styles.paginationButtonTextActive : styles.paginationButtonTextInactive]}>
                      {pageNum}
                    </Text>
                  </TouchableOpacity>
                ))}

                {/* Next Button */}
                <TouchableOpacity 
                  onPress={() => setGroupPage(Math.min(totalGroupPages, groupPage + 1))}
                  disabled={groupPage === totalGroupPages}
                  style={[styles.paginationButton, groupPage === totalGroupPages ? styles.paginationButtonDisabled : styles.paginationButtonActive]}
                >
                  <Text style={[styles.paginationButtonText, groupPage === totalGroupPages ? styles.paginationButtonTextDisabled : styles.paginationButtonTextActive]}>›</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.paginationInfo}>
                Sayfa {groupPage} / {totalGroupPages} - Toplam {filteredGroups.length} grup
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => {
          console.log('Add new debt pressed');
          router.push('/add-debt');
        }}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#111827',
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
    width: 12,
    height: 12,
    backgroundColor: '#111827',
    borderRadius: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 18,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingSubText: {
    fontSize: 14,
    color: '#9CA3AF',
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
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#4B5563',
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
  },
  summaryCardReceive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    marginRight: 12,
  },
  summaryCardGive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    marginLeft: 12,
  },
  summaryLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  summaryLabelReceive: {
    color: '#059669',
  },
  summaryLabelGive: {
    color: '#DC2626',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryAmountReceive: {
    color: '#047857',
  },
  summaryAmountGive: {
    color: '#B91C1C',
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
    color: '#111827',
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
  filterButtonActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterButtonOweActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterButtonOwedActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  filterButtonInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D1D5DB',
  },
  filterTextActive: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  filterTextInactive: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  searchContainer: {
    marginBottom: 16,
  },
  clearSearchText: {
    color: '#9ca3af',
    fontSize: 18,
    marginLeft: 8,
  },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInputText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    marginLeft: 8,
  },
  debtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  debtInfo: {
    flex: 1,
  },
  debtName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  debtDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  debtAmount: {
    fontSize: 18,
    fontWeight: '600',
  },
  debtAmountReceive: {
    color: '#059669',
  },
  debtAmountGive: {
    color: '#DC2626',
  },
  emptyMessage: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyMessageText: {
    color: '#6B7280',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  groupItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 14,
    color: '#6b7280',
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
  paginationButtonActive: {
    backgroundColor: '#111827',
  },
  paginationButtonInactive: {
    backgroundColor: '#f3f4f6',
  },
  paginationButtonDisabled: {
    backgroundColor: '#f3f4f6',
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  paginationButtonTextActive: {
    color: '#ffffff',
  },
  paginationButtonTextInactive: {
    color: '#374151',
  },
  paginationButtonTextDisabled: {
    color: '#9ca3af',
  },
  paginationInfo: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: '#111827',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
  },
});