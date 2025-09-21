import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import '../global.css';
import { friendService, groupMemberService, groupService } from '../services/api';

type FriendItem = { id: string; name: string; phone: string; avatar: string; email?: string };
type GroupMember = {
  id: string;
  user_id: string;
  amount_owed: number;
  is_paid: boolean;
  profiles: {
    full_name: string;
    email: string;
    phone: string;
    avatar_url: string;
  };
};

export default function GroupsDetail() {
  const { groupId } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [groupDetail, setGroupDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<FriendItem[]>([]);

  // Load group details and members
  useEffect(() => {
    const loadGroupDetails = async () => {
      if (!groupId || !user) return;
      
      setLoading(true);
      try {
        const { data, error } = await groupService.getGroup(groupId.toString());
        if (error) throw error;
        
        setGroupDetail(data);
      } catch (error) {
        console.error('Error loading group details:', error);
        Alert.alert('Hata', 'Grup detayları yüklenirken hata oluştu');
      } finally {
        setLoading(false);
      }
    };

    loadGroupDetails();
  }, [groupId, user]);

  // Load friends for member selection
  useEffect(() => {
    const loadFriends = async () => {
      if (!user) return;
      const { data } = await friendService.getFriends(user.id);
      const mapped: FriendItem[] = (data || []).map((f: any) => ({
        id: f.id,
        name: f.full_name || f.email || 'Kullanıcı',
        phone: f.phone || '-',
        avatar: '👤',
        email: f.email,
      }));
      setFriends(mapped);
    };
    loadFriends();
  }, [user]);

  // Filter friends who are not already group members
  const filteredContacts = friends.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         contact.phone.includes(searchQuery);
    const isNotMember = !groupDetail?.group_members?.some((member: GroupMember) => member.user_id === contact.id);
    const isNotSelected = !selectedContacts.some(selected => selected.id === contact.id);
    return matchesSearch && isNotMember && isNotSelected;
  });

  const handleContactSelect = (contact: FriendItem) => {
    if (selectedContacts.some(selected => selected.id === contact.id)) return;
    setSelectedContacts([...selectedContacts, contact]);
  };

  const removeContact = (contactId: string) => {
    setSelectedContacts(selectedContacts.filter(contact => contact.id !== contactId));
  };

  const openContactModal = () => {
    setShowContactModal(true);
  };

  const handleAddMembers = async () => {
    if (!groupId || selectedContacts.length === 0) return;

    try {
      const memberInserts = selectedContacts.map(contact => ({
        group_id: groupId.toString(),
        user_id: contact.id,
      }));

      const { error } = await groupMemberService.addMembers(memberInserts);
      if (error) throw error;

      Alert.alert('Başarılı', 'Üyeler gruba eklendi');
      setShowContactModal(false);
      setSelectedContacts([]);
      
      // Reload group details
      const { data } = await groupService.getGroup(groupId.toString());
      setGroupDetail(data);
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Üyeler eklenirken hata oluştu');
    }
  };

  const handleMarkAsPaid = async (memberId: string) => {
    try {
      // Find the member to get their amount_owed
      const member = groupDetail.group_members?.find((m: GroupMember) => m.id === memberId);
      if (!member) {
        Alert.alert('Hata', 'Üye bulunamadı');
        return;
      }

      // Update member's is_paid status to true
      const { error } = await groupMemberService.updateMemberAmount(
        memberId, 
        member.amount_owed, 
        true // is_paid = true
      );

      if (error) throw error;

      Alert.alert('Başarılı', 'Ödeme işaretlendi');
      
      // Reload group details to update the UI
      const { data } = await groupService.getGroup(groupId.toString());
      setGroupDetail(data);
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Ödeme işaretlenirken hata oluştu');
      console.error('Mark as paid error:', error);
    }
  };

  const handleSendReminder = (memberId: string) => {
    console.log(`Sending reminder to member ${memberId}`);
    Alert.alert('Hatırlatma', 'Hatırlatma gönderildi!');
  };

  // Check if all members are paid (excluding group creator)
  const areAllMembersPaid = () => {
    if (!groupDetail?.group_members) return false;
    
    const nonCreatorMembers = groupDetail.group_members.filter(
      (member: GroupMember) => member.user_id !== groupDetail.created_by
    );
    
    return nonCreatorMembers.length > 0 && nonCreatorMembers.every(
      (member: GroupMember) => member.is_paid
    );
  };

  const handleCloseGroup = () => {
    Alert.alert(
      'Grubu Kapat',
      'Bu grubu kapatmak istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Grubu Kapat', 
          style: 'destructive',
          onPress: deleteGroup
        }
      ]
    );
  };

  const deleteGroup = async () => {
    if (!groupId) return;

    try {
      const { error } = await groupService.deleteGroup(groupId.toString());
      if (error) throw error;

      Alert.alert(
        'Başarılı', 
        'Grup başarıyla kapatıldı',
        [
          {
            text: 'Tamam',
            onPress: () => router.back()
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Grup kapatılırken hata oluştu');
      console.error('Delete group error:', error);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupDetail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Grup bulunamadı</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{groupDetail.name}</Text>
        <TouchableOpacity>
          <Text style={styles.menuButton}>⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Group Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.descriptionText}>{groupDetail.description || 'Açıklama yok'}</Text>
          
          {(() => {
            // Calculate totals from group_members data
            const members = groupDetail.group_members || [];
            const totalAmount = members.reduce((sum: number, member: GroupMember) => sum + (member.amount_owed || 0), 0);
            const paidAmount = members
              .filter((member: GroupMember) => member.is_paid)
              .reduce((sum: number, member: GroupMember) => sum + (member.amount_owed || 0), 0);
            const pendingAmount = totalAmount - paidAmount;
            const completionPercentage = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

            return (
              <>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Toplam Tutar</Text>
                    <Text style={styles.summaryTotalAmount}>₺{totalAmount.toFixed(2)}</Text>
                  </View>
                  
                  <View style={[styles.summaryCard, styles.summaryCardMiddle]}>
                    <Text style={styles.summaryLabel}>Toplanan</Text>
                    <Text style={styles.summaryPaidAmount}>₺{paidAmount.toFixed(2)}</Text>
                  </View>
                  
                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Kalan</Text>
                    <Text style={styles.summaryPendingAmount}>₺{pendingAmount.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressSection}>
                  <View style={styles.progressBarBackground}>
                    <View 
                      style={[styles.progressBarFill, { width: `${completionPercentage}%` }]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {completionPercentage}% tamamlandı
                  </Text>
                </View>
              </>
            );
          })()}
        </View>

        {/* Members List */}
        <View style={styles.membersSection}>
          <View style={styles.membersSectionHeader}>
            <Text style={styles.membersSectionTitle}>
              Grup Üyeleri ({groupDetail.group_members?.length || 0})
            </Text>
            <TouchableOpacity
              style={styles.addMemberButton}
              onPress={openContactModal}
            >
              <Text style={styles.addMemberButtonText}>Üye Ekle</Text>
            </TouchableOpacity>
          </View>
          
          {groupDetail.group_members?.map((member: GroupMember, index: number) => {
            const isGroupCreator = member.user_id === groupDetail.created_by;
            
            return (
              <View 
                key={member.id}
                style={[styles.memberCard, index === (groupDetail.group_members?.length || 0) - 1 && styles.memberCardLast]}
              >
                {/* Member Info */}
                <View style={styles.memberInfo}>
                  <View style={styles.memberInfoLeft}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{isGroupCreator ? '👑' : '👤'}</Text>
                    </View>
                    <View style={styles.memberDetails}>
                      <Text style={styles.memberName}>
                        {member.profiles?.full_name || 'Kullanıcı'}
                        {isGroupCreator && (
                          <Text style={styles.memberOwnerLabel}> (Grup Sahibi)</Text>
                        )}
                      </Text>
                      {!isGroupCreator && (
                        <Text style={styles.memberDebt}>
                          Borç: ₺{member.amount_owed || 0}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View style={styles.memberInfoRight}>
                    {isGroupCreator ? (
                      <Text style={styles.memberOwnerStatus}>
                        Grup Sahibi
                      </Text>
                    ) : (
                      <>
                        <Text style={[styles.memberStatus, member.is_paid ? styles.memberStatusPaid : styles.memberStatusUnpaid]}>
                          {member.is_paid ? '✓ Ödendi' : `₺${member.amount_owed || 0}`}
                        </Text>
                        <Text style={styles.memberEmail}>
                          {member.profiles?.email || ''}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Action Buttons */}
                {!isGroupCreator && !member.is_paid && (
                  <View style={styles.actionButtons}>
                    {/* Grup sahibi herkesi işaretleyebilir, normal üye sadece kendisini */}
                    {(user?.id === groupDetail.created_by || member.user_id === user?.id) && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.markPaidButton]}
                        onPress={() => handleMarkAsPaid(member.id)}
                      >
                        <Text style={styles.markPaidButtonText}>Ödendi Olarak İşaretle</Text>
                      </TouchableOpacity>
                    )}
                    {/* Sadece grup sahibi hatırlat gönderebilir */}
                    {user?.id === groupDetail.created_by && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.reminderButton]}
                        onPress={() => handleSendReminder(member.id)}
                      >
                        <Text style={styles.reminderButtonText}>Hatırlat</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Close Group Button - Only show when all members are paid */}
        {areAllMembersPaid() && (
          <View style={styles.closeGroupSection}>
            <TouchableOpacity
              style={styles.closeGroupButton}
              onPress={handleCloseGroup}
            >
              <Text style={styles.closeGroupButtonText}>Grubu Kapat</Text>
            </TouchableOpacity>
            <Text style={styles.closeGroupNote}>
              Tüm ödemeler tamamlandı. Grubu kapatabilirsiniz.
            </Text>
          </View>
        )}

      </ScrollView>

      {/* Contact Selection Modal - WhatsApp Style */}
      <Modal
        visible={showContactModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <SafeAreaView style={styles.modalHeaderContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setShowContactModal(false);
                setSearchQuery('');
                setSelectedContacts([]);
              }}>
                <Text style={styles.modalBackButton}>←</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                Üye Ekle ({selectedContacts.length})
              </Text>
              <TouchableOpacity 
                onPress={handleAddMembers}
                style={[styles.modalAddButton, selectedContacts.length === 0 && styles.modalAddButtonDisabled]}
                disabled={selectedContacts.length === 0}
              >
                <Text style={styles.modalAddButtonText}>Ekle</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Selected Contacts Header - WhatsApp Style */}
          {selectedContacts.length > 0 && (
            <View style={styles.selectedContactsHeader}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.selectedContactsRow}>
                  {selectedContacts.map((contact) => (
                    <View key={contact.id} style={styles.selectedContactItem}>
                      <View style={styles.selectedContactWrapper}>
                        <View style={styles.selectedContactAvatar}>
                          <Text style={styles.selectedContactAvatarText}>{contact.avatar}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeContact(contact.id)}
                          style={styles.removeSelectedContactButton}
                        >
                          <Text style={styles.removeSelectedContactButtonText}>×</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.selectedContactName} numberOfLines={1}>
                        {contact.name.split(' ')[0]}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Search Bar */}
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <View style={styles.searchIconContainer}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              </View>
              <TextInput
                style={styles.searchInput}
                placeholder="Kişi ara..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Contact List */}
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = selectedContacts.some(contact => contact.id === item.id);
              return (
                <TouchableOpacity
                  onPress={() => handleContactSelect(item)}
                  style={styles.contactItem}
                  disabled={isSelected}
                >
                  <View style={styles.contactItemContent}>
                    <View style={styles.contactItemAvatar}>
                      <Text style={styles.contactItemAvatarText}>{item.avatar}</Text>
                    </View>
                    <View style={styles.contactItemInfo}>
                      <Text style={[styles.contactItemName, isSelected && styles.contactItemNameSelected]}>
                        {item.name}
                      </Text>
                      <Text style={styles.contactItemPhone}>{item.phone}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedIndicator}>
                        <Text style={styles.selectedIndicatorText}>✓</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>
                  {searchQuery ? 'Aradığınız kişi bulunamadı' : 'Tüm kişiler zaten grup üyesi'}
                </Text>
              </View>
            )}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
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
  },
  backButton: {
    color: '#4b5563',
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  menuButton: {
    color: '#4b5563',
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 85,
    flexGrow: 1,
  },
  summarySection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  descriptionText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
  },
  summaryCardMiddle: {
    paddingHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryTotalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  summaryPaidAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  summaryPendingAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#dc2626',
  },
  progressSection: {
    marginTop: 16,
  },
  progressBarBackground: {
    width: '100%',
    height: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
  },
  progressBarFill: {
    height: 12,
    backgroundColor: '#22c55e',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  membersSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  membersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  membersSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  addMemberButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addMemberButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  memberCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  memberCardLast: {
    marginBottom: 0,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  memberInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 20,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  memberOwnerLabel: {
    fontSize: 14,
    color: '#2563eb',
    marginLeft: 8,
  },
  memberDebt: {
    fontSize: 14,
    color: '#6b7280',
  },
  memberInfoRight: {
    alignItems: 'flex-end',
  },
  memberOwnerStatus: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  memberStatus: {
    fontSize: 18,
    fontWeight: '700',
  },
  memberStatusPaid: {
    color: '#059669',
  },
  memberStatusUnpaid: {
    color: '#dc2626',
  },
  memberEmail: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  markPaidButton: {
    backgroundColor: '#059669',
  },
  markPaidButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  reminderButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  reminderButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
  },
  closeGroupSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  closeGroupButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeGroupButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeGroupNote: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeaderContainer: {
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  modalBackButton: {
    color: '#111827',
    fontSize: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalAddButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  modalAddButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  modalAddButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedContactsHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedContactsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectedContactItem: {
    alignItems: 'center',
  },
  selectedContactWrapper: {
    position: 'relative',
  },
  selectedContactAvatar: {
    width: 56,
    height: 56,
    backgroundColor: '#f3f4f6',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedContactAvatarText: {
    fontSize: 20,
  },
  removeSelectedContactButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeSelectedContactButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  selectedContactName: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
    maxWidth: 50,
    textAlign: 'center',
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchIconContainer: {
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 16,
    fontSize: 16,
    color: '#111827',
  },
  contactItem: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  contactItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactItemAvatar: {
    width: 48,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactItemAvatarText: {
    fontSize: 20,
  },
  contactItemInfo: {
    flex: 1,
  },
  contactItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  contactItemNameSelected: {
    color: '#9ca3af',
  },
  contactItemPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIndicatorText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyListContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyListText: {
    color: '#6b7280',
    fontSize: 16,
  },
});
