// IMPORTANT: This must be imported FIRST before any other imports that use crypto/uuid
import 'react-native-get-random-values';

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, ActivityIndicator, View, StyleSheet } from 'react-native';
import {
  useFonts,
  Baloo2_700Bold,
  Baloo2_600SemiBold,
  Baloo2_500Medium,
} from '@expo-google-fonts/baloo-2';
import { Navigation } from '@/navigation';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider, FloatingFooterProvider, useTheme, useThemeValue } from '@/design-system';

export const App = () => {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🚀 Iniciando aplicación Caja...');
        await initAuth();
        console.log('✅ Autenticación inicializada');
      } catch (error) {
        console.error('❌ Error al inicializar:', error);
        const { setLoading } = useAuthStore.getState();
        setLoading(false);
      }
    };

    initialize();
  }, [initAuth]);

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <FloatingFooterProvider>
          <ThemedStatusBar />
          <AppContent />
        </FloatingFooterProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
};

const AppContent = () => {
  const theme = useTheme();
  const [fontsLoaded] = useFonts({
    Baloo2_700Bold,
    Baloo2_600SemiBold,
    Baloo2_500Medium,
  });
  const authLoading = useAuthStore((s) => s.isLoading);

  if (!fontsLoaded || authLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.color.background.canvas }]}>
        <ActivityIndicator size="large" color={theme.color.action.primary.background} />
      </View>
    );
  }

  return <Navigation />;
};

const ThemedStatusBar = () => {
  const { isDark } = useThemeValue();
  return (
    <StatusBar
      barStyle={isDark ? 'light-content' : 'dark-content'}
      translucent
      backgroundColor="transparent"
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
