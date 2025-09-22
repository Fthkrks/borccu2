import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/buton';
import { useTheme } from '../contexts/ThemeContext';
import { debtService } from '../services/api';

export default function DebtDetailScreen() {
  const { debtId } = useLocalSearchParams();
  const { colors, isDark } = useTheme();
  const [debt, setDebt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (debtId) {
      loadDebt();
    }
  }, [debtId]);

  const loadDebt = async () => {
    try {
      setLoading(true);
      const { data, error } = await debtService.getDebtById(debtId as string);
      
      if (error) {
        throw error;
      }
      
      if (data) {
        setDebt(data);
      } else {
        throw new Error('Borç bulunamadı');
      }
    } catch (error) {
      console.error('Error loading debt:', error);
      Alert.alert('Hata', 'Borç yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
      </View>
    );
  }

  if (!debt) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Hata: Borç bilgisi bulunamadı</Text>
        <Button
          title="Geri Dön"
          backgroundColor="bg-blue-500"
          textColor="text-white"
          size="small"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  const debtAmount = (debt.youwillreceive || 0) > 0 ? (debt.youwillreceive || 0) : (debt.youwillgive || 0);
  const isOwed = (debt.youwillgive || 0) > 0;
  // API'den gelen işlenmiş veriyi kullan
  const otherParty = debt.other_party || (isOwed ? debt.creditor : debt.debtor);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <SafeAreaView style={[styles.headerContainer, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Borç Detayı</Text>
          <View style={styles.headerSpacer}></View>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Debt Info Card */}
        <View style={styles.debtCard}>
          <View style={styles.debtHeader}>
            <Text style={styles.debtTitle}>
              {isOwed ? 'Borç Aldım' : 'Borç Verdim'}
            </Text>
            <Text style={styles.debtAmount}>
              ₺{debtAmount.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.debtInfo}>
            <View style={styles.debtInfoRow}>
              <Text style={styles.debtInfoLabel}>Kişi:</Text>
              <Text style={styles.debtInfoValue}>
                {otherParty?.full_name || otherParty?.email || 'Bilinmeyen'}
              </Text>
            </View>
            
            <View style={styles.debtInfoRow}>
              <Text style={styles.debtInfoLabel}>Durum:</Text>
              <Text style={[styles.debtInfoValue, debt.is_settled ? styles.settledText : styles.pendingText]}>
                {debt.is_settled ? 'Kapatıldı' : 'Beklemede'}
              </Text>
            </View>
            
            {debt.description && (
              <View style={styles.debtInfoRow}>
                <Text style={styles.debtInfoLabel}>Açıklama:</Text>
                <Text style={styles.debtInfoValue}>{debt.description}</Text>
              </View>
            )}
            
            <View style={styles.debtInfoRow}>
              <Text style={styles.debtInfoLabel}>Tarih:</Text>
              <Text style={styles.debtInfoValue}>
                {new Date(debt.created_at).toLocaleDateString('tr-TR')}
              </Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        {!debt.is_settled && (
          <View style={styles.actionsContainer}>
            <Button
              title="Borcu Kapat"
              backgroundColor="bg-green-500"
              textColor="text-white"
              size="large"
              onPress={() => handleSettleDebt()}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );

  async function handleSettleDebt() {
    try {
      const { error } = await debtService.settleDebt(debt.id);
      
      if (error) {
        throw error;
      }
      
      Alert.alert(
        'Başarılı!',
        'Borç başarıyla kapatıldı.',
        [{ text: 'Tamam', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error settling debt:', error);
      Alert.alert('Hata', 'Borç kapatılırken hata oluştu');
    }
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
  loadingText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  debtCard: {
    backgroundColor: '#ffffff',
    margin: 24,
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  debtHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  debtTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  debtAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  debtInfo: {
    gap: 16,
  },
  debtInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  debtInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    flex: 1,
  },
  debtInfoValue: {
    fontSize: 14,
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  settledText: {
    color: '#10b981',
    fontWeight: '600',
  },
  pendingText: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  actionsContainer: {
    padding: 24,
  },
});