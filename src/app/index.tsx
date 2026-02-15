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

export const App = () => {
  const [fontsLoaded] = useFonts({
    Baloo2_700Bold,
    Baloo2_600SemiBold,
    Baloo2_500Medium,
  });

  const { initAuth, isLoading: authLoading } = useAuthStore();

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

  if (!fontsLoaded || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <Navigation />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});

export default App;
