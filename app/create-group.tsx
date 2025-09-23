import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import '../global.css';
import { friendService, groupMemberService, groupService } from '../services/api';

// Arkadaş listesi Supabase'ten gelir (AddDebtScreen ile aynı mantık)
type FriendItem = { id: string; name: string; phone: string; avatar: string; email?: string };

type Contact = {
  id: string;
  name: string;
  phone: string;
  avatar: string;
  email: string;
};

type ContactWithAmount = Contact & {
  amount: string;
};

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<ContactWithAmount[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);

  // Arkadaş listesini yükle - sayfa her görüntülendiğinde yenile
  useFocusEffect(
    useCallback(() => {
      const loadFriends = async () => {
        if (!user) return;
        console.log('🔄 Refreshing friends list in create-group screen');
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
    }, [user])
  );

  // AddDebtScreen'deki kişi arama davranışıyla aynı
  const filteredContacts = friends.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         contact.phone.includes(searchQuery);
    const isNotSelected = !selectedContacts.some(selected => selected.id === contact.id);
    return matchesSearch && isNotSelected;
  });

  const handleContactSelect = (contact: any) => {
    if (selectedContacts.some(selected => selected.id === contact.id)) return;
    
    const contactWithAmount: ContactWithAmount = { ...contact, amount: '' } as ContactWithAmount;
    setSelectedContacts([...selectedContacts, contactWithAmount]);
  };

  const removeContact = (contactId: string) => {
    setSelectedContacts(selectedContacts.filter(contact => contact.id !== contactId));
  };

  const updateContactAmount = (contactId: string, amount: string) => {
    setSelectedContacts(selectedContacts.map(contact => 
      contact.id === contactId ? { ...contact, amount } : contact
    ));
  };

  const openContactModal = () => {
    setShowContactModal(true);
  };

  // Girilen tutarların toplamını hesapla
  const getEnteredTotal = () => {
    return selectedContacts.reduce((sum, contact) => {
      const amount = parseFloat(contact.amount) || 0;
      return sum + amount;
    }, 0);
  };

  const calculateEqualSplit = () => {
    const total = parseFloat(totalAmount);
    if (!isNaN(total) && selectedContacts.length > 0) {
      const perPerson = (total / selectedContacts.length).toFixed(2);
      // Tüm kişilere eşit tutarı ata
      setSelectedContacts(selectedContacts.map(contact => ({
        ...contact,
        amount: perPerson
      })));
      
      Alert.alert(
        'Eşit Bölme', 
        `Toplam ${total}₺ ${selectedContacts.length} kişiye eşit bölündü. Kişi başı: ${perPerson}₺`
      );
    }
  };

  const handleCreateGroup = () => {
    // Validation
    if (!groupName.trim()) {
      Alert.alert('Hata', 'Grup adı gerekli');
      return;
    }
    
    if (!totalAmount.trim()) {
      Alert.alert('Hata', 'Toplam tutar gerekli');
      return;
    }

    // En az iki kişi (siz + en az 1 kişi)
    if (selectedContacts.length < 1) {
      Alert.alert('Hata', 'Grup en az iki kişiyle kurulabilir (siz + en az 1 kişi)');
      return;
    }

    // Tüm üyelerin tutar girişi kontrol
    const contactsWithoutAmount = selectedContacts.filter(contact => !contact.amount.trim() || parseFloat(contact.amount) <= 0);
    if (contactsWithoutAmount.length > 0) {
      Alert.alert('Hata', 'Tüm üyeler için geçerli tutar girilmeli');
      return;
    }

    // Toplam tutar kontrolü
    const enteredTotal = getEnteredTotal();
    const expectedTotal = parseFloat(totalAmount);
    
    if (Math.abs(enteredTotal - expectedTotal) > 0.01) { // 1 kuruş tolerans
      Alert.alert(
        'Tutar Uyumsuzluğu', 
        `Girilen toplam tutar (${enteredTotal.toFixed(2)}₺) beklenen tutarla (${expectedTotal.toFixed(2)}₺) eşleşmiyor.\n\nDevam etmek istiyor musunuz?`,
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Devam Et', onPress: () => createGroup() }
        ]
      );
      return;
    }

    createGroup();
  };

  const createGroup = async () => {
    if (!user) {
      Alert.alert('Hata', 'Oturum açmalısınız.');
      return;
    }

    setLoading(true);
    try {
      // 1. Grubu oluştur
      const { data: group, error: groupError } = await groupService.createGroup({
        name: groupName,
        description: description || null,
        created_by: user.id,
      });

      if (groupError || !group) {
        throw new Error(groupError?.message || 'Grup oluşturulurken hata oluştu');
      }

      // 2. Grup üyelerini ekle (grup oluşturan + seçilen kişiler)
      const memberInserts = [
        // Grup oluşturan kişiyi ekle (amount_owed = 0, grup sahibi)
        {
          group_id: group.id,
          user_id: user.id,
          amount_owed: 0,
        },
        // Seçilen kişileri ekle (amount_owed = girilen tutar)
        ...selectedContacts.map(contact => ({
          group_id: group.id,
          user_id: contact.id,
          amount_owed: parseFloat(contact.amount) || 0,
        }))
      ];

      // 3. Grup üyelerini ekle
      const { error: membersError } = await groupMemberService.addMembers(memberInserts);

      if (membersError) {
        // Grup oluşturuldu ama üyeler eklenemedi, grubu sil
        await groupService.deleteGroup(group.id);
        throw new Error(membersError.message || 'Grup üyeleri eklenirken hata oluştu');
      }

      Alert.alert(
        'Başarılı!', 
        'Grup başarıyla oluşturuldu', 
        [
          {
            text: 'Tamam',
            onPress: () => {
              // Gruplar ekranına dön
              router.push('/(tabs)/groups');
            }
          }
        ]
      );

    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Grup oluşturulurken beklenmeyen bir hata oluştu');
      console.error('Create group error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backButton, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yeni Grup</Text>
        <View style={styles.headerSpacer}></View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Group Info Section */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Grup Bilgileri</Text>
          
          {/* Group Name */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Grup Adı *</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Örn: Tahoe Gezisi"
              placeholderTextColor={colors.placeholder}
              value={groupName}
              onChangeText={setGroupName}
            />
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Açıklama</Text>
            <TextInput
              style={[styles.textInput, styles.textAreaInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Grubun ne için olduğunu açıklayın"
              placeholderTextColor={colors.placeholder}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Total Amount */}
          <View style={styles.inputGroupLast}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Toplam Tutar (₺) *</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={[styles.textInput, styles.amountInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                value={totalAmount}
                onChangeText={setTotalAmount}
                keyboardType="numeric"
              />
              <TouchableOpacity
                onPress={calculateEqualSplit}
                disabled={selectedContacts.length === 0}
                style={[styles.equalSplitButton, selectedContacts.length === 0 ? styles.equalSplitButtonDisabled : styles.equalSplitButtonActive]}
              >
                <Text style={[styles.equalSplitButtonText, selectedContacts.length === 0 ? styles.equalSplitButtonTextDisabled : styles.equalSplitButtonTextActive]}>
                  Eşit Böl
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Members Section - WhatsApp Style */}
        <View style={[styles.membersSection, { backgroundColor: colors.card }]}>
          <View style={styles.membersSectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Katılımcılar ({selectedContacts.length})
            </Text>
            <TouchableOpacity
              onPress={openContactModal}
              style={[styles.addMemberButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.addMemberButtonText, { color: colors.primaryText }]}>+ Ekle</Text>
            </TouchableOpacity>
          </View>

          {/* Selected Contacts - WhatsApp Style Header */}
          {selectedContacts.length > 0 && (
            <View style={styles.selectedContactsSection}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarScrollView}>
                <View style={styles.avatarRow}>
                  {selectedContacts.map((contact) => (
                    <View key={contact.id} style={styles.avatarContainer}>
                      <View style={styles.avatarWrapper}>
                        <View style={styles.avatarCircle}>
                          <Text style={styles.avatarText}>{contact.avatar}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeContact(contact.id)}
                          style={styles.removeAvatarButton}
                        >
                          <Text style={styles.removeAvatarButtonText}>×</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.avatarName} numberOfLines={1}>
                        {contact.name.split(' ')[0]}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Selected Members List with Amount Input */}
              <View style={styles.membersList}>
                <View style={styles.membersListHeader}>
                  <Text style={[styles.membersListTitle, { color: colors.text }]}>Seçilen Katılımcılar:</Text>
                  <Text style={[styles.membersListTotal, { color: colors.textSecondary }]}>
                    Toplam: {getEnteredTotal().toFixed(2)}₺ / {totalAmount || '0'}₺
                  </Text>
                </View>
                {selectedContacts.map((contact, index) => (
                  <View key={contact.id} style={[styles.memberItem, { backgroundColor: colors.surface }]}>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberInfoRow}>
                        <Text style={styles.memberAvatar}>{contact.avatar}</Text>
                        <View style={styles.memberDetails}>
                          <Text style={[styles.memberName, { color: colors.text }]}>{contact.name}</Text>
                          <Text style={[styles.memberPhone, { color: colors.textSecondary }]}>{contact.phone}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeContact(contact.id)}
                        style={[styles.removeMemberButton, { backgroundColor: colors.error }]}
                      >
                        <Text style={[styles.removeMemberButtonText, { color: 'white' }]}>×</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Amount Input for each contact */}
                    <View style={styles.amountInputContainer}>
                      <View style={[styles.amountInputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                        <Text style={[styles.currencyLabel, { color: colors.text }]}>₺</Text>
                        <TextInput
                          style={[styles.memberAmountInput, { color: colors.text }]}
                          placeholder="0.00"
                          placeholderTextColor={colors.placeholder}
                          value={contact.amount}
                          onChangeText={(value) => updateContactAmount(contact.id, value)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {selectedContacts.length === 0 && (
            <View style={[styles.emptyContainer, { backgroundColor: colors.surface }]}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Henüz katılımcı eklenmedi{'\n'}Grup oluşturmak için en az 1 kişi seçin{'\n'}(Grup en az 2 kişiden oluşmalıdır)
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtonsSection}>
          <TouchableOpacity
            onPress={handleCreateGroup}
            disabled={loading}
            style={[styles.createButton, { backgroundColor: '#111827' }, loading && styles.createButtonDisabled]}
          >
            <Text style={[styles.createButtonText, { color: 'white' }]}>
              {loading ? 'Oluşturuluyor...' : 'Grubu Oluştur'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.cancelButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>İptal</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Contact Selection Modal */}
      <Modal
        visible={showContactModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <SafeAreaView style={[styles.modalHeaderContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.background }]}>
              <TouchableOpacity onPress={() => {
                setShowContactModal(false);
                setSearchQuery('');
              }}>
                <Text style={[styles.modalBackButton, { color: colors.text }]}>←</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Katılımcı Ekle ({selectedContacts.length})
              </Text>
              <TouchableOpacity 
                onPress={() => setShowContactModal(false)}
                style={[styles.modalDoneButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalDoneButtonText, { color: colors.primaryText }]}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Selected Contacts Header - WhatsApp Style */}
          {selectedContacts.length > 0 && (
            <View style={[styles.selectedContactsHeader, { backgroundColor: colors.surface }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.selectedContactsHeaderRow}>
                  {selectedContacts.map((contact) => (
                    <View key={contact.id} style={styles.selectedContactHeaderItem}>
                      <View style={styles.selectedContactHeaderWrapper}>
                        <View style={[styles.selectedContactHeaderAvatar, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.selectedContactHeaderAvatarText, { color: colors.primaryText }]}>{contact.avatar}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeContact(contact.id)}
                          style={[styles.removeSelectedContactButton, { backgroundColor: colors.error }]}
                        >
                          <Text style={[styles.removeSelectedContactButtonText, { color: 'white' }]}>×</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.selectedContactHeaderName, { color: colors.text }]} numberOfLines={1}>
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
            <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
              <View style={styles.searchIconContainer}>
                <Ionicons name="search-outline" size={18} color={colors.iconSecondary} />
              </View>
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Kişi ara..."
                placeholderTextColor={colors.placeholder}
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
                  style={[styles.contactItem, { backgroundColor: colors.card }]}
                  disabled={isSelected}
                >
                  <View style={styles.contactItemContent}>
                    <View style={[styles.contactItemAvatar, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.contactItemAvatarText, { color: colors.primaryText }]}>{item.avatar}</Text>
                    </View>
                    <View style={styles.contactItemInfo}>
                      <Text style={[styles.contactItemName, { color: colors.text }, isSelected && styles.contactItemNameSelected]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.contactItemPhone, { color: colors.textSecondary }]}>{item.phone}</Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.selectedIndicator, { backgroundColor: colors.success }]}>
                        <Text style={[styles.selectedIndicatorText, { color: 'white' }]}>✓</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View style={styles.emptyListContainer}>
                <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                  {searchQuery ? 'Aradığınız kişi bulunamadı' : 'Henüz arkadaş eklenmemiş'}
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  backButton: {
    color: '#6b7280',
    fontSize: 24,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 85,
    flexGrow: 1,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupLast: {
    marginBottom: 0,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#111827',
  },
  textAreaInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    flex: 1,
    marginRight: 12,
  },
  equalSplitButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  equalSplitButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  equalSplitButtonActive: {
    backgroundColor: '#2563eb',
  },
  equalSplitButtonText: {
    fontWeight: '500',
  },
  equalSplitButtonTextDisabled: {
    color: '#6b7280',
  },
  equalSplitButtonTextActive: {
    color: '#ffffff',
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
  addMemberButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addMemberButtonText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  emptyContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 18,
    color: '#9ca3af',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtonsSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  createButton: {
    paddingVertical: 16,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    marginBottom: 12,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
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
  modalDoneButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  modalDoneButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  selectedContactsSection: {
    marginBottom: 16,
  },
  avatarScrollView: {
    marginBottom: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 16,
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    backgroundColor: '#f3f4f6',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
  },
  removeAvatarButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAvatarButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  avatarName: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
    maxWidth: 60,
    textAlign: 'center',
  },
  membersList: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  membersListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  membersListTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  membersListTotal: {
    fontSize: 12,
    color: '#6b7280',
  },
  memberItem: {
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  memberInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    fontSize: 18,
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  memberPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  removeMemberButton: {
    width: 32,
    height: 32,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  removeMemberButtonText: {
    color: '#dc2626',
    fontSize: 18,
  },
  amountInputContainer: {
    marginTop: 8,
    marginLeft: 32,
  },
  amountInputWrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyLabel: {
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  memberAmountInput: {
    flex: 1,
    paddingVertical: 8,
    paddingRight: 12,
    fontSize: 14,
    color: '#111827',
  },
  selectedContactsHeader: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectedContactsHeaderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  selectedContactHeaderItem: {
    alignItems: 'center',
  },
  selectedContactHeaderWrapper: {
    position: 'relative',
  },
  selectedContactHeaderAvatar: {
    width: 56,
    height: 56,
    backgroundColor: '#f3f4f6',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedContactHeaderAvatarText: {
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
  selectedContactHeaderName: {
    fontSize: 12,
    color: '#4b5563',
    marginTop: 4,
    maxWidth: 50,
    textAlign: 'center',
  },
});