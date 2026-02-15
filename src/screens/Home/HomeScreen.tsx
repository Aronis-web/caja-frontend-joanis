import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';

interface HomeScreenProps {
  navigation?: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = () => {
  const { user, currentCompany, currentSite, logout, setCurrentCompany, setCurrentSite } =
    useAuthStore();

  const handleLogout = async () => {
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
          <Ionicons name="person-circle-outline" size={64} color="#6366F1" />
          <Text style={styles.welcomeText}>Bienvenido</Text>
          <Text style={styles.userName}>{user?.name || 'Usuario'}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <Ionicons name="business-outline" size={24} color="#6366F1" />
            <Text style={styles.contextTitle}>Contexto Actual</Text>
          </View>

          <View style={styles.contextItem}>
            <Text style={styles.contextLabel}>Empresa</Text>
            <Text style={styles.contextValue}>{currentCompany?.name || 'No seleccionada'}</Text>
            {currentCompany?.ruc && (
              <Text style={styles.contextDetail}>RUC: {currentCompany.ruc}</Text>
            )}
            <TouchableOpacity style={styles.changeButton} onPress={handleChangeCompany}>
              <Ionicons name="swap-horizontal-outline" size={16} color="#FFFFFF" />
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
              <Ionicons name="swap-horizontal-outline" size={16} color="#FFFFFF" />
              <Text style={styles.changeButtonText}>Cambiar Sede</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={32} color="#6366F1" />
          <Text style={styles.infoTitle}>Proyecto en Desarrollo</Text>
          <Text style={styles.infoText}>
            Esta es la pantalla principal de Caja Grit. Las funcionalidades del sistema de punto de
            venta se agregarán próximamente.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoInner: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  welcomeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 8,
  },
  userEmail: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  contextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  contextTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 8,
  },
  contextItem: {
    marginBottom: 8,
  },
  contextLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  contextValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  contextDetail: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 12,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6366F1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  changeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  infoCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4338CA',
    marginTop: 12,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6366F1',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default HomeScreen;
