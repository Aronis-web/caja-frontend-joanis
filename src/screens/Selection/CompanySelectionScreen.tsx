import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { authService } from '@/services/AuthService';
import type { Company } from '@/types/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SelectionStackParamList } from '@/types/navigation';
import { SELECTION_ROUTES } from '@/constants/routes';

interface CompanySelectionScreenProps {
  navigation?: NativeStackNavigationProp<SelectionStackParamList, 'CompanySelection'>;
}

export const CompanySelectionScreen: React.FC<CompanySelectionScreenProps> = ({ navigation }) => {
  const { setCurrentCompany, user, logout } = useAuthStore();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Usuario no autenticado', [
        {
          text: 'OK',
          onPress: async () => {
            await logout();
          },
        },
      ]);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Cargando empresas para userId:', user.id);

      // Fetch companies from API using the same endpoint as admin-frontend
      const response = await authService.makeAuthenticatedRequest<Company[]>(
        `/companies?userId=${user.id}`
      );

      console.log('📦 Empresas recibidas:', response?.length || 0);

      if (!response || !Array.isArray(response)) {
        console.warn('⚠️ Respuesta inválida del servidor');
        setCompanies([]);
        return;
      }

      if (response.length === 0) {
        Alert.alert(
          'Sin Empresas',
          'No tienes acceso a ninguna empresa. Contacta al administrador.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await logout();
              },
            },
          ]
        );
        return;
      }

      // Filter active companies
      const activeCompanies = response.filter((c) => c.isActive);
      setCompanies(activeCompanies);

      // If user has only one company, auto-select it
      if (activeCompanies.length === 1) {
        console.log('✨ Solo hay 1 empresa, auto-seleccionando...');
        await handleSelectCompany(activeCompanies[0]);
      }
    } catch (error) {
      console.error('❌ Error loading companies:', error);
      Alert.alert('Error', 'No se pudieron cargar las empresas', [
        { text: 'Reintentar', onPress: loadCompanies },
        {
          text: 'Cerrar Sesión',
          onPress: async () => {
            await logout();
          },
          style: 'destructive',
        },
      ]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = async (company: Company) => {
    try {
      setSelectedCompanyId(company.id);
      console.log('🏢 Seleccionando empresa:', company.name);

      await setCurrentCompany(company);
      console.log('✅ Empresa seleccionada y guardada');

      // Navigate to site selection
      navigation?.navigate(SELECTION_ROUTES.SITE_SELECTION);
    } catch (error) {
      console.error('❌ Error selecting company:', error);
      Alert.alert('Error', 'No se pudo seleccionar la empresa');
      setSelectedCompanyId(null);
    }
  };

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Cargando empresas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🏢 Seleccionar Empresa</Text>
          <Text style={styles.headerSubtitle}>Hola, {user?.name || user?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>Selecciona la empresa con la que deseas trabajar</Text>
        </View>

        <View style={styles.companiesContainer}>
          {companies.map((company) => (
            <TouchableOpacity
              key={company.id}
              style={[
                styles.companyCard,
                selectedCompanyId === company.id && styles.companyCardSelected,
              ]}
              onPress={() => handleSelectCompany(company)}
              activeOpacity={0.7}
              disabled={selectedCompanyId === company.id}
            >
              <View style={styles.companyCardContent}>
                <View style={styles.companyIconContainer}>
                  <Text style={styles.companyIcon}>🏢</Text>
                </View>
                <View style={styles.companyInfo}>
                  <Text style={styles.companyName}>{company.alias || company.name}</Text>
                  {company.ruc && <Text style={styles.companyRuc}>RUC: {company.ruc}</Text>}
                  <View style={styles.companyFooter}>
                    <View
                      style={[
                        styles.statusBadge,
                        company.isActive ? styles.statusActive : styles.statusInactive,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          company.isActive ? styles.statusDotActive : styles.statusDotInactive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          company.isActive ? styles.statusTextActive : styles.statusTextInactive,
                        ]}
                      >
                        {company.isActive ? 'Activa' : 'Inactiva'}
                      </Text>
                    </View>
                  </View>
                </View>
                {selectedCompanyId === company.id && (
                  <View style={styles.loadingIndicator}>
                    <ActivityIndicator size="small" color="#667eea" />
                  </View>
                )}
              </View>
              <View style={styles.arrowContainer}>
                <Text style={styles.arrow}>→</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {companies.length}{' '}
            {companies.length === 1 ? 'empresa disponible' : 'empresas disponibles'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  companiesContainer: {
    gap: 12,
  },
  companyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  companyCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#F5F7FF',
  },
  companyCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  companyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  companyIcon: {
    fontSize: 28,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  companyRuc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  companyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#D1FAE5',
  },
  statusInactive: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#10B981',
  },
  statusDotInactive: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#059669',
  },
  statusTextInactive: {
    color: '#DC2626',
  },
  loadingIndicator: {
    marginLeft: 12,
  },
  arrowContainer: {
    marginTop: 12,
    alignItems: 'flex-end',
  },
  arrow: {
    fontSize: 24,
    color: '#667eea',
  },
  footer: {
    marginTop: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});

export default CompanySelectionScreen;
