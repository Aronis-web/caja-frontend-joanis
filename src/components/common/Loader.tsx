import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme, useThemedStyles, Body, type Theme } from '@/design-system';

interface LoaderProps {
  fullScreen?: boolean;
  text?: string;
  size?: 'small' | 'large';
}

export const Loader: React.FC<LoaderProps> = ({ fullScreen = false, text, size = 'large' }) => {
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const content = (
    <>
      <ActivityIndicator size={size} color={theme.color.action.primary.background} />
      {text && (
        <Body size="small" color="muted" style={styles.text}>
          {text}
        </Body>
      )}
    </>
  );

  if (fullScreen) {
    return <View style={styles.fullScreenContainer}>{content}</View>;
  }

  return <View style={styles.container}>{content}</View>;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    fullScreenContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.background.canvas,
    },
    container: {
      padding: theme.space[5],
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      marginTop: theme.space[3],
    },
  });
