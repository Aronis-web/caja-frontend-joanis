import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface LoaderProps {
  fullScreen?: boolean;
  text?: string;
  size?: 'small' | 'large';
}

export const Loader: React.FC<LoaderProps> = ({ fullScreen = false, text, size = 'large' }) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreenContainer}>
        <ActivityIndicator size={size} color="#6366F1" />
        {text && <Text style={styles.text}>{text}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color="#6366F1" />
      {text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  container: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
});
