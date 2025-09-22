import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import '../global.css';
import { isSupabaseConfigured } from '../lib/supabase';
import { debtService, friendService, utilService } from '../services/api';

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
      const payload = {
        creditor_id: debtType === 'owed' ? selectedContact.id : user.id,   // 'owed'=Borç aldım, karşı taraf alacaklı
        debtor_id: debtType === 'owed' ? user.id : selectedContact.id,     // 'owed'=Borç aldım, ben borçluyum
        youwillreceive: debtType === 'owe' ? parseFloat(amount) : 0,       // Borç verdiysem alacağım
        youwillgive: debtType === 'owed' ? parseFloat(amount) : 0,         // Borç aldıysam vereceğim
        description: description || null,
        group_id: null as string | null,
        pay_date: new Date(`${date}T${time}:00`).toISOString(),
      };

      const { data, error } = await debtService.createDebt(payload);

      if (error) {
        throw new Error(error.message || 'Borç kaydedilirken hata oluştu');
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
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Borç Ekle</Text>
          <View style={styles.headerSpacer}></View>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Debt Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İşlem Türü</Text>
          <View style={styles.debtTypeContainer}>
            <TouchableOpacity 
              onPress={() => setDebtType('owed')}
              style={[styles.debtTypeButton, debtType === 'owed' ? styles.debtTypeButtonOwed : styles.debtTypeButtonInactive]}
            >
              <View style={styles.debtTypeContent}>
                <Text style={styles.debtTypeIcon}>💳</Text>
                <Text style={[styles.debtTypeTitle, debtType === 'owed' ? styles.debtTypeTitleOwed : styles.debtTypeTitleInactive]}>
                  Borç Aldım
                </Text>
                <Text style={[styles.debtTypeSubtitle, debtType === 'owed' ? styles.debtTypeSubtitleOwed : styles.debtTypeSubtitleInactive]}>
                  Birinden borç aldım
                </Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setDebtType('owe')}
              style={[styles.debtTypeButton, debtType === 'owe' ? styles.debtTypeButtonOwe : styles.debtTypeButtonInactive]}
            >
              <View style={styles.debtTypeContent}>
                <Text style={styles.debtTypeIcon}>💰</Text>
                <Text style={[styles.debtTypeTitle, debtType === 'owe' ? styles.debtTypeTitleOwe : styles.debtTypeTitleInactive]}>
                  Borç Verdim
                </Text>
                <Text style={[styles.debtTypeSubtitle, debtType === 'owe' ? styles.debtTypeSubtitleOwe : styles.debtTypeSubtitleInactive]}>
                  Birine borç verdim
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Contact Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {debtType === 'owed' ? 'Kimden aldınız?' : 'Kime verdiniz?'}
          </Text>
          <TouchableOpacity 
            onPress={() => setShowContactModal(true)}
            style={styles.contactSelector}
          >
            {selectedContact ? (
              <View style={styles.contactSelectorContent}>
                <Text style={styles.contactAvatar}>{selectedContact.avatar}</Text>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{selectedContact.name}</Text>
                  <Text style={styles.contactPhone}>{selectedContact.phone}</Text>
                </View>
                <Text style={styles.contactArrow}>→</Text>
              </View>
            ) : (
              <View style={styles.contactSelectorPlaceholder}>
                <Text style={styles.contactPlaceholderText}>Kişi seçin...</Text>
                <Text style={styles.contactArrow}>→</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tutar</Text>
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>₺</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Description */}
        <View style={styles.sectionLast}>
          <Text style={styles.sectionTitle}>Açıklama (İsteğe bağlı)</Text>
          <View style={styles.descriptionContainer}>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Borç ile ilgili detaylar..."
              placeholderTextColor="#9CA3AF"
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
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          >
            <Text style={styles.saveButtonText}>
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
        <View className="flex-1 bg-white">
          {/* Modal Header */}
          <SafeAreaView style={styles.modalHeaderContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowContactModal(false)}>
                <Text style={styles.modalBackButton}>←</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Kişi Seç</Text>
              <View style={styles.headerSpacer}></View>
            </View>
          </SafeAreaView>

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
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleContactSelect(item)}
                style={styles.contactItem}
              >
                <View style={styles.contactItemContent}>
                  <View style={styles.contactItemAvatar}>
                    <Text style={styles.contactItemAvatarText}>{item.avatar}</Text>
                  </View>
                  <View style={styles.contactItemInfo}>
                    <Text style={styles.contactItemName}>{item.name}</Text>
                    <Text style={styles.contactItemPhone}>{item.phone}</Text>
                  </View>
                  {selectedContact?.id === item.id && (
                    <Text style={styles.contactItemSelected}>✓</Text>
                  )}
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>Kişi bulunamadı</Text>
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
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  backButton: {
    color: '#111827',
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
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionLast: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  debtTypeButtonOwed: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
  },
  debtTypeButtonOwe: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
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
    color: '#374151',
  },
  debtTypeTitleOwed: {
    color: '#b91c1c',
  },
  debtTypeTitleOwe: {
    color: '#15803d',
  },
  debtTypeSubtitle: {
    fontSize: 14,
  },
  debtTypeSubtitleInactive: {
    color: '#6b7280',
  },
  debtTypeSubtitleOwed: {
    color: '#dc2626',
  },
  debtTypeSubtitleOwe: {
    color: '#16a34a',
  },
  contactSelector: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: '#111827',
  },
  contactPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  contactArrow: {
    color: '#9ca3af',
  },
  contactSelectorPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contactPlaceholderText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  amountContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    paddingRight: 16,
    fontSize: 16,
    color: '#111827',
  },
  descriptionContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  descriptionInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 80,
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
  contactItemPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  contactItemSelected: {
    color: '#3b82f6',
    fontSize: 20,
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