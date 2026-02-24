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
import { config } from '@/utils/config';
import type { Site } from '@/types/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SelectionStackParamList } from '@/types/navigation';

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
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Cargando sedes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Cambiar Empresa</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🏪 Seleccionar Sede</Text>
          <Text style={styles.headerSubtitle}>{currentCompany?.alias || currentCompany?.name}</Text>
        </View>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>Selecciona la sede con la que deseas trabajar</Text>
        </View>

        <View style={styles.sitesContainer}>
          {sites.map((site) => (
            <TouchableOpacity
              key={site.id}
              style={[styles.siteCard, selectedSiteId === site.id && styles.siteCardSelected]}
              onPress={() => handleSelectSite(site)}
              activeOpacity={0.7}
              disabled={selectedSiteId === site.id}
            >
              <View style={styles.siteCardContent}>
                <View style={styles.siteIconContainer}>
                  <Text style={styles.siteIcon}>🏪</Text>
                </View>
                <View style={styles.siteInfo}>
                  <Text style={styles.siteName}>{site.name}</Text>
                  <Text style={styles.siteCode}>Código: {site.code}</Text>
                  <View style={styles.siteFooter}>
                    <View
                      style={[
                        styles.statusBadge,
                        site.isActive ? styles.statusActive : styles.statusInactive,
                      ]}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          site.isActive ? styles.statusDotActive : styles.statusDotInactive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          site.isActive ? styles.statusTextActive : styles.statusTextInactive,
                        ]}
                      >
                        {site.isActive ? 'Activa' : 'Inactiva'}
                      </Text>
                    </View>
                  </View>
                </View>
                {selectedSiteId === site.id && (
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
            {sites.length} {sites.length === 1 ? 'sede disponible' : 'sedes disponibles'}
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
  },
  headerContent: {
    flex: 1,
  },
  backButton: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
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
  sitesContainer: {
    gap: 12,
  },
  siteCard: {
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
  siteCardSelected: {
    borderColor: '#667eea',
    backgroundColor: '#F5F7FF',
  },
  siteCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  siteIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  siteIcon: {
    fontSize: 28,
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  siteCode: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  siteFooter: {
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

export default SiteSelectionScreen;
