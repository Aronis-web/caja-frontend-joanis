import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';

interface HomeScreenProps {
  navigation?: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = () => {
  const { user, currentCompany, currentSite, logout, setCurrentCompany, setCurrentSite } =
    useAuthStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleLogout = async () => {
    if (typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm('¿Estás seguro de que deseas cerrar sesión?');
      if (!confirmed) return;
      await logout();
      return;
    }

    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleChangeCompany = async () => {
    Alert.alert('Cambiar Empresa', '¿Deseas cambiar de empresa y sede?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cambiar',
        onPress: async () => {
          await setCurrentSite(null);
          await setCurrentCompany(null);
        },
      },
    ]);
  };

  const handleChangeSite = async () => {
    Alert.alert('Cambiar Sede', '¿Deseas cambiar de sede?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cambiar',
        onPress: async () => {
          await setCurrentSite(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoInner}>
            <Text style={styles.logo}>CG</Text>
          </View>
        </View>
        <Text style={styles.title}>Caja Grit</Text>
        <Text style={styles.subtitle}>Sistema de Punto de Venta</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.welcomeCard}>
          <Ionicons name="person-circle-outline" size={64} color={theme.color.brand.accent} />
          <Text style={styles.welcomeText}>Bienvenido</Text>
          <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <Ionicons name="business-outline" size={24} color={theme.color.brand.accent} />
            <Text style={styles.contextTitle}>Contexto Actual</Text>
          </View>

          <View style={styles.contextItem}>
            <Text style={styles.contextLabel}>Empresa</Text>
            <Text style={styles.contextValue}>{currentCompany?.name || 'No seleccionada'}</Text>
            {currentCompany?.ruc && (
              <Text style={styles.contextDetail}>RUC: {currentCompany.ruc}</Text>
            )}
            <TouchableOpacity style={styles.changeButton} onPress={handleChangeCompany}>
              <Ionicons
                name="swap-horizontal-outline"
                size={16}
                color={theme.color.text.onAction}
              />
              <Text style={styles.changeButtonText}>Cambiar Empresa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.contextItem}>
            <Text style={styles.contextLabel}>Sede</Text>
            <Text style={styles.contextValue}>{currentSite?.name || 'No seleccionada'}</Text>
            {currentSite?.code && (
              <Text style={styles.contextDetail}>Código: {currentSite.code}</Text>
            )}
            <TouchableOpacity style={styles.changeButton} onPress={handleChangeSite}>
              <Ionicons
                name="swap-horizontal-outline"
                size={16}
                color={theme.color.text.onAction}
              />
              <Text style={styles.changeButtonText}>Cambiar Sede</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={32} color={theme.color.brand.accent} />
          <Text style={styles.infoTitle}>Proyecto en Desarrollo</Text>
          <Text style={styles.infoText}>
            Esta es la pantalla principal de Caja Grit. Las funcionalidades del sistema de punto de
            venta se agregarán próximamente.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={theme.color.text.onAction} />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      alignItems: 'center',
      paddingVertical: theme.space[8],
      backgroundColor: theme.color.surface.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    logoContainer: {
      marginBottom: theme.space[4],
    },
    logoInner: {
      width: 64,
      height: 64,
      borderRadius: theme.radii.xl,
      backgroundColor: theme.color.brand.accent,
      justifyContent: 'center',
      alignItems: 'center',
      ...theme.shadow.md,
    },
    logo: {
      fontSize: 28,
      fontWeight: '800',
      color: theme.color.text.onAction,
      letterSpacing: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    content: {
      flex: 1,
      padding: theme.space[6],
    },
    welcomeCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[8],
      alignItems: 'center',
      marginBottom: theme.space[6],
      ...theme.shadow.sm,
    },
    welcomeText: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.muted,
      marginTop: theme.space[4],
    },
    userName: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginTop: theme.space[2],
    },
    userEmail: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginTop: theme.space[1],
    },
    contextCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[5],
      marginBottom: theme.space[6],
      ...theme.shadow.sm,
    },
    contextHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[5],
    },
    contextTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginLeft: theme.space[2],
    },
    contextItem: {
      marginBottom: theme.space[2],
    },
    contextLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.color.text.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: theme.space[1],
    },
    contextValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    contextDetail: {
      fontSize: 14,
      color: theme.color.text.subtle,
      marginBottom: theme.space[3],
    },
    changeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.brand.accent,
      paddingVertical: theme.space[2],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.md,
      alignSelf: 'flex-start',
    },
    changeButtonText: {
      color: theme.color.text.onAction,
      fontSize: 14,
      fontWeight: '600',
      marginLeft: theme.space[1.5],
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.subtle,
      marginVertical: theme.space[4],
    },
    infoCard: {
      backgroundColor: theme.color.state.info.background,
      borderRadius: theme.radii.xl,
      padding: theme.space[6],
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
    },
    infoTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.state.info.text,
      marginTop: theme.space[3],
      marginBottom: theme.space[2],
    },
    infoText: {
      fontSize: 14,
      color: theme.color.text.link,
      textAlign: 'center',
      lineHeight: 20,
    },
    footer: {
      padding: theme.space[6],
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.color.action.danger.background,
      paddingVertical: theme.space[4],
      paddingHorizontal: theme.space[6],
      borderRadius: theme.radii.lg,
      ...theme.shadow.md,
    },
    logoutButtonText: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '600',
      marginLeft: theme.space[2],
    },
  });

export default HomeScreen;
