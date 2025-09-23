import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/buton';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import '../../global.css';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

// Supabase Test Component
const SupabaseTestComponent = () => {
  const [testResult, setTestResult] = useState<string>('Testing...');
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing');

  useEffect(() => {
    const testSupabaseConnection = async () => {
      try {
        console.log('🧪 Starting Supabase connection test...');
        
        // 1. Konfigürasyon kontrolü
        console.log('📋 Config check - isSupabaseConfigured:', isSupabaseConfigured);
        
        // Environment değişkenlerini direkt kontrol et
        const envUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const envKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
        
        console.log('🔍 Direct env check:');
        console.log('  URL:', envUrl ? `${envUrl.substring(0, 30)}...` : 'undefined');
        console.log('  KEY:', envKey ? `${envKey.substring(0, 30)}...` : 'undefined');
        console.log('  URL length:', envUrl?.length || 0);
        console.log('  KEY length:', envKey?.length || 0);
        
        if (!isSupabaseConfigured) {
          setTestResult('❌ Supabase yapılandırılmamış - Environment değişkenleri eksik');
          setConnectionStatus('error');
          return;
        }

        // 2. API key detaylı test
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('🔴 getSession failed:', sessionError);
          setTestResult(`❌ Basic API erişimi başarısız: ${sessionError.message}`);
          setConnectionStatus('error');
          return;
        }
        
        console.log('✅ getSession başarılı, şimdi auth test ediliyor...');
        
        // Daha güvenli test - sadece database bağlantısını kontrol et
        try {
          const { data, error: dbError } = await supabase
            .from('profiles')
            .select('count', { count: 'exact', head: true });
          
          if (dbError) {
            console.error('🔴 Database test error:', dbError.message);
            if (dbError.message.includes('Invalid API key') || dbError.message.includes('JWT')) {
              setTestResult(`❌ API Key Sorunu!\n\n🔍 Çözüm:\n1. Supabase Dashboard > Settings > API\n2. "anon public" key'i kopyalayın\n3. .env dosyasını güncelleyin\n4. npx expo start --clear`);
              setConnectionStatus('error');
              return;
            }
            // RLS hatası normal (tablo var ama erişim yok)
            console.log('⚠️ Database error (but connection OK):', dbError.message);
            setTestResult('✅ Supabase bağlantısı başarılı!\n(Database tablolarına RLS koruması aktif)');
            setConnectionStatus('success');
            return;
          }
          
          console.log('🟢 Database connection successful');
          setTestResult('✅ Supabase bağlantısı başarılı!');
          setConnectionStatus('success');
          
        } catch (dbTestError) {
          console.error('🔴 Database test failed:', dbTestError);
          setTestResult(`❌ Database test hatası: ${dbTestError}`);
          setConnectionStatus('error');
        }
      } catch (error: any) {
        console.error('🔴 Supabase test error:', error);
        setTestResult(`❌ Test hatası: ${error.message || 'Bilinmeyen hata'}`);
        setConnectionStatus('error');
      }
    };

    testSupabaseConnection();
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'testing': return '#FFA500';
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      default: return '#FFA500';
    }
  };

  return (
    <View style={[styles.testContainer, { borderColor: getStatusColor() }]}>
      <View style={styles.testHeader}>
        <Text style={styles.testTitle}>
          {connectionStatus === 'testing' && '⏳'}
          {connectionStatus === 'success' && '✅'}
          {connectionStatus === 'error' && '❌'}
          {' '}Supabase Durumu
        </Text>
      </View>
      <Text style={[styles.testResult, { color: getStatusColor() }]}>
        {testResult}
      </Text>
      {connectionStatus === 'error' && (
        <View style={styles.testActions}>
          <Text style={styles.testHint}>
            💡 .env dosyasını kontrol edin ve uygulamayı yeniden başlatın
          </Text>
        </View>
      )}
    </View>
  );
};

export default function AuthScreen() {
  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const { colors, isDark } = useTheme();

  // Kullanıcı zaten giriş yapmışsa ana sayfaya yönlendir
  useEffect(() => {
    if (user && !authLoading) {
      router.replace('/(tabs)');
    }
  }, [user, authLoading]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleLogin = async () => {
    // Form validation
    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen email adresinizi girin.');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Hata', 'Lütfen geçerli bir email adresi girin.');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Hata', 'Lütfen şifrenizi girin.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email.trim(), password);
      
      if (error) {
        let errorMessage = 'Giriş yapılırken bir hata oluştu.';
        
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Email veya şifre hatalı. Lütfen tekrar deneyin.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Email adresinizi doğrulamanız gerekiyor. Email kutunuzu kontrol edin.';
        } else if (error.message.includes('Too many requests')) {
          errorMessage = 'Çok fazla deneme yaptınız. Lütfen birkaç dakika sonra tekrar deneyin.';
        }
        
        Alert.alert('Giriş Hatası', errorMessage);
      } else {
        console.log('Login successful');
      }
    } catch (error) {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    Alert.alert('Yakında', 'Google ile giriş özelliği yakında eklenecek.');
    // TODO: Google Auth implementasyonu
  };

  const handleSignup = async () => {
    // Form validation
    if (!email.trim()) {
      Alert.alert('Hata', 'Lütfen email adresinizi girin.');
      return;
    }

    if (!validateEmail(email.trim())) {
      Alert.alert('Hata', 'Lütfen geçerli bir email adresi girin.');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Hata', 'Lütfen şifrenizi girin.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }

    if (!fullName.trim()) {
      Alert.alert('Hata', 'Lütfen ad soyad bilginizi girin.');
      return;
    }

    if (fullName.trim().length < 2) {
      Alert.alert('Hata', 'Ad soyad en az 2 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signUp(email.trim(), password, fullName.trim(), phone.trim());
      
      if (error) {
        let errorMessage = 'Kayıt olurken bir hata oluştu.';
        
        if (error.message.includes('User already registered')) {
          errorMessage = 'Bu email adresi zaten kullanılıyor. Giriş yapmayı deneyin.';
        } else if (error.message.includes('Password should be')) {
          errorMessage = 'Şifre en az 6 karakter olmalıdır.';
        } else if (error.message.includes('Invalid email')) {
          errorMessage = 'Geçersiz email adresi. Lütfen kontrol edin.';
        }
        
        Alert.alert('Kayıt Hatası', errorMessage);
      } else {
        Alert.alert(
          'Başarılı!', 
          'Hesabınız oluşturuldu. Email adresinize gönderilen doğrulama linkine tıklayın.',
          [
            {
              text: 'Tamam',
              onPress: () => {
                setShowSignup(false);
                setShowLogin(true);
                setPassword(''); // Güvenlik için şifreyi temizle
                // Email'i sakla ki login ekranında dolu gelsin
              }
            }
          ]
        );
      }
    } catch (error) {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
      console.error('Signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (showSignup) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView 
          style={styles.flex1} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            style={styles.flex1}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo Section */}
            <View style={styles.illustrationSection}>
              {/* App Logo */}
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/images/app_icon_light.svg')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Title */}
              <Text style={[styles.formTitle, { color: colors.text }]}>Kayıt Ol</Text>
            </View>

            {/* Signup Form */}
            <View style={styles.formContainer}>
              {/* Google Signup Button */}
              <TouchableOpacity 
                style={[styles.googleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleGoogleLogin}
              >
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={[styles.googleButtonText, { color: colors.text }]}>
                  Google ile Kayıt Ol
                </Text>
              </TouchableOpacity>

              {/* OR Divider */}
              <View style={styles.orDivider}>
                <View style={[styles.orLine, { backgroundColor: colors.divider }]} />
                <Text style={[styles.orText, { color: colors.textSecondary }]}>VEYA</Text>
                <View style={[styles.orLine, { backgroundColor: colors.divider }]} />
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="E-posta"
                    placeholderTextColor={colors.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Şifre"
                    placeholderTextColor={colors.placeholder}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
              </View>

              {/* Full Name Input */}
              <View style={styles.inputContainer}>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="person-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Ad Soyad"
                    placeholderTextColor={colors.placeholder}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Phone Input */}
              <View style={styles.inputContainer}>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="call-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Telefon numarası"
                    placeholderTextColor={colors.placeholder}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Login Link */}
              <View style={styles.linkContainer}>
                <View style={styles.linkRow}>
                  <Text style={[styles.linkText, { color: colors.textSecondary }]}>Zaten hesabınız var mı? </Text>
                  <TouchableOpacity onPress={() => {setShowSignup(false); setShowLogin(true);}}>
                    <Text style={[styles.linkButtonBlue, { color: colors.primary }]}>Giriş Yap</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sign Up Button */}
              <View style={styles.buttonSpacing}>
                <Button
                  title="Kayıt Ol"
                  variant="filled"
                  size="medium"
                  shape="rectangular"
                  onPress={handleSignup}
                  disabled={loading || authLoading}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (showLogin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView 
          style={styles.flex1} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            style={styles.flex1}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo Section */}
            <View style={styles.illustrationSection}>
              {/* App Logo */}
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/images/app_icon_light.svg')} 
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>

              {/* Title */}
              <Text style={[styles.formTitle, { color: colors.text }]}>Giriş Yap</Text>
            </View>

            {/* Login Form */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="at-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="E-posta"
                    placeholderTextColor={colors.placeholder}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.iconSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.textInput, { color: colors.text }]}
                    placeholder="Şifre"
                    placeholderTextColor={colors.placeholder}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>
                <TouchableOpacity style={styles.forgotPassword}>
                  <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>Unuttum?</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <View style={styles.buttonSpacing}>
                <Button
                  title="Giriş Yap"
                  variant="filled"
                  size="medium"
                  shape="rectangular"
                  onPress={handleLogin}
                  disabled={loading || authLoading}
                />
              </View>

              {/* OR Divider */}
              <View style={styles.orDivider}>
                <View style={[styles.orLine, { backgroundColor: colors.divider }]} />
                <Text style={[styles.orText, { color: colors.textSecondary }]}>VEYA</Text>
                <View style={[styles.orLine, { backgroundColor: colors.divider }]} />
              </View>

              {/* Google Login Button */}
              <TouchableOpacity 
                style={[styles.googleButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleGoogleLogin}
              >
                <View style={styles.googleIcon}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={[styles.googleButtonText, { color: colors.text }]}>
                  Google ile Giriş
                </Text>
              </TouchableOpacity>

              {/* Register Link */}
              <View style={styles.linkContainer}>
                <View style={styles.linkRow}>
                  <Text style={[styles.linkText, { color: colors.textSecondary }]}>Borccu'da yeni misiniz? </Text>
                  <TouchableOpacity onPress={() => {setShowLogin(false); setShowSignup(true);}}>
                    <Text style={[styles.linkButton, { color: colors.primary }]}>Kayıt Ol</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Supabase Test Component - Sadece development'ta göster */}
      {__DEV__ && !isSupabaseConfigured && <SupabaseTestComponent />}
      
      {/* Logo and Title Area */}
      <View style={styles.illustrationContainer}>
        {/* App Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/app_icon_light.svg')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          Ortak harcamaları{'\n'}kolayca takip edin
        </Text>

        {/* Subtitle */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Faturaları kolayca bölün, ortak harcamaları takip edin ve arkadaşlarınızla hesaplaşın. Artık garip para konuşmaları yok.
        </Text>
      </View>

      {/* Bottom Section */}
      <View style={styles.bottomSection}>
        {/* Sign Up Button */}
        <View style={styles.buttonSpacing}>
          <Button
            title="Kayıt Ol"
            variant="outlined"
            size="medium"
            shape="rectangular"
            onPress={() => setShowSignup(true)}
          />
        </View>

        {/* Log In Button */}
        <View style={styles.buttonSpacing}>
          <Button
            title="Giriş Yap"
            variant="filled"
            size="medium"
            shape="rectangular"
            onPress={() => setShowLogin(true)}
          />
        </View>

        {/* Demo Mode Button - Only show if Supabase not configured */}
        {!isSupabaseConfigured && (
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => {
              Alert.alert(
                'Demo Modu',
                'Supabase yapılandırılmamış. Demo modda giriş yapılıyor.',
                [
                  {
                    text: 'Tamam',
                    onPress: () => router.replace('/(tabs)')
                  }
                ]
              );
            }}
          >
            <Text style={styles.demoButtonText}>
              Demo Modu ile Devam Et
            </Text>
          </TouchableOpacity>
        )}

        {/* Terms and Privacy */}
        <Text style={[styles.termsText, { color: colors.textSecondary }]}>
          Devam ederek{' '}
          <Text style={[styles.termsLink, { color: colors.primary }]}>Hizmet Şartlarımızı</Text> ve{'\n'}
          <Text style={[styles.termsLink, { color: colors.primary }]}>Gizlilik Politikamızı</Text> kabul etmiş olursunuz
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex1: {
    flex: 1,
  },
  
  // Logo and Title styles
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  logoContainer: {
    width: 120,
    height: 120,
    marginBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  illustrationSection: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
  illustrationBox: {
    width: 288,
    height: 240,
    backgroundColor: '#FED7AA',
    borderRadius: 16,
    marginBottom: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  person: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  person1: {
    backgroundColor: '#FBBF24',
  },
  person2: {
    backgroundColor: '#16A34A',
  },
  person3: {
    backgroundColor: '#FB923C',
  },
  illustrationLine: {
    width: 128,
    height: 12,
    backgroundColor: '#FED7AA',
    borderRadius: 6,
    marginTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111827',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  
  // Bottom section styles
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  demoButton: {
    backgroundColor: '#EAB308',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  demoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  termsText: {
    fontSize: 12,
    textAlign: 'center',
    color: '#6B7280',
    lineHeight: 16,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
  
  // Form styles
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  orText: {
    marginHorizontal: 16,
    color: '#9CA3AF',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 16,
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    color: '#374151',
    fontWeight: '500',
    fontSize: 16,
  },
  linkContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  linkRow: {
    flexDirection: 'row',
  },
  linkText: {
    color: '#6B7280',
    fontSize: 14,
  },
  linkButton: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  linkButtonBlue: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Signup illustration styles
  signupIllustration: {
    width: 256,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  signupBgElement1: {
    position: 'absolute',
    top: 16,
    left: 32,
    width: 24,
    height: 24,
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
  },
  signupBgElement2: {
    position: 'absolute',
    top: 48,
    right: 48,
    width: 16,
    height: 16,
    backgroundColor: '#FDE047',
    borderRadius: 8,
  },
  signupBgElement3: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    width: 12,
    height: 12,
    backgroundColor: '#F9A8D4',
    borderRadius: 6,
  },
  signupBgElement4: {
    position: 'absolute',
    bottom: 16,
    right: 32,
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: '#FB923C',
    borderRadius: 16,
  },
  signupBgElement5: {
    position: 'absolute',
    bottom: 24,
    right: 64,
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  handshakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handshakePerson: {
    width: 80,
    height: 96,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handshakePerson1: {
    backgroundColor: '#3B82F6',
    marginRight: 16,
  },
  handshakePerson2: {
    backgroundColor: '#F97316',
    marginLeft: 16,
  },
  handshakePersonHead: {
    width: 24,
    height: 24,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    marginBottom: 8,
  },
  handshakePersonBody: {
    width: 64,
    height: 48,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  handshakePersonBody1: {
    backgroundColor: '#3B82F6',
  },
  handshakePersonBody2: {
    backgroundColor: '#F97316',
  },
  handshake: {
    width: 32,
    height: 16,
    backgroundColor: '#FB923C',
    borderRadius: 8,
  },
  briefcase: {
    position: 'absolute',
    bottom: 48,
    width: 48,
    height: 32,
    backgroundColor: '#10B981',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  
  // Login illustration styles
  loginIllustration: {
    width: 256,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginCharacter: {
    width: 128,
    height: 128,
    backgroundColor: '#3B82F6',
    borderRadius: 64,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  loginCharacterInner: {
    width: 80,
    height: 80,
    backgroundColor: '#2563EB',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginCharacterHead: {
    width: 32,
    height: 32,
    backgroundColor: '#1F2937',
    borderRadius: 16,
    marginBottom: 8,
  },
  loginCharacterBody: {
    width: 64,
    height: 48,
    backgroundColor: '#2563EB',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  loginObject: {
    position: 'absolute',
    right: -8,
    top: 32,
    width: 24,
    height: 24,
    backgroundColor: '#F97316',
    borderRadius: 4,
    transform: [{ rotate: '12deg' }],
  },
  
  // Button margin styles
  buttonSpacing: {
    marginBottom: 16,
  },
  
  // Test component styles
  testContainer: {
    margin: 16,
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  testHeader: {
    marginBottom: 8,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  testResult: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 20,
  },
  testActions: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  testHint: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
});
