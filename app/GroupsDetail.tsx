import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal, FlatList, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import Button from '../components/buton';
import { useAuth } from '../contexts/AuthContext';
import { groupService, groupMemberService, friendService } from '../services/api';
import { Ionicons } from '@expo/vector-icons';

type GroupsDetailRouteProp = RouteProp<RootStackParamList, 'GroupsDetail'>;

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<GroupsDetailRouteProp>();
  const { user } = useAuth();
  
  const groupId = route.params?.groupId;
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
            onPress: () => navigation.goBack()
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
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupDetail) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 justify-center items-center">
          <Text className="text-gray-500">Grup bulunamadı</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 pt-12 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-gray-600 text-2xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">{groupDetail.name}</Text>
        <TouchableOpacity>
          <Text className="text-gray-600 text-lg">⋯</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingBottom: 85,
          flexGrow: 1
        }}
      >
        {/* Group Summary */}
        <View className="px-6 py-6 border-b border-gray-100">
          <Text className="text-sm text-gray-600 mb-2">{groupDetail.description || 'Açıklama yok'}</Text>
          
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
                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-1">
                    <Text className="text-sm text-gray-500 mb-1">Toplam Tutar</Text>
                    <Text className="text-2xl font-bold text-gray-900">₺{totalAmount.toFixed(2)}</Text>
                  </View>
                  
                  <View className="flex-1 px-3">
                    <Text className="text-sm text-gray-500 mb-1">Toplanan</Text>
                    <Text className="text-2xl font-bold text-green-600">₺{paidAmount.toFixed(2)}</Text>
                  </View>
                  
                  <View className="flex-1">
                    <Text className="text-sm text-gray-500 mb-1">Kalan</Text>
                    <Text className="text-2xl font-bold text-red-600">₺{pendingAmount.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View>
                  <View className="w-full h-3 bg-gray-200 rounded-full">
                    <View 
                      className="h-3 bg-green-500 rounded-full"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </View>
                  <Text className="text-sm text-gray-500 mt-2 text-center">
                    {completionPercentage}% tamamlandı
                  </Text>
                </View>
              </>
            );
          })()}
        </View>

        {/* Members List */}
        <View className="px-6 py-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              Grup Üyeleri ({groupDetail.group_members?.length || 0})
            </Text>
            <Button
              title="Üye Ekle"
              backgroundColor="bg-gray-900"
              textColor="text-white"
              size="small"
              shape="rounded"
              onPress={openContactModal}
            />
          </View>
          
          {groupDetail.group_members?.map((member: GroupMember, index: number) => {
            const isGroupCreator = member.user_id === groupDetail.created_by;
            
            return (
              <View 
                key={member.id}
                className={`bg-white border border-gray-200 rounded-xl p-4 mb-3 ${index === (groupDetail.group_members?.length || 0) - 1 ? 'mb-0' : ''}`}
              >
                {/* Member Info */}
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center flex-1">
                    <View className="w-12 h-12 bg-gray-100 rounded-full justify-center items-center mr-3">
                      <Text className="text-xl">{isGroupCreator ? '👑' : '👤'}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-gray-900">
                        {member.profiles?.full_name || 'Kullanıcı'}
                        {isGroupCreator && (
                          <Text className="text-sm text-blue-600 ml-2">(Grup Sahibi)</Text>
                        )}
                      </Text>
                      {!isGroupCreator && (
                        <Text className="text-sm text-gray-500">
                          Borç: ₺{member.amount_owed || 0}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  <View className="items-end">
                    {isGroupCreator ? (
                      <Text className="text-lg font-bold text-blue-600">
                        Grup Sahibi
                      </Text>
                    ) : (
                      <>
                        <Text className={`text-lg font-bold ${member.is_paid ? 'text-green-600' : 'text-red-600'}`}>
                          {member.is_paid ? '✓ Ödendi' : `₺${member.amount_owed || 0}`}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          {member.profiles?.email || ''}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                {/* Action Buttons */}
                {!isGroupCreator && !member.is_paid && (
                  <View className="flex-row space-x-3">
                    {/* Grup sahibi herkesi işaretleyebilir, normal üye sadece kendisini */}
                    {(user?.id === groupDetail.created_by || member.user_id === user?.id) && (
                      <Button
                        title="Ödendi Olarak İşaretle"
                        backgroundColor="bg-green-600"
                        textColor="text-white"
                        size="small"
                        shape="rounded"
                        className="flex-1"
                        onPress={() => handleMarkAsPaid(member.id)}
                      />
                    )}
                    {/* Sadece grup sahibi hatırlat gönderebilir */}
                    {user?.id === groupDetail.created_by && (
                      <Button
                        title="Hatırlat"
                        variant="outlined"
                        size="small"
                        shape="rounded"
                        className="flex-1"
                        onPress={() => handleSendReminder(member.id)}
                      />
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Close Group Button - Only show when all members are paid */}
        {areAllMembersPaid() && (
          <View className="px-6 py-6 border-t border-gray-100">
            <Button
              title="Grubu Kapat"
              backgroundColor="bg-red-600"
              textColor="text-white"
              shape="rectangular"
              onPress={handleCloseGroup}
            />
            <Text className="text-xs text-gray-500 text-center mt-2">
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
        <View className="flex-1 bg-white">
          {/* Modal Header */}
          <SafeAreaView className="bg-white">
            <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
              <TouchableOpacity onPress={() => {
                setShowContactModal(false);
                setSearchQuery('');
                setSelectedContacts([]);
              }}>
                <Text className="text-gray-900 text-2xl">←</Text>
              </TouchableOpacity>
              <Text className="text-xl font-bold text-gray-900">
                Üye Ekle ({selectedContacts.length})
              </Text>
              <TouchableOpacity 
                onPress={handleAddMembers}
                className="bg-gray-900 px-3 py-1 rounded-full"
                disabled={selectedContacts.length === 0}
              >
                <Text className="text-white text-sm font-medium">Ekle</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          {/* Selected Contacts Header - WhatsApp Style */}
          {selectedContacts.length > 0 && (
            <View className="px-6 py-4 border-b border-gray-100">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row" style={{ gap: 12 }}>
                  {selectedContacts.map((contact) => (
                    <View key={contact.id} className="items-center">
                      <View className="relative">
                        <View className="w-14 h-14 bg-gray-100 rounded-full items-center justify-center">
                          <Text className="text-xl">{contact.avatar}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => removeContact(contact.id)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center"
                        >
                          <Text className="text-white text-xs font-bold">×</Text>
                        </TouchableOpacity>
                      </View>
                      <Text className="text-xs text-gray-600 mt-1 max-w-[50px] text-center" numberOfLines={1}>
                        {contact.name.split(' ')[0]}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Search Bar */}
          <View className="px-6 py-4 border-b border-gray-100">
            <View className="bg-gray-50 rounded-xl border border-gray-200 flex-row items-center">
              <View className="px-4">
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              </View>
              <TextInput
                className="flex-1 py-3 pr-4 text-base text-gray-900"
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
                  className="px-6 py-4 border-b border-gray-50"
                  disabled={isSelected}
                >
                  <View className="flex-row items-center">
                    <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center mr-4">
                      <Text className="text-xl">{item.avatar}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className={`text-base font-semibold ${isSelected ? 'text-gray-400' : 'text-gray-900'}`}>
                        {item.name}
                      </Text>
                      <Text className="text-sm text-gray-500 mt-1">{item.phone}</Text>
                    </View>
                    {isSelected && (
                      <View className="w-6 h-6 bg-green-500 rounded-full items-center justify-center">
                        <Text className="text-white text-xs font-bold">✓</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={() => (
              <View className="px-6 py-8 items-center">
                <Text className="text-gray-500 text-base">
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
