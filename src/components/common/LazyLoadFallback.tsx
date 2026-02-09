import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

interface LazyLoadFallbackProps {
  message?: string;
}

/**
 * Fallback component shown while lazy-loaded screens are loading
 */
export const LazyLoadFallback: React.FC<LazyLoadFallbackProps> = ({
  message = 'Cargando...',
}) => {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6366F1" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
});
