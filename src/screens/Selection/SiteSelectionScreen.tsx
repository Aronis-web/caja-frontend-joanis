import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuthStore } from '@/store/auth';
import { authService } from '@/services/AuthService';
import type { Site } from '@/types/auth';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SelectionStackParamList } from '@/types/navigation';

interface SiteSelectionScreenProps {
  navigation?: NativeStackNavigationProp<SelectionStackParamList, 'SiteSelection'>;
}

export const SiteSelectionScreen: React.FC<SiteSelectionScreenProps> = ({ navigation }) => {
  const { setCurrentSite, currentCompany, setCurrentCompany } = useAuthStore();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentCompany) {
      navigation?.goBack();
      return;
    }
    loadSites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany]);

  const loadSites = async () => {
    if (!currentCompany) return;

    try {
      setLoading(true);
      // Fetch sites from API
      const response = await authService.makeAuthenticatedRequest<{ data: Site[] }>(
        `/companies/${currentCompany.id}/sites`
      );

      if (response.data && Array.isArray(response.data)) {
        const activeSites = response.data.filter((s) => s.isActive);
        setSites(activeSites);
      } else {
        setSites([]);
      }
    } catch (error) {
      console.error('Error loading sites:', error);
      Alert.alert('Error', 'No se pudieron cargar las sedes');
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSite = async (site: Site) => {
    try {
      await setCurrentSite(site);
      console.log('✅ Sede seleccionada:', site.name);
      // Navigation will automatically switch to MainStack when currentSite is set
    } catch (error) {
      console.error('Error selecting site:', error);
      Alert.alert('Error', 'No se pudo seleccionar la sede');
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

  const renderSiteItem = ({ item }: { item: Site }) => (
    <TouchableOpacity style={styles.siteCard} onPress={() => handleSelectSite(item)}>
      <View style={styles.siteInfo}>
        <Text style={styles.siteName}>{item.name}</Text>
        <Text style={styles.siteCode}>Código: {item.code}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando sedes...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹ Atrás</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seleccionar Sede</Text>
        <Text style={styles.subtitle}>{currentCompany?.name}</Text>
      </View>

      {sites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay sedes disponibles</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadSites}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sites}
          renderItem={renderSiteItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    padding: 16,
  },
  siteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  siteInfo: {
    flex: 1,
  },
  siteName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  siteCode: {
    fontSize: 14,
    color: '#999',
  },
  arrow: {
    fontSize: 32,
    color: '#007AFF',
    fontWeight: '300',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SiteSelectionScreen;
