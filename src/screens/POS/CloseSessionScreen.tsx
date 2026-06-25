/**
 * Close Session Screen (Legacy Redirect)
 * Mantiene compatibilidad con rutas antiguas y redirige al nuevo flujo de QR de cierre.
 */

import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ROUTES } from '@/constants/routes';
import { Body, useTheme, useThemedStyles, type Theme } from '@/design-system';

export default function CloseSessionScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
      (navigation.navigate as unknown as (route: string, params?: unknown) => void)(
        ROUTES.CASH_COLLECTION,
        params
      );
    }
  }, [navigation]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.color.text.link} />
      <Body size="medium" color="muted">
        Redirigiendo al flujo de cierre...
      </Body>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
      gap: theme.space[3],
    },
  });
