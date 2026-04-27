/**
 * Close Session Screen (Legacy Redirect)
 * Mantiene compatibilidad con rutas antiguas y redirige al nuevo flujo de QR de cierre.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ROUTES } from '@/constants/routes';

export default function CloseSessionScreen() {
  const navigation = useNavigation();
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;

    const params = {
      mode: 'closure',
      autoStart: true,
      forceFlow: Date.now(),
    } as never;

    const nav = navigation as { replace?: (route: string, params?: unknown) => void };
    if (typeof nav.replace === 'function') {
      nav.replace(ROUTES.CASH_COLLECTION, params);
    } else {
      navigation.navigate(ROUTES.CASH_COLLECTION as never, params);
    }
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Redirigiendo al flujo de cierre...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    gap: 12,
  },
  text: {
    fontSize: 15,
    color: '#666',
  },
});
