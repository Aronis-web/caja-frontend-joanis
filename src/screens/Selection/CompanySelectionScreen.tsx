import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { authService } from '@/services/AuthService';
import type { Company } from '@/types/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SelectionStackParamList } from '@/types/navigation';
import { SELECTION_ROUTES } from '@/constants/routes';
import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  StatusBadge,
  Title,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@/design-system';

interface CompanySelectionScreenProps {
  navigation?: NativeStackNavigationProp<SelectionStackParamList, 'CompanySelection'>;
}

export const CompanySelectionScreen: React.FC<CompanySelectionScreenProps> = ({ navigation }) => {
  const { setCurrentCompany, user, logout } = useAuthStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
      const response = await authService.makeAuthenticatedRequest<{ data: Company[] } | Company[]>(
        `/companies?userId=${user.id}`
      );

      console.log('📦 Respuesta completa del servidor:', JSON.stringify(response, null, 2));
      console.log('📦 Tipo de respuesta:', typeof response);
      console.log('📦 Es array:', Array.isArray(response));

      // Handle both response formats: { data: Company[] } or Company[]
      let companiesData: Company[] = [];

      if (Array.isArray(response)) {
        companiesData = response;
      } else if (
        response &&
        typeof response === 'object' &&
        'data' in response &&
        Array.isArray(response.data)
      ) {
        companiesData = response.data;
      } else {
        console.warn('⚠️ Respuesta inválida del servidor');
        console.warn('⚠️ Respuesta recibida:', response);
        setCompanies([]);
        return;
      }

      console.log('📦 Empresas procesadas:', companiesData.length);

      if (companiesData.length === 0) {
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
      const activeCompanies = companiesData.filter((c) => c.isActive);
      console.log('📦 Empresas activas:', activeCompanies.length);
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
    // En web/Electron usar confirm para asegurar ejecución del callback
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.action.primary.background} />
          <Body size="medium" color="muted" style={styles.loadingText}>
            Cargando empresas...
          </Body>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Heading size="medium" color="heading">
            🏢 Seleccionar Empresa
          </Heading>
          <Body size="small" color="muted">
            Hola, {user?.name || user?.email}
          </Body>
        </View>
        <Button title="Salir" onPress={handleLogout} variant="danger" size="small" />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Body size="small" color="link">
            ℹ️ Selecciona la empresa con la que deseas trabajar
          </Body>
        </View>

        <View style={styles.companiesContainer}>
          {companies.map((company) => (
            <Card
              key={company.id}
              variant="outlined"
              padding="medium"
              onPress={() => handleSelectCompany(company)}
              disabled={selectedCompanyId === company.id}
              style={selectedCompanyId === company.id ? styles.companyCardSelected : undefined}
            >
              <View style={styles.companyCardContent}>
                <View style={styles.companyIconContainer}>
                  <Body size="large">🏢</Body>
                </View>
                <View style={styles.companyInfo}>
                  <Title size="small" color="heading">
                    {company.alias || company.name}
                  </Title>
                  {company.ruc && (
                    <Caption color="muted" style={styles.companyRuc}>
                      RUC: {company.ruc}
                    </Caption>
                  )}
                  <View style={styles.companyFooter}>
                    <StatusBadge
                      status={company.isActive ? 'active' : 'cancelled'}
                      label={company.isActive ? 'Activa' : 'Inactiva'}
                      size="small"
                    />
                  </View>
                </View>
                {selectedCompanyId === company.id && (
                  <ActivityIndicator
                    size="small"
                    color={theme.color.action.primary.background}
                    style={styles.loadingIndicator}
                  />
                )}
              </View>
            </Card>
          ))}
        </View>

        <View style={styles.footer}>
          <Caption color="subtle">
            {companies.length}{' '}
            {companies.length === 1 ? 'empresa disponible' : 'empresas disponibles'}
          </Caption>
        </View>
      </ScrollView>
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
      backgroundColor: theme.color.surface.base,
      paddingHorizontal: theme.space[5],
      paddingVertical: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.space[3],
    },
    headerContent: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: theme.space[3],
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: theme.space[5],
    },
    infoCard: {
      backgroundColor: theme.color.state.info.background,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      marginBottom: theme.space[6],
      borderWidth: 1,
      borderColor: theme.color.state.info.border,
    },
    companiesContainer: {
      gap: theme.space[3],
    },
    companyCardSelected: {
      borderColor: theme.color.action.primary.background,
      backgroundColor: theme.color.surface.subtle,
    },
    companyCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    companyIconContainer: {
      width: 56,
      height: 56,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.background.subtle,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[4],
    },
    companyInfo: {
      flex: 1,
    },
    companyRuc: {
      marginTop: theme.space[1],
      marginBottom: theme.space[2],
    },
    companyFooter: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    loadingIndicator: {
      marginLeft: theme.space[3],
    },
    footer: {
      marginTop: theme.space[6],
      paddingVertical: theme.space[4],
      alignItems: 'center',
    },
  });

export default CompanySelectionScreen;
