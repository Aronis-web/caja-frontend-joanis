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

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      // Fetch companies from API
      const response = await authService.makeAuthenticatedRequest<{ data: Company[] }>(
        '/companies'
      );

      if (response.data && Array.isArray(response.data)) {
        const activeCompanies = response.data.filter((c) => c.isActive);
        setCompanies(activeCompanies);
      } else {
        setCompanies([]);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      Alert.alert('Error', 'No se pudieron cargar las empresas');
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCompany = async (company: Company) => {
    try {
      await setCurrentCompany(company);
      console.log('✅ Empresa seleccionada:', company.name);
      navigation?.navigate(SELECTION_ROUTES.SITE_SELECTION);
    } catch (error) {
      console.error('Error selecting company:', error);
      Alert.alert('Error', 'No se pudo seleccionar la empresa');
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

  const renderCompanyItem = ({ item }: { item: Company }) => (
    <TouchableOpacity style={styles.companyCard} onPress={() => handleSelectCompany(item)}>
      <View style={styles.companyInfo}>
        <Text style={styles.companyName}>{item.name}</Text>
        {item.alias && <Text style={styles.companyAlias}>{item.alias}</Text>}
        {item.ruc && <Text style={styles.companyRuc}>RUC: {item.ruc}</Text>}
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando empresas...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Seleccionar Empresa</Text>
        <Text style={styles.subtitle}>Hola, {user?.name}</Text>
      </View>

      {companies.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No hay empresas disponibles</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadCompanies}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={companies}
          renderItem={renderCompanyItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
      </TouchableOpacity>
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
  companyCard: {
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
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  companyAlias: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  companyRuc: {
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
  logoutButton: {
    margin: 16,
    backgroundColor: '#FF3B30',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CompanySelectionScreen;
