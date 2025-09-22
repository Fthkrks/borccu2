import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Background colors
  background: string;
  surface: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary: string;
  
  // Primary colors
  primary: string;
  primaryText: string;
  
  // Border and divider colors
  border: string;
  divider: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  
  // Icon colors
  icon: string;
  iconSecondary: string;
  
  // Input colors
  inputBackground: string;
  inputBorder: string;
  placeholder: string;
}

const lightTheme: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  card: '#FFFFFF',
  
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  
  primary: '#3B82F6',
  primaryText: '#FFFFFF',
  
  border: '#E5E7EB',
  divider: '#F3F4F6',
  
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  
  icon: '#6B7280',
  iconSecondary: '#9CA3AF',
  
  inputBackground: '#F9FAFB',
  inputBorder: '#F3F4F6',
  placeholder: '#9CA3AF',
};

const darkTheme: ThemeColors = {
  background: '#111827',
  surface: '#1F2937',
  card: '#374151',
  
  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textTertiary: '#9CA3AF',
  
  primary: '#60A5FA',
  primaryText: '#1F2937',
  
  border: '#4B5563',
  divider: '#374151',
  
  success: '#059669', // Daha koyu yeşil
  warning: '#D97706', // Daha koyu sarı/turuncu
  error: '#DC2626', // Daha koyu kırmızı
  
  icon: '#D1D5DB',
  iconSecondary: '#9CA3AF',
  
  inputBackground: '#374151',
  inputBorder: '#4B5563',
  placeholder: '#9CA3AF',
};

interface ThemeContextType {
  themeMode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  // Determine if we should use dark theme
  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemColorScheme === 'dark');
  const colors = isDark ? darkTheme : lightTheme;

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme preference:', error);
      }
    };

    loadTheme();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const value: ThemeContextType = {
    themeMode,
    colors,
    isDark,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
