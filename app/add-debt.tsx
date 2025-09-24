import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import '../global.css';
import { isSupabaseConfigured } from '../lib/supabase';
import { debtService, friendService, notificationService, utilService } from '../services/api';

// Mock contact list - gerçek uygulamada kişi listesi API'den gelecek
const mockContacts = [
  { id: '1', name: 'Ahmet Yılmaz', phone: '+90 555 123 4567', avatar: '👨' },
  { id: '2', name: 'Ayşe Kaya', phone: '+90 555 987 6543', avatar: '👩' },
  { id: '3', name: 'Mehmet Demir', phone: '+90 555 555 1234', avatar: '👨' },
  { id: '4', name: 'Fatma Özkan', phone: '+90 555 777 8899', avatar: '👩' },
  { id: '5', name: 'Ali Şahin', phone: '+90 555 444 5566', avatar: '👨' },
  { id: '6', name: 'Zeynep Çelik', phone: '+90 555 333 2211', avatar: '👩' },
];

export default function AddDebtScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [debtType, setDebtType] = useState<'owe' | 'owed'>('owed'); // 'owe' = alacak, 'owed' = verecek
  const [selectedContact, setSelectedContact] = useState<{id: string; name: string; phone: string; avatar: string} | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('Genel');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5)); // HH:MM
  const [showContactModal, setShowContactModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Arkadaş listesini yükle - sayfa her görüntülendiğinde yenile
  useFocusEffect(
    useCallback(() => {
      if (user) {
        console.log('🔄 Refreshing friends list in add-debt screen');
        loadFriends();
      }
    }, [user])
  );

  const loadFriends = async () => {
    if (!user) return;
    
    try {
      if (!isSupabaseConfigured) {
        console.warn('Supabase not configured, using mock friends');
        // Mock friends data for testing
        setFriends(mockContacts.map(contact => ({
          id: contact.id,
          full_name: contact.name,
          phone: contact.phone,
          email: `${contact.name.toLowerCase().replace(' ', '.')}@example.com`
        })));
        return;
      }

      console.log('🔍 Loading friends for user:', user.id);
      const { data, error } = await friendService.getFriends(user.id);
      console.log('🔍 Friends API result:', { data, error });
      
      if (error) {
        console.error('❌ Friends loading error:', error);
        throw error;
      }
      
      if (data) {
        console.log('✅ Setting friends:', data.length, 'friends found');
        setFriends(data);
      } else {
        console.log('⚠️ No friends data received');
        setFriends([]);
      }
    } catch (error) {
      console.error('❌ Friends loading catch error:', error);
      // Fallback to mock data on error
      setFriends(mockContacts.map(contact => ({
        id: contact.id,
        full_name: contact.name,
        phone: contact.phone,
        email: `${contact.name.toLowerCase().replace(' ', '.')}@example.com`
      })));
    }
  };

  const categories = [
    'Genel', 'Yemek', 'Ulaşım', 'Eğlence', 'Alışveriş', 
    'Kira', 'Faturalar', 'Sağlık', 'Eğitim', 'Diğer'
  ];

  // Filter friends based on search query
  const filteredContacts = friends.filter(friend =>
    friend.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.phone?.includes(searchQuery)
  ).map(friend => ({
    id: friend.id,
    name: friend.full_name || friend.email,
    phone: friend.phone || 'Telefon yok',
    avatar: '👤' // Gerçek uygulamada avatar_url kullanılacak
  }));

  const handleContactSelect = (contact: typeof mockContacts[0]) => {
    setSelectedContact(contact);
    setShowContactModal(false);
    setSearchQuery('');
  };

  const handleSaveDebt = async () => {
    if (!user) {
      Alert.alert('Hata', 'Oturum açmalısınız.');
      return;
    }

    if (!selectedContact) {
      Alert.alert('Hata', 'Lütfen bir kişi seçin.');
      return;
    }

    if (!amount.trim() || parseFloat(amount) <= 0) {
      Alert.alert('Hata', 'Lütfen geçerli bir tutar girin.');
      return;
    }

    setLoading(true);
    try {
      if (!isSupabaseConfigured) {
        Alert.alert(
          'Demo Modu',
          'Supabase yapılandırılmamış. Bu demo modda çalışıyor.',
          [{ text: 'Tamam', onPress: () => router.back() }]
        );
        return;
      }

      // Arkadaş kontrolü yap
      const isFriend = friends.some(friend => friend.id === selectedContact.id);
      
      if (!isFriend) {
        // Arkadaş değilse WhatsApp ile mesaj gönder
        Alert.alert(
          'Arkadaş Değil',
          `${selectedContact.name} arkadaş listenizde yok. WhatsApp ile borç bilgisini göndermek ister misiniz?`,
          [
            { text: 'İptal', style: 'cancel' },
            { 
              text: 'WhatsApp Gönder', 
              onPress: async () => {
                const { whatsappUrl } = await utilService.sendWhatsAppInvite(
                  selectedContact.phone,
                  user.email || 'Biri',
                  parseFloat(amount),
                  description || ''
                );
                
                try {
                  await Linking.openURL(whatsappUrl);
                  Alert.alert(
                    'Mesaj Gönderildi',
                    'WhatsApp mesajı gönderildi. Kişi uygulamaya kaydolduğunda borç otomatik olarak eklenecek.',
                    [{ text: 'Tamam', onPress: () => router.back() }]
                  );
                } catch (error) {
                  Alert.alert('Hata', 'WhatsApp açılamadı. WhatsApp yüklü olduğundan emin olun.');
                }
              }
            }
          ]
        );
        return;
      }

      // Arkadaşsa debt kaydı oluştur
      const amountValue = parseFloat(amount);
      const iBorrowed = debtType === 'owed'; // 'owed' = borç aldım (ben borçluyum)
      const youWillReceive = debtType === 'owe' ? amountValue : 0; // borç verdiysem alacağım (yeşil)
      const youWillGive = iBorrowed ? amountValue : 0;    // borç aldıysam vereceğim (kırmızı)

      const payload = {
        creditor_id: iBorrowed ? selectedContact.id : user.id,   // borç aldım → karşı taraf alacaklı
        debtor_id: iBorrowed ? user.id : selectedContact.id,      // borç aldım → ben borçluyum
        youwillreceive: youWillReceive,
        youwillgive: youWillGive,
        description: description || null,
        group_id: null as string | null,
        pay_date: new Date(`${date}T${time}:00`).toISOString(),
      };

      // Her iki kullanıcı için de ayrı kayıt oluştur
      console.log('🔍 Creditor payload:', payload);
      const { data: creditorData, error: creditorError } = await debtService.createDebt(payload);

      if (creditorError) {
        throw new Error(creditorError.message || 'Borç kaydedilirken hata oluştu');
      }

      // Karşı taraf için de kayıt oluştur
      const debtorPayload = {
        creditor_id: payload.debtor_id,
        debtor_id: payload.creditor_id,
        youwillreceive: youWillGive ,  // Karşı taraf alacaklı değil
        youwillgive: youWillReceive,  // Karşı taraf borçlu
        description: payload.description,
        group_id: payload.group_id,
        pay_date: payload.pay_date,
      };

      console.log('🔍 Debtor payload:', debtorPayload);
      const { data: debtorData, error: debtorError } = await debtService.createDebt(debtorPayload);

      if (debtorError) {
        console.warn('Karşı taraf için borç kaydı oluşturulamadı:', debtorError);
        // Bu hata borç oluşturmayı engellemez
      }

      const data = creditorData; // Ana kayıt olarak creditor'ın kaydını kullan
      

      // Karşı tarafa bildirim gönder
      try {
        // Bildirim gönderilecek kişi: her zaman seçilen kişi
        const otherUserId = selectedContact.id;
        const otherUserName = selectedContact.name;
        const currentUserName = user.email || 'Biri';
        const amountText = `₺${parseFloat(amount).toFixed(2)}`;
        
        console.log('Bildirim gönderiliyor:', {
          otherUserId,
          otherUserName,
          currentUserName,
          debtType,
          amountText,
          debtId: data.id
        });
        
        const notificationResult = await notificationService.createNotification({
          user_id: otherUserId,
          title: 'Yeni Borç Kaydı',
          message: iBorrowed
            ? `${currentUserName} sizden ${amountText} borç aldı.`
            : `${currentUserName} size ${amountText} borç verdi.`,
          type: 'debt_created',
          data: {
            debt_id: data.id,
            creditor_id: payload.creditor_id,
            debtor_id: payload.debtor_id,
            amount: parseFloat(amount),
            description: description || null
          }
        });
        
        if (notificationResult.error) {
          throw new Error(notificationResult.error.message || 'Bildirim oluşturulamadı');
        }
        
        console.log('Bildirim başarıyla gönderildi:', notificationResult.data);
      } catch (notificationError) {
        console.error('Bildirim gönderilemedi:', notificationError);
        // Bildirim hatası borç oluşturmayı engellemez
        Alert.alert(
          'Uyarı', 
          'Borç kaydedildi ancak bildirim gönderilemedi. Bildirim ayarlarınızı kontrol edin.'
        );
      }

      Alert.alert(
        'Başarılı!',
        'Borç başarıyla kaydedildi.',
        [{ text: 'Tamam', onPress: () => router.back() }]
      );

    } catch (error: any) {
      Alert.alert('Hata', error.message || 'Beklenmeyen bir hata oluştu');
      console.error('Save debt error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <SafeAreaView style={[styles.headerContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Borç Ekle</Text>
          <View style={styles.headerSpacer}></View>
        </View>
      </SafeAreaView>

      <ScrollView style={[styles.scrollView, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
        {/* Debt Type Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>İşlem Türü</Text>
          <View style={styles.debtTypeContainer}>
            <TouchableOpacity 
              onPress={() => setDebtType('owe')}
              style={[styles.debtTypeButton, { backgroundColor: colors.card }, debtType === 'owe' ? [styles.debtTypeButtonOwed, { backgroundColor: colors.primary }] : styles.debtTypeButtonInactive]}
            >
              <View style={styles.debtTypeContent}>
                <Text style={styles.debtTypeIcon}>💳</Text>
                <Text style={[styles.debtTypeTitle, debtType === 'owe' ? [styles.debtTypeTitleOwed, { color: colors.primaryText }] : { color: colors.text }]}>
                  Borç Aldım
                </Text>
                <Text style={[styles.debtTypeSubtitle, debtType === 'owe' ? [styles.debtTypeSubtitleOwed, { color: colors.primaryText }] : { color: colors.textSecondary }]}>
                  Birinden borç aldım
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setDebtType('owed')}
              style={[styles.debtTypeButton, { backgroundColor: colors.card }, debtType === 'owed' ? [styles.debtTypeButtonOwe, { backgroundColor: colors.primary }] : styles.debtTypeButtonInactive]}
            >
              <View style={styles.debtTypeContent}>
                <Text style={styles.debtTypeIcon}>💰</Text>
                <Text style={[styles.debtTypeTitle, debtType === 'owed' ? [styles.debtTypeTitleOwe, { color: colors.primaryText }] : { color: colors.text }]}>
                  Borç Verdim
                </Text>
                <Text style={[styles.debtTypeSubtitle, debtType === 'owed' ? [styles.debtTypeSubtitleOwe, { color: colors.primaryText }] : { color: colors.textSecondary }]}>
                  Birine borç verdim
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Selection */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {debtType === 'owed' ? 'Kimden aldınız?' : 'Kime verdiniz?'}
          </Text>
          <TouchableOpacity 
            onPress={() => setShowContactModal(true)}
            style={[styles.contactSelector, { backgroundColor: colors.card }]}
          >
            {selectedContact ? (
              <View style={styles.contactSelectorContent}>
                <Text style={styles.contactAvatar}>{selectedContact.avatar}</Text>
                <View style={styles.contactInfo}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{selectedContact.name}</Text>
                  <Text style={[styles.contactPhone, { color: colors.textSecondary }]}>{selectedContact.phone}</Text>
                </View>
                <Text style={[styles.contactArrow, { color: colors.textSecondary }]}>→</Text>
              </View>
            ) : (
              <View style={styles.contactSelectorPlaceholder}>
                <Text style={[styles.contactPlaceholderText, { color: colors.textSecondary }]}>Kişi seçin...</Text>
                <Text style={[styles.contactArrow, { color: colors.textSecondary }]}>→</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tutar</Text>
          <View style={[styles.amountContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.currencySymbol, { color: colors.text }]}>₺</Text>
            <TextInput
              style={[styles.amountInput, { color: colors.text }]}
              placeholder="0.00"
              placeholderTextColor={colors.placeholder}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Description */}
        <View style={styles.sectionLast}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Açıklama (İsteğe bağlı)</Text>
          <View style={[styles.descriptionContainer, { backgroundColor: colors.card }]}>
            <TextInput
              style={[styles.descriptionInput, { color: colors.text }]}
              placeholder="Borç ile ilgili detaylar..."
              placeholderTextColor={colors.placeholder}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            onPress={handleSaveDebt}
            disabled={loading}
            style={[styles.saveButton, { backgroundColor: colors.primary }, loading && styles.saveButtonDisabled]}
          >
            <Text style={[styles.saveButtonText, { color: colors.primaryText }]}>
              {loading ? 'Kaydediliyor...' : 'Borcu Kaydet'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bottom space for navigation */}
        <View style={styles.bottomSpacer}></View>
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
              <TouchableOpacity onPress={() => setShowContactModal(false)}>
                <Text style={[styles.modalBackButton, { color: colors.text }]}>←</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Kişi Seç</Text>
              <View style={styles.headerSpacer}></View>
            </View>
          </SafeAreaView>

          {/* Search Bar */}
          <View style={[styles.searchSection, { backgroundColor: colors.surface }]}>
            <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
              <View style={styles.searchIconContainer}>
                <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
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
            style={{ backgroundColor: colors.background }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleContactSelect(item)}
                style={[styles.contactItem, { backgroundColor: colors.card }]}
              >
                <View style={styles.contactItemContent}>
                  <View style={styles.contactItemAvatar}>
                    <Text style={styles.contactItemAvatarText}>{item.avatar}</Text>
                  </View>
                  <View style={styles.contactItemInfo}>
                    <Text style={[styles.contactItemName, { color: colors.text }]}>{item.name}</Text>
                    <Text style={[styles.contactItemPhone, { color: colors.textSecondary }]}>{item.phone}</Text>
                  </View>
                  {selectedContact?.id === item.id && (
                    <Text style={[styles.contactItemSelected, { color: colors.primary }]}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyListContainer}>
                <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>Kişi bulunamadı</Text>
              </View>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    // backgroundColor will be set dynamically
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  backButton: {
    fontSize: 24,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  sectionLast: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  debtTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  debtTypeButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  debtTypeButtonInactive: {
    // backgroundColor and borderColor will be set dynamically
  },
  debtTypeButtonOwed: {
    // backgroundColor will be set dynamically
  },
  debtTypeButtonOwe: {
    // backgroundColor will be set dynamically
  },
  debtTypeContent: {
    alignItems: 'center',
  },
  debtTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  debtTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  debtTypeTitleInactive: {
    // color will be set dynamically
  },
  debtTypeTitleOwed: {
    // color will be set dynamically
  },
  debtTypeTitleOwe: {
    // color will be set dynamically
  },
  debtTypeSubtitle: {
    fontSize: 14,
  },
  debtTypeSubtitleInactive: {
    // color will be set dynamically
  },
  debtTypeSubtitleOwed: {
    // color will be set dynamically
  },
  debtTypeSubtitleOwe: {
    // color will be set dynamically
  },
  contactSelector: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  contactSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    fontSize: 24,
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
  },
  contactPhone: {
    fontSize: 14,
  },
  contactArrow: {
    // color will be set dynamically
  },
  contactSelectorPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactPlaceholderText: {
    fontSize: 16,
  },
  amountContainer: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
    fontSize: 16,
  },
  descriptionContainer: {
    borderRadius: 12,
    borderWidth: 1,
  },
  descriptionInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
  },
  saveButtonDisabled: {
    // backgroundColor will be set dynamically
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 80,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeaderContainer: {
    // backgroundColor will be set dynamically
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  modalBackButton: {
    fontSize: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  searchContainer: {
    borderRadius: 12,
    borderWidth: 1,
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
  },
  contactItem: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  contactItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactItemAvatar: {
    width: 48,
    height: 48,
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
  },
  contactItemPhone: {
    fontSize: 14,
    marginTop: 4,
  },
  contactItemSelected: {
    fontSize: 20,
  },
  emptyListContainer: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
  },
});