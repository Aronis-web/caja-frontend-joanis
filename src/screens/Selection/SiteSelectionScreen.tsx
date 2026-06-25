import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/auth';
import { authService } from '@/services/AuthService';
import { config } from '@/utils/config';
import type { Site } from '@/types/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SelectionStackParamList } from '@/types/navigation';
import {
  Body,
  Caption,
  Card,
  Heading,
  StatusBadge,
  Title,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@/design-system';

interface ResolvedScope {
  id: string;
  appId: string;
  companyId?: string;
  siteId?: string;
  level: string;
  canRead: boolean;
  canWrite: boolean;
  path: string;
  company_name?: string;
  site_name?: string;
  site?: {
    id: string;
    code: string;
    name: string;
    companyId: string;
    isActive: boolean;
  };
}

interface SiteSelectionScreenProps {
  navigation?: NativeStackNavigationProp<SelectionStackParamList, 'SiteSelection'>;
}

export const SiteSelectionScreen: React.FC<SiteSelectionScreenProps> = ({ navigation }) => {
  const { setCurrentSite, currentCompany, setCurrentCompany, user, logout } = useAuthStore();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCompany) {
      Alert.alert(
        'Error',
        'No se ha seleccionado una empresa. Por favor, selecciona una empresa primero.',
        [{ text: 'OK', onPress: () => navigation?.goBack() }]
      );
      return;
    }
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany]);

  const loadSites = async () => {
    if (!user?.id) {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Usuario no autenticado');
        await logout();
      } else {
        Alert.alert('Error', 'Usuario no autenticado', [
          {
            text: 'OK',
            onPress: async () => {
              await logout();
            },
          },
        ]);
      }
      return;
    }

    if (!currentCompany) {
      Alert.alert('Error', 'No se ha seleccionado una empresa');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Cargando sedes para companyId:', currentCompany.id, 'userId:', user.id);

      const appId = config.APP_ID;
      console.log('🔍 AppId:', appId);

      // Get user scopes from the scopes API
      const userScopes = await authService.makeAuthenticatedRequest<ResolvedScope[]>(
        `/scopes/users/${user.id}/apps/${appId}/resolved`
      );

      console.log('📦 Scopes recibidos:', userScopes?.length || 0);

      if (!userScopes || !Array.isArray(userScopes)) {
        console.warn('⚠️ Respuesta inválida del servidor');
        setSites([]);
        return;
      }

      // Filter scopes for the selected company
      const companyScopes = userScopes.filter(
        (scope) => scope.companyId === currentCompany.id && scope.siteId
      );

      console.log('📋 Scopes filtrados para la empresa:', companyScopes.length);
      console.log('📋 Primer scope (ejemplo):', JSON.stringify(companyScopes[0], null, 2));

      // Extract unique sites from scopes
      const sitesMap = new Map<string, Site>();

      companyScopes.forEach((scope, index) => {
        console.log(`📋 Procesando scope ${index + 1}:`, {
          siteId: scope.siteId,
          hasSiteObject: !!scope.site,
          siteName: scope.site_name,
          siteObjectName: scope.site?.name,
        });

        if (scope.site && scope.site.id) {
          sitesMap.set(scope.site.id, {
            id: scope.site.id,
            code: scope.site.code,
            name: scope.site_name || scope.site.name || 'Sede sin nombre',
            companyId: scope.site.companyId,
            isActive: scope.site.isActive,
          });
        } else if (scope.siteId) {
          // If we have siteId but no site object, create a basic site entry
          console.log(
            `⚠️ Scope ${index + 1} tiene siteId pero no objeto site, creando entrada básica`
          );
          sitesMap.set(scope.siteId, {
            id: scope.siteId,
            code: scope.siteId.substring(0, 8), // Use first 8 chars of ID as code
            name: scope.site_name || 'Sede sin nombre',
            companyId: currentCompany.id,
            isActive: true,
          });
        }
      });

      const sitesArray = Array.from(sitesMap.values());
      console.log('📋 Sedes procesadas:', sitesArray.length, 'sedes encontradas');
      console.log('📋 Sedes:', JSON.stringify(sitesArray, null, 2));

      if (sitesArray.length === 0) {
        Alert.alert(
          'Sin Sedes',
          'No tienes acceso a ninguna sede en esta empresa. Contacta al administrador.',
          [
            {
              text: 'OK',
              onPress: () => navigation?.goBack(),
            },
          ]
        );
        return;
      }

      // Filter active sites
      const activeSites = sitesArray.filter((s) => s.isActive);
      setSites(activeSites);

      // If user has only one site, auto-select it
      if (activeSites.length === 1) {
        console.log('✨ Solo hay 1 sede, auto-seleccionando...');
        await handleSelectSite(activeSites[0]);
      }
    } catch (error) {
      console.error('❌ Error loading sites:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes', [
        { text: 'Reintentar', onPress: loadSites },
        {
          text: 'Volver',
          onPress: () => navigation?.goBack(),
          style: 'cancel',
        },
      ]);
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSite = async (site: Site) => {
    try {
      setSelectedSiteId(site.id);
      console.log('🏪 Seleccionando sede:', site.name);

      await setCurrentSite(site);
      console.log('✅ Sede seleccionada y guardada');

      // Navigate to cash register selection
      navigation?.navigate('CashRegisterSelection' as never);
    } catch (error) {
      console.error('❌ Error selecting site:', error);
      Alert.alert('Error', 'No se pudo seleccionar la sede');
      setSelectedSiteId(null);
    }
  };

  const handleBack = () => {
    Alert.alert('Cambiar Empresa', '¿Deseas seleccionar otra empresa?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cambiar',
        onPress: async () => {
          await setCurrentCompany(null);
          navigation?.goBack();
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
            Cargando sedes...
          </Body>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Body size="small" color="link">
            ← Cambiar Empresa
          </Body>
        </TouchableOpacity>
        <Heading size="medium" color="heading">
          🏪 Seleccionar Sede
        </Heading>
        <Body size="small" color="muted">
          {currentCompany?.alias || currentCompany?.name}
        </Body>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <Body size="small" color="link">
            ℹ️ Selecciona la sede con la que deseas trabajar
          </Body>
        </View>

        <View style={styles.sitesContainer}>
          {sites.map((site) => (
            <Card
              key={site.id}
              variant="outlined"
              padding="medium"
              onPress={() => handleSelectSite(site)}
              disabled={selectedSiteId === site.id}
              style={selectedSiteId === site.id ? styles.siteCardSelected : undefined}
            >
              <View style={styles.siteCardContent}>
                <View style={styles.siteIconContainer}>
                  <Body size="large">🏪</Body>
                </View>
                <View style={styles.siteInfo}>
                  <Title size="small" color="heading">
                    {site.name}
                  </Title>
                  <Caption color="muted" style={styles.siteCode}>
                    Código: {site.code}
                  </Caption>
                  <View style={styles.siteFooter}>
                    <StatusBadge
                      status={site.isActive ? 'active' : 'cancelled'}
                      label={site.isActive ? 'Activa' : 'Inactiva'}
                      size="small"
                    />
                  </View>
                </View>
                {selectedSiteId === site.id && (
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
            {sites.length} {sites.length === 1 ? 'sede disponible' : 'sedes disponibles'}
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
    },
    backButton: {
      marginBottom: theme.space[3],
      alignSelf: 'flex-start',
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
    sitesContainer: {
      gap: theme.space[3],
    },
    siteCardSelected: {
      borderColor: theme.color.action.primary.background,
      backgroundColor: theme.color.surface.subtle,
    },
    siteCardContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    siteIconContainer: {
      width: 56,
      height: 56,
      borderRadius: theme.radii.lg,
      backgroundColor: theme.color.background.subtle,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.space[4],
    },
    siteInfo: {
      flex: 1,
    },
    siteCode: {
      marginTop: theme.space[1],
      marginBottom: theme.space[2],
    },
    siteFooter: {
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

export default SiteSelectionScreen;
