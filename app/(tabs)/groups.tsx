import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/buton';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import '../../global.css';
import { groupService } from '../../services/api';

export default function GroupsScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Sadece grupları yükle (group_members verisiyle birlikte)
      const groupsResult = await groupService.getGroups(user.id);

      if (groupsResult.data) {
        // No need to pre-calculate stats, we'll calculate them in the render
        setGroups(groupsResult.data);
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Ekran tekrar odaklandığında verileri yenile
  useFocusEffect(
    useCallback(() => {
      if (user) {
        load();
      }
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Gruplar</Text>
        <Button
          title="Yeni Grup"
          backgroundColor="bg-blue-600"
          textColor="text-white"
          size="small"
          shape="rounded"
          onPress={() => {
            // Yeni grup oluşturma ekranına git
            console.log('New group pressed');
router.push('/create-group');
          }}
        />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Groups List */}
        <View style={styles.groupsList}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
            </View>
          ) : groups.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Henüz grup oluşturmadınız
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                İlk grubunuzu oluşturun ve{'\n'}
                borçları kolayca takip edin
              </Text>
              <Button
                title="İlk Grubu Oluştur"
                backgroundColor="bg-blue-600"
                textColor="text-white"
                onPress={() => router.push('/create-group')}
              />
            </View>
          ) : (
            groups.map((group, index) => (
              <TouchableOpacity
                key={group.id}
                style={[styles.groupCard, { backgroundColor: colors.card }, index === groups.length - 1 && styles.groupCardLast]}
                onPress={() => {
                  // Grup detayına git
                  console.log('Group pressed:', group.name);
                  router.push({
                    pathname: '/groups-detail',
                    params: { 
                      groupId: group.id.toString()
                    }
                  });
                }}
              >
                {/* Group Header */}
                <View style={styles.groupHeader}>
                  <View style={styles.groupHeaderLeft}>
                    <View style={[styles.groupAvatar, { backgroundColor: colors.primary }]}>
                      <Ionicons name="people" size={20} color={colors.primaryText} />
                    </View>
                    <View>
                      <Text style={[styles.groupName, { color: colors.text }]}>
                        {group.name}
                      </Text>
                      <Text style={[styles.groupMemberCount, { color: colors.textSecondary }]}>{(group.group_members?.length || 0)} üye</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.iconSecondary} />
                </View>

                {/* Group Stats */}
                <View style={[styles.groupStats, { backgroundColor: colors.divider }]}>
                  {!!group.description && (
                    <Text style={[styles.groupDescription, { color: colors.textSecondary }]}>{group.description}</Text>
                  )}
                  
                  {(() => {
                    // Calculate totals from group_members data
                    const members = group.group_members || [];
                    const totalAmount = members.reduce((sum: number, member: any) => sum + (member.amount_owed || 0), 0);
                    const paidAmount = members
                      .filter((member: any) => member.is_paid)
                      .reduce((sum: number, member: any) => sum + (member.amount_owed || 0), 0);
                    const pendingAmount = totalAmount - paidAmount;

                    return (
                      <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Tutar</Text>
                          <Text style={[styles.statValueTotal, { color: colors.text }]}>₺{totalAmount.toFixed(2)}</Text>
                        </View>
                        
                        <View style={[styles.statItem, styles.statItemMiddle]}>
                          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ödenen</Text>
                          <Text style={[styles.statValuePaid, { color: colors.success }]}>₺{paidAmount.toFixed(2)}</Text>
                        </View>
                        
                        <View style={styles.statItem}>
                          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Bekleyen</Text>
                          <Text style={[styles.statValuePending, { color: colors.warning }]}>₺{pendingAmount.toFixed(2)}</Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Progress Bar */}
                  <View style={styles.progressSection}>
                    {(() => {
                      const members = group.group_members || [];
                      const totalAmount = members.reduce((sum: number, member: any) => sum + (member.amount_owed || 0), 0);
                      const paidAmount = members
                        .filter((member: any) => member.is_paid)
                        .reduce((sum: number, member: any) => sum + (member.amount_owed || 0), 0);
                      const completionPercentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

                      return (
                        <>
                          <View style={[styles.progressBarContainer, { backgroundColor: colors.divider }]}>
                            <View 
                              style={[styles.progressBar, { width: `${completionPercentage}%`, backgroundColor: colors.success }]}
                            />
                          </View>
                          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                            {completionPercentage}% tamamlandı
                          </Text>
                        </>
                      );
                    })()}
                  </View>
                </View>
              </TouchableOpacity>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingTop: 48,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 85,
    flexGrow: 1,
  },
  groupsList: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  groupCardLast: {
    marginBottom: 0,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
  },
  groupMemberCount: {
    fontSize: 14,
  },
  groupStats: {
    borderRadius: 8,
    padding: 12,
  },
  groupDescription: {
    fontSize: 14,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
  },
  statItemMiddle: {
    paddingHorizontal: 12,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValueTotal: {
    fontSize: 18,
    fontWeight: '700',
  },
  statValuePaid: {
    fontSize: 18,
    fontWeight: '700',
  },
  statValuePending: {
    fontSize: 18,
    fontWeight: '700',
  },
  progressSection: {
    marginTop: 12,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    borderRadius: 4,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
