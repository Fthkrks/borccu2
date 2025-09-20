import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/buton';
import { debtService } from '../services/api';
import { RootStackParamList } from '../types/navigation';

type DebtDetailScreenRouteProp = RouteProp<RootStackParamList, 'DebtDetail'>;
type DebtDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'DebtDetail'>;

export default function DebtDetailScreen() {
  const navigation = useNavigation<DebtDetailNavigationProp>();
  const route = useRoute<DebtDetailScreenRouteProp>();
  
  // Error handling for missing params
  if (!route.params || !route.params.debt) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Hata: Borç bilgisi bulunamadı</Text>
        <Button
          title="Geri Dön"
          backgroundColor="bg-blue-500"
          textColor="text-white"
          size="small"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  // Parse debt from JSON string
  let debt;
  try {
    debt = typeof route.params.debt === 'string' 
      ? JSON.parse(route.params.debt) 
      : route.params.debt;
  } catch (error) {
    console.error('Error parsing debt data:', error);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Hata: Borç bilgisi geçersiz</Text>
        <Button
          title="Geri Dön"
          backgroundColor="bg-blue-500"
          textColor="text-white"
          size="small"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }
  const [isEditing, setIsEditing] = useState(false);
  const debtAmount = (debt.youwillreceive || 0) > 0 ? (debt.youwillreceive || 0) : (debt.youwillgive || 0);
  const [amount, setAmount] = useState(String(debtAmount));
  const [description, setDescription] = useState(debt.description || '');

  return (
    <View style={styles.container}>
      {/* Header */}
      <SafeAreaView style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Borç Detayı</Text>
          <View style={styles.headerSpacer}></View>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* You owe section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {debt.type === 'owed' ? 'Size borçlu' : 'Siz borçlusunuz'}
          </Text>
          
          {/* Person info */}
          <View style={styles.personInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {debt.name.charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.personName}>{debt.name}</Text>
              <Text style={styles.personAmount}>Toplam: ₺{debtAmount}</Text>
            </View>
          </View>
        </View>

        {/* Details section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detaylar</Text>
          
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Tarih ve Saat</Text>
            <Text style={styles.detailValue}>
              {debt.pay_date ? new Date(debt.pay_date).toLocaleString() : '—'}
            </Text>
          </View>

          {/* Divider */}
          <View style={styles.divider}></View>

          {/* Editable fields */}
          <View style={styles.editableSection}>
            <Text style={styles.detailLabel}>Tutar</Text>
            {isEditing ? (
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
            ) : (
              <Text style={styles.detailValue}>₺{amount}</Text>
            )}

            <Text style={[styles.detailLabel, styles.marginTop]}>Açıklama</Text>
            {isEditing ? (
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="İsteğe bağlı"
              />
            ) : (
              <Text style={styles.detailValue}>{description || '—'}</Text>
            )}
          </View>
        </View>

        {/* Activity section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aktivite</Text>
          
          <View style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Text style={styles.activityIconText}>✓</Text>
            </View>
            <View>
              <Text style={styles.activityText}>
                {debt.name} size ödeme yaptı
              </Text>
              <Text style={styles.activityDate}>12 Mayıs, 2024</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.bottomButtons}>
        <Button
          title={isEditing ? 'Kaydet' : 'Düzenle'}
          backgroundColor="bg-gray-900"
          textColor="text-white"
          shape="rectangular"
          onPress={async () => {
            if (!isEditing) {
              setIsEditing(true);
              return;
            }
            const newAmount = parseFloat(amount);
            if (isNaN(newAmount) || newAmount <= 0) {
              Alert.alert('Hata', 'Geçerli bir tutar girin');
              return;
            }
            const updateData = debt.youwillreceive > 0 
              ? { youWillReceive: newAmount, description: description || null }
              : { youWillGive: newAmount, description: description || null };
            const { error } = await debtService.updateDebt(String(debt.id), updateData);
            if (error) {
              Alert.alert('Hata', error.message || 'Güncellenemedi');
              return;
            }
            Alert.alert('Başarılı', 'Borç güncellendi');
            setIsEditing(false);
          }}
        />
        
        <View style={styles.buttonMargin} />
        
        <Button
          title="Borcu Kapat"
          variant="outlined"
          shape="rectangular"
          onPress={() => {
            Alert.alert('Onay', 'Bu borcu silmek istiyor musunuz?', [
              { text: 'İptal', style: 'cancel' },
              { text: 'Sil', style: 'destructive', onPress: async () => {
                const { error } = await debtService.deleteDebt(String(debt.id));
                if (error) {
                  Alert.alert('Hata', error.message || 'Silinemedi');
                  return;
                }
                Alert.alert('Başarılı', 'Borç silindi');
                navigation.goBack();
              }}
            ]);
          }}
        />
      </View>

      {/* Navigation bar space */}
      <View style={styles.navigationSpace}></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#111827',
    fontSize: 18,
    marginBottom: 16,
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
  },
  backButton: {
    color: '#111827',
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
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
  sectionTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  personInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 64,
    height: 64,
    backgroundColor: '#3b82f6',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  personName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '600',
  },
  personAmount: {
    color: '#6b7280',
  },
  detailItem: {
    marginBottom: 24,
  },
  detailLabel: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 4,
  },
  detailValue: {
    color: '#111827',
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 24,
  },
  editableSection: {
    marginBottom: 32,
  },
  marginTop: {
    marginTop: 16,
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
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  activityIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#10b981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityIconText: {
    color: '#ffffff',
    fontSize: 14,
  },
  activityText: {
    color: '#111827',
    fontWeight: '500',
  },
  activityDate: {
    color: '#6b7280',
    fontSize: 14,
  },
  bottomButtons: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  buttonMargin: {
    height: 12,
  },
  navigationSpace: {
    height: 80,
  },
});
