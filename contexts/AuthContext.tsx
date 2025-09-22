import { Session, User } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import '../global.css';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string, phone?: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type AuthProviderProps = {
  children: React.ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!isSupabaseConfigured) {
          console.warn('⚠️ Supabase yapılandırılmamış, offline modda çalışıyor');
          setLoading(false);
          return;
        }

        // Mevcut oturumu al
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth session error:', error);
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setLoading(false);
      }
    };

    initAuth();

    if (!isSupabaseConfigured) {
      return;
    }

    try {
      // Auth durumu değişikliklerini dinle
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        try {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        } catch (error) {
          console.error('Auth state change error:', error);
        }
      });

      return () => {
        try {
          subscription.unsubscribe();
        } catch (error) {
          console.error('Auth subscription cleanup error:', error);
        }
      };
    } catch (error) {
      console.error('Auth listener setup error:', error);
    }
  }, []);

  const signUp = async (email: string, password: string, fullName?: string, phone?: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase yapılandırılmamış' } };
    }

    try {
      setLoading(true);
      
      console.log('📝 Attempting sign up with:', { 
        email, 
        passwordLength: password.length, 
        fullName, 
        phone 
      });
      
      // Önce API key'in auth için çalışıp çalışmadığını test et
      const { data: sessionTest, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('🔴 Auth API not available for signup:', sessionError);
        return { error: { message: 'Authentication servisi kullanılamıyor: ' + sessionError.message } };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
          },
        },
      });

      console.log('📝 Sign up response:', { 
        success: !error, 
        error: error?.message,
        user: data.user?.id,
        needsConfirmation: !data.user?.email_confirmed_at 
      });

      if (error) {
        console.error('🔴 Sign up error:', error);
        return { error };
      }

      if (data.user) {
        console.log('✅ User created successfully:', data.user.id);
        console.log('📧 Email confirmation required:', !data.user.email_confirmed_at);
        
        if (!data.user.email_confirmed_at) {
          console.log('⚠️ Email confirmation is required. Check your email inbox and spam folder.');
          console.log('📧 If you don\'t receive the email, check Supabase email settings.');
        } else {
          console.log('✅ Email already confirmed, user can login immediately.');
        }

        // Profile oluşturmayı deneyelim (trigger yoksa manuel)
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email!,
              full_name: fullName || null,
              phone: phone || null,
              trust_score: 3.0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (profileError) {
            console.warn('⚠️ Profile creation warning (may already exist):', profileError);
          } else {
            console.log('✅ Profile created successfully on signup');
          }
        } catch (profileErr) {
          console.warn('⚠️ Profile creation attempt failed:', profileErr);
        }
      }

      return { error: null }; // Signup başarılı
    } catch (error: any) {
      console.error('🔴 SignUp catch error:', error);
      return { error: { message: error.message || 'Kayıt olurken hata oluştu' } };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase yapılandırılmamış' } };
    }

    try {
      setLoading(true);
      
      console.log('🔐 Attempting sign in with:', { email, passwordLength: password.length });
      
      // Önce API key'in auth için çalışıp çalışmadığını test et
      const { data: sessionTest, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('🔴 Auth API not available:', sessionError);
        return { error: { message: 'Authentication servisi kullanılamıyor: ' + sessionError.message } };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      console.log('🔐 Sign in response:', { 
        success: !error, 
        error: error?.message,
        user: data.user?.id 
      });

      if (error) {
        console.error('🔴 Sign in error:', error);
        return { error };
      }

      // Kullanıcı giriş yaptıktan sonra profile'ın var olup olmadığını kontrol et
      if (data.user) {
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', data.user.id)
            .single();

          console.log('👤 Profile check:', { 
            found: !profileError, 
            error: profileError?.message 
          });

          // Eğer profile yoksa oluştur
          if (profileError && profileError.code === 'PGRST116') {
            console.log('👤 Profile not found, creating...');
            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                id: data.user.id,
                email: data.user.email!,
                full_name: data.user.user_metadata?.full_name || null,
                phone: data.user.user_metadata?.phone || null,
                trust_score: 3.0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (createError) {
              console.error('🔴 Profile creation error on signin:', createError);
              // Profile hatası olsa bile giriş başarılı sayalım
            } else {
              console.log('✅ Profile created successfully on signin');
            }
          }
        } catch (profileErr) {
          console.error('🔴 Profile operation error:', profileErr);
          // Profile işlemi hata verirse bile giriş başarılı sayalım
        }
      }

      return { error: null }; // Giriş başarılı
    } catch (error: any) {
      console.error('🔴 SignIn catch error:', error);
      return { error: { message: error.message || 'Giriş yaparken hata oluştu' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase yapılandırılmamış' } };
    }

    try {
      console.log('🚪 Setting loading to true...');
      setLoading(true);
      console.log('🚪 Attempting sign out...');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Sign out error:', error);
        setLoading(false);
        return { error };
      }
      
      // Logout sonrası state'i temizle
      console.log('✅ Sign out successful, clearing state...');
      setSession(null);
      setUser(null);
      console.log('🧹 State cleared - session:', null, 'user:', null);
      
      // Loading state'i biraz daha uzun tut ki kullanıcı loading screen'i görebilsin
      setTimeout(() => {
        console.log('⏰ Timeout completed, setting loading to false...');
        setLoading(false);
        console.log('🔄 Loading completed, redirect should happen automatically');
      }, 1500); // 1.5 saniye loading göster
      
      return { error: null };
    } catch (error) {
      console.error('❌ Sign out catch error:', error);
      setLoading(false);
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured) {
      return { error: { message: 'Supabase yapılandırılmamış' } };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const value: AuthContextType = {
    session,
    user,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

