// Database temizleme scripti
// Bu script mevcut arkadaşlık verilerini temizler

const { createClient } = require('@supabase/supabase-js');

// Supabase bağlantısı
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase environment variables not found');
  console.log('Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanFriendships() {
  try {
    console.log('🧹 Cleaning existing friendship data...');
    
    // Mevcut friendships tablosundaki tüm verileri sil
    const { error: deleteError } = await supabase
      .from('friendships')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Tüm kayıtları sil
    
    if (deleteError) {
      console.log('⚠️ Friendships table may not exist yet:', deleteError.message);
    } else {
      console.log('✅ Friendships table cleaned');
    }
    
    // Notifications tablosundaki friend_request bildirimlerini temizle
    const { error: notificationError } = await supabase
      .from('notifications')
      .delete()
      .eq('type', 'friend_request');
    
    if (notificationError) {
      console.log('⚠️ Could not clean friend request notifications:', notificationError.message);
    } else {
      console.log('✅ Friend request notifications cleaned');
    }
    
    console.log('🎉 Database cleanup completed!');
    console.log('Now all users will appear as non-friends');
    
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
  }
}

cleanFriendships();
