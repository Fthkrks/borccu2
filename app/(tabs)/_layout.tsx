import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import TabBarBackground from '@/components/ui/TabBarBackground';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#101828',
        tabBarInactiveTintColor: '#9CA3AF',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Borçlar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              size={24} 
              name={focused ? 'home' : 'home-outline'} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Arkadaşlar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              size={24} 
              name={focused ? 'people' : 'people-outline'} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Gruplar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              size={24} 
              name={focused ? 'albums' : 'albums-outline'} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ayarlar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons 
              size={24} 
              name={focused ? 'settings' : 'settings-outline'} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
