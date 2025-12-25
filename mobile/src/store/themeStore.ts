/**
 * Theme Store using Zustand
 */

import {create} from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Appearance} from 'react-native';

interface ThemeState {
  isDarkMode: boolean;
  isSystemTheme: boolean;

  // Actions
  toggleTheme: () => void;
  setDarkMode: (isDark: boolean) => void;
  useSystemTheme: () => void;
  loadThemePreference: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDarkMode: false,
  isSystemTheme: true,

  toggleTheme: async () => {
    const newValue = !get().isDarkMode;
    set({isDarkMode: newValue, isSystemTheme: false});
    await AsyncStorage.setItem('theme', newValue ? 'dark' : 'light');
  },

  setDarkMode: async (isDark: boolean) => {
    set({isDarkMode: isDark, isSystemTheme: false});
    await AsyncStorage.setItem('theme', isDark ? 'dark' : 'light');
  },

  useSystemTheme: async () => {
    const colorScheme = Appearance.getColorScheme();
    set({isDarkMode: colorScheme === 'dark', isSystemTheme: true});
    await AsyncStorage.setItem('theme', 'system');
  },

  loadThemePreference: async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme === 'dark') {
        set({isDarkMode: true, isSystemTheme: false});
      } else if (savedTheme === 'light') {
        set({isDarkMode: false, isSystemTheme: false});
      } else {
        // Use system theme
        const colorScheme = Appearance.getColorScheme();
        set({isDarkMode: colorScheme === 'dark', isSystemTheme: true});
      }
    } catch (error) {
      // Default to light theme
      set({isDarkMode: false, isSystemTheme: true});
    }
  },
}));

// Listen to system theme changes
Appearance.addChangeListener(({colorScheme}) => {
  const state = useThemeStore.getState();
  if (state.isSystemTheme) {
    useThemeStore.setState({isDarkMode: colorScheme === 'dark'});
  }
});
