import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Kullanıcı giriş yapmamışsa AuthScreen'e yönlendir
        router.replace('/(auth)/AuthScreen');
      } else {
        // Kullanıcı giriş yapmışsa ana sayfaya yönlendir
        router.replace('/(tabs)');
      }
    }
  }, [user, loading]);

  // Loading sırasında boş bir view göster
  return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
}


