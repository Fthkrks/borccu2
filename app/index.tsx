import { router } from 'expo-router';
import { useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Kullanıcı giriş yapmamışsa AuthScreen'e yönlendir
        console.log('🔄 Redirecting to AuthScreen - no user');
        router.replace('/(auth)/AuthScreen');
      } else {
        // Kullanıcı giriş yapmışsa ana sayfaya yönlendir
        console.log('🔄 Redirecting to tabs - user exists:', user.id);
        router.replace('/(tabs)');
      }
    }
  }, [user, loading]);

  // Loading sırasında LoadingScreen göster
  return <LoadingScreen />;
}


