import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Güvenli AsyncStorage wrapper
const safeAsyncStorage = {
  getItem: async (key: string) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('AsyncStorage getItem error:', error);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('AsyncStorage setItem error:', error);
    }
  },
  removeItem: async (key: string) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('AsyncStorage removeItem error:', error);
    }
  },
};

// Supabase yapılandırması
// Bu değerler environment variable'lardan yüklenir
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Yapılandırma kontrolü
const isConfigured = process.env.EXPO_PUBLIC_SUPABASE_URL && 
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY &&
                    process.env.EXPO_PUBLIC_SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
                    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

// Detaylı debug bilgileri
console.log('🔍 Environment Debug:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  EXPO_PUBLIC_SUPABASE_URL exists:', !!process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('  EXPO_PUBLIC_SUPABASE_ANON_KEY exists:', !!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
console.log('  URL value:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('  Key starts with eyJ:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.startsWith('eyJ'));
console.log('  Key length:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.length);

if (!isConfigured) {
  console.warn('⚠️ Supabase yapılandırması eksik! Environment variable\'ları ayarlayın.');
  console.warn('📝 EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY gerekli.');
  console.warn('💡 .env dosyası kontrol edildi, cache temizlenmeyi deneyin: npx expo start --clear');
} else {
  console.log('✅ Supabase yapılandırması yüklendi');
  console.log('🔗 URL:', supabaseUrl);
  console.log('🔑 Key:', supabaseAnonKey.substring(0, 20) + '...');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // React Native için gerekli ayarlar
    storage: safeAsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Crash önleme için ek ayarlar
    storageKey: 'supabase.auth.token',
    flowType: 'pkce',
  },
});

// Supabase bağlantı durumu
export const isSupabaseConfigured = isConfigured;

// Supabase bağlantı testi
export const testSupabaseConnection = async () => {
  try {
    console.log('🧪 Starting Supabase connection test...');
    console.log('📋 Config check - isSupabaseConfigured:', isSupabaseConfigured);
    
    // Environment variable'ları direkt kontrol et
    console.log('🔍 Direct env check:');
    console.log('  URL:', process.env.EXPO_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');
    console.log('  KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 30) + '...');
    console.log('  URL length:', process.env.EXPO_PUBLIC_SUPABASE_URL?.length);
    console.log('  KEY length:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.length);

    // Key tipini kontrol et (anon key 'eyJ' ile başlamalı)
    const keyType = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.startsWith('eyJ') ? 'JWT (Anon Key)' : 'Unknown';
    console.log('  KEY Type:', keyType);

    // Daha güvenli test - sadece bağlantı kontrolü
    try {
      const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
      
      if (error) {
        console.error('🔴 Database test error:', error.message);
        if (error.message.includes('Invalid API key') || error.message.includes('JWT')) {
          console.error('❌ API Key sorunu tespit edildi!');
          console.error('💡 Çözüm önerileri:');
          console.error('   1. Supabase Dashboard\'dan ANON key\'i kopyalayın (Service Role key değil)');
          console.error('   2. Key\'in başında/sonunda boşluk olmadığından emin olun');
          console.error('   3. Environment variable\'ın doğru ayarlandığından emin olun');
          return false;
        }
        // Diğer hatalar (RLS vs.) kabul edilebilir
        console.log('⚠️ Database error (but connection OK):', error.message);
        return true;
      }
      
      console.log('✅ Database connection successful');
      return true;
      
    } catch (dbError) {
      console.error('🔴 Database connection failed:', dbError);
      return false;
    }
    
  } catch (error) {
    console.error('🔴 Supabase connection test failed:', error);
    return false;
  }
};

// Database türleri - Yeni şema
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          trust_score: number;
          total_transactions: number;
          member_since: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          trust_score?: number;
          total_transactions?: number;
          member_since?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          trust_score?: number;
          total_transactions?: number;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          from_user_id: string;
          to_user_id: string;
          amount: number;
          description: string;
          type: 'debt_created' | 'debt_settled' | 'payment_made' | 'payment_received';
          status: 'pending' | 'completed' | 'cancelled';
          group_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          from_user_id: string;
          to_user_id: string;
          amount: number;
          description: string;
          type: 'debt_created' | 'debt_settled' | 'payment_made' | 'payment_received';
          status?: 'pending' | 'completed' | 'cancelled';
          group_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          amount?: number;
          description?: string;
          type?: 'debt_created' | 'debt_settled' | 'payment_made' | 'payment_received';
          status?: 'pending' | 'completed' | 'cancelled';
          updated_at?: string;
        };
      };
      debts: {
        Row: {
          id: string;
          creditor_id: string;
          debtor_id: string;
          youwillreceive: number;
          youwillgive: number;
          description: string | null;
          group_id: string | null;
          is_settled: boolean;
          pay_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creditor_id: string;
          debtor_id: string;
          youwillreceive?: number;
          youwillgive?: number;
          description?: string | null;
          group_id?: string | null;
          is_settled?: boolean;
          pay_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creditor_id?: string;
          debtor_id?: string;
          youwillreceive?: number;
          youwillgive?: number;
          description?: string | null;
          group_id?: string | null;
          is_settled?: boolean;
          pay_date?: string | null;
          updated_at?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          total_amount: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          total_amount?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          total_amount?: number;
          updated_at?: string;
        };
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          amount_owed: number;
          is_paid: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
          amount_owed?: number;
          is_paid?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          amount_owed?: number;
          is_paid?: boolean;
          updated_at?: string;
        };
      };
      group_invitations: {
        Row: {
          id: string;
          group_id: string;
          invited_by: string;
          invited_user_email: string;
          status: 'pending' | 'accepted' | 'declined';
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          invited_by: string;
          invited_user_email: string;
          status?: 'pending' | 'accepted' | 'declined';
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          status?: 'pending' | 'accepted' | 'declined';
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'debt_created' | 'payment_received' | 'payment_reminder' | 'group_activity' | 'friend_request';
          data: Record<string, any> | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type: 'debt_created' | 'payment_received' | 'payment_reminder' | 'group_activity' | 'friend_request';
          data?: Record<string, any> | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          read?: boolean;
        };
      };
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];