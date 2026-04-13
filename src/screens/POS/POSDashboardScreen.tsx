/**
 * POS Dashboard Screen
 * Main POS interface showing session status and action buttons
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { usePOSStore } from '@/store/pos';
import { useOfflineStore } from '@/store/offline';
import { offlineSyncService } from '@/services/OfflineSyncService';
import { offlineDatabase } from '@/services/OfflineDatabase';
import { ROUTES } from '@/constants/routes';

// Tipos para la API de Electron
interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseDate?: string;
  updateDownloaded?: boolean;
  message?: string;
  error?: string;
}

interface ElectronAPI {
  isElectron: boolean;
  getAppVersion: () => Promise<{ version: string; name: string }>;
  checkForUpdates: () => Promise<UpdateInfo>;
  downloadUpdate: () => Promise<{ success: boolean; message?: string; error?: string }>;
  installUpdate: () => Promise<{ success: boolean; message?: string }>;
  onUpdateStatus: (callback: (status: { status: string; version: string }) => void) => void;
  onDownloadProgress: (callback: (progress: { percent: number }) => void) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export default function POSDashboardScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const {
    selectedCashRegister,
    currentSession,
    refreshSession,
    loadActiveSession,
    isLoading,
    reset: resetPOSStore,
  } = usePOSStore();

  const [refreshing, setRefreshing] = useState(false);

  // Estados para el modal de configuración
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'sync' | 'updates'>('sync');

  // Estados de sincronización offline
  const {
    totalProducts,
    availableTokens,
    pendingSales,
    lastProductSync,
    isInitialized: offlineInitialized,
    refreshStats,
  } = useOfflineStore();
  const [syncing, setSyncing] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);
  const [syncingTokens, setSyncingTokens] = useState(false);
  const [syncingSales, setSyncingSales] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Estados para el modal de actualizaciones
  const [currentVersion, setCurrentVersion] = useState('...');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateReady, setUpdateReady] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  // Verificar si estamos en Electron (o web en general para mostrar el botón)
  const isElectron =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    (window.electronAPI?.isElectron || window.electronAPI !== undefined);

  // Cargar versión actual
  useEffect(() => {
    if (isElectron && window.electronAPI) {
      window.electronAPI.getAppVersion().then((info) => {
        setCurrentVersion(info.version);
      });

      // Escuchar eventos de actualización
      window.electronAPI.onUpdateStatus((status) => {
        if (status.status === 'downloaded') {
          setUpdateReady(true);
          setDownloading(false);
        }
      });

      window.electronAPI.onDownloadProgress((progress) => {
        setDownloadProgress(Math.round(progress.percent));
      });
    }
  }, [isElectron]);

  // Verificar actualizaciones
  const handleCheckUpdates = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return;

    setCheckingUpdate(true);
    setUpdateInfo(null);

    try {
      const result = await window.electronAPI.checkForUpdates();
      setUpdateInfo(result);
      if (result.updateDownloaded) {
        setUpdateReady(true);
      }
    } catch (error) {
      console.error('Error checking updates:', error);
      setUpdateInfo({
        updateAvailable: false,
        currentVersion: currentVersion,
        error: 'Error al verificar actualizaciones',
      });
    } finally {
      setCheckingUpdate(false);
    }
  }, [isElectron, currentVersion]);

  // Descargar actualización
  const handleDownloadUpdate = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return;

    setDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);

    try {
      await window.electronAPI.downloadUpdate();
    } catch (error) {
      console.error('Error downloading update:', error);
      setDownloading(false);
      setDownloadError('No se pudo descargar la actualización. Verifique su conexión a internet.');
    }
  }, [isElectron]);

  // Instalar actualización
  const handleInstallUpdate = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return;

    setInstallError(null);

    try {
      await window.electronAPI.installUpdate();
    } catch (error) {
      console.error('Error installing update:', error);
      setInstallError('No se pudo instalar la actualización. Intente reiniciar manualmente.');
    }
  }, [isElectron]);

  // Reintentar descarga
  const handleRetryDownload = useCallback(() => {
    setDownloadError(null);
    setUpdateInfo(null);
    handleCheckUpdates();
  }, [handleCheckUpdates]);

  // Cerrar modal y resetear estados
  const handleCloseSettingsModal = useCallback(() => {
    if (!downloading && !updateReady && !syncing) {
      setSettingsModalVisible(false);
      setUpdateInfo(null);
      setDownloadError(null);
      setInstallError(null);
      setSyncError(null);
      setSyncSuccess(null);
    }
  }, [downloading, updateReady, syncing]);

  // ============ FUNCIONES DE SINCRONIZACIÓN ============

  // Sincronización completa (productos + tokens)
  const handleFullSync = useCallback(async () => {
    if (!selectedCashRegister?.id) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('🔄 [SETTINGS] Iniciando sincronización completa...');
      await offlineSyncService.performInitialSync(selectedCashRegister.id);
      await refreshStats();
      setLastSyncTime(new Date().toISOString());
      setSyncSuccess('Sincronización completa exitosa');
      console.log('✅ [SETTINGS] Sincronización completa exitosa');
    } catch (error) {
      console.error('❌ [SETTINGS] Error en sincronización:', error);
      setSyncError(error instanceof Error ? error.message : 'Error en sincronización');
    } finally {
      setSyncing(false);
    }
  }, [selectedCashRegister?.id, refreshStats]);

  // Sincronizar solo productos
  const handleSyncProducts = useCallback(async () => {
    if (!selectedCashRegister?.id) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('📦 [SETTINGS] Sincronizando productos...');
      await offlineSyncService.syncProducts(selectedCashRegister.id, 'full');
      await refreshStats();
      setLastSyncTime(new Date().toISOString());
      setSyncSuccess('Productos sincronizados correctamente');
    } catch (error) {
      console.error('❌ [SETTINGS] Error sincronizando productos:', error);
      setSyncError(error instanceof Error ? error.message : 'Error sincronizando productos');
    } finally {
      setSyncing(false);
    }
  }, [selectedCashRegister?.id, refreshStats]);

  // Sincronizar solo stock (delta)
  const handleSyncStock = useCallback(async () => {
    if (!selectedCashRegister?.id) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    setSyncingStock(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('📊 [SETTINGS] Sincronizando stock...');
      await offlineSyncService.syncStock(selectedCashRegister.id);
      await refreshStats();
      setSyncSuccess('Stock actualizado correctamente');
    } catch (error) {
      console.error('❌ [SETTINGS] Error sincronizando stock:', error);
      setSyncError(error instanceof Error ? error.message : 'Error sincronizando stock');
    } finally {
      setSyncingStock(false);
    }
  }, [selectedCashRegister?.id, refreshStats]);

  // Reponer tokens
  const handleReplenishTokens = useCallback(async () => {
    if (!selectedCashRegister?.id) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    setSyncingTokens(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('🎫 [SETTINGS] Reponiendo tokens...');
      await offlineSyncService.ensureTokenPool(selectedCashRegister.id);
      await refreshStats();
      setSyncSuccess('Tokens reabastecidos correctamente');
    } catch (error) {
      console.error('❌ [SETTINGS] Error reponiendo tokens:', error);
      setSyncError(error instanceof Error ? error.message : 'Error reponiendo tokens');
    } finally {
      setSyncingTokens(false);
    }
  }, [selectedCashRegister?.id, refreshStats]);

  // Sincronizar ventas pendientes (MANUAL)
  const handleSyncPendingSales = useCallback(async () => {
    if (!selectedCashRegister?.id) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    if (pendingSales === 0) {
      setSyncSuccess('No hay ventas pendientes para sincronizar');
      return;
    }

    setSyncingSales(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('📤 [SETTINGS] Sincronizando ventas pendientes...');
      await offlineSyncService.syncPendingSales(selectedCashRegister.id);
      await refreshStats();
      setSyncSuccess('Ventas pendientes sincronizadas correctamente');
    } catch (error) {
      console.error('❌ [SETTINGS] Error sincronizando ventas:', error);
      setSyncError(
        error instanceof Error ? error.message : 'Error sincronizando ventas pendientes'
      );
    } finally {
      setSyncingSales(false);
    }
  }, [selectedCashRegister?.id, pendingSales, refreshStats]);

  // Limpiar base de datos offline
  const handleClearOfflineData = useCallback(async () => {
    const confirmMessage =
      '¿Está seguro de eliminar todos los datos offline? Esto eliminará productos y tokens almacenados localmente. Las ventas pendientes NO serán eliminadas.';

    // En web/Electron, Alert.alert no funciona, usar window.confirm
    const isWeb = Platform.OS === 'web';

    const executeCleanup = async () => {
      try {
        setSyncing(true);
        setSyncError(null);
        // Limpiar productos y tokens pero mantener ventas pendientes
        await offlineDatabase.clearProducts();
        await offlineDatabase.clearTokens();
        await refreshStats();
        setSyncSuccess('Datos offline eliminados. Realice una nueva sincronización.');
      } catch (error) {
        console.error('Error al limpiar datos offline:', error);
        setSyncError('Error al limpiar datos offline');
      } finally {
        setSyncing(false);
      }
    };

    if (isWeb) {
      // Usar window.confirm para web/Electron
      const confirmed = window.confirm(confirmMessage);
      if (confirmed) {
        await executeCleanup();
      }
    } else {
      // Usar Alert.alert para móviles
      Alert.alert('Confirmar limpieza', confirmMessage, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: executeCleanup,
        },
      ]);
    }
  }, [refreshStats]);

  // Formatear fecha de última sincronización
  const formatLastSync = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  console.log('📊 POSDashboardScreen renderizado');
  console.log('📊 selectedCashRegister:', selectedCashRegister?.name);
  console.log('📊 currentSession:', currentSession?.id);
  console.log('📊 navigation:', navigation);

  useEffect(() => {
    if (!selectedCashRegister) {
      navigation.navigate(ROUTES.CASH_REGISTER_SELECTION as never);
      return;
    }

    // Cargar sesión activa al iniciar
    const loadSession = async () => {
      try {
        console.log('🔄 Cargando sesión activa para caja:', selectedCashRegister.id);
        await loadActiveSession(selectedCashRegister.id);
        console.log('✅ Sesión activa cargada');
      } catch (error) {
        console.log('ℹ️ No hay sesión activa o error al cargar:', error);
      }
    };

    loadSession();

    // Refresh session every 30 seconds
    const interval = setInterval(() => {
      refreshSession();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedCashRegister]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshSession();
    setRefreshing(false);
  };

  const handleOpenSession = () => {
    console.log('🔓 Navegando a OpenSession...');
    navigation.navigate(ROUTES.OPEN_SESSION as never);
  };

  const handleNewSale = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa. Por favor, abra una sesión primero.');
      return;
    }
    navigation.navigate(ROUTES.NEW_SALE as never);
  };

  const handleCashIn = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }
    navigation.navigate(ROUTES.CASH_TRANSACTION as never, { type: 'cash_in' });
  };

  const handleCashOut = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }
    navigation.navigate(ROUTES.CASH_TRANSACTION as never, { type: 'cash_out' });
  };

  const handleCloseSession = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }
    navigation.navigate(ROUTES.CLOSE_SESSION as never);
  };

  const handleLogout = async () => {
    console.log('🔘 handleLogout presionado');
    console.log('🔘 currentSession:', currentSession);

    if (currentSession) {
      console.log('⚠️ Hay sesión activa, mostrando alerta');
      // Usar window.confirm para web/Electron
      if (typeof window !== 'undefined') {
        window.alert('Debes cerrar la caja antes de cerrar sesión.');
      } else {
        Alert.alert('Sesión de caja activa', 'Debes cerrar la caja antes de cerrar sesión.');
      }
      return;
    }

    console.log('📋 Mostrando confirmación de logout');

    // Usar window.confirm para web/Electron
    let confirmed = false;
    if (typeof window !== 'undefined' && window.confirm) {
      confirmed = window.confirm('¿Estás seguro que deseas cerrar sesión?');
    } else {
      // Fallback para móvil
      Alert.alert('Cerrar Sesión', '¿Estás seguro que deseas cerrar sesión?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: () => {
            confirmed = true;
          },
        },
      ]);
    }

    if (!confirmed) {
      console.log('❌ Usuario canceló el logout');
      return;
    }

    try {
      console.log('🚪 Iniciando cierre de sesión...');
      console.log('🔄 Reseteando POS store...');
      resetPOSStore();
      console.log('✅ POS store reseteado');
      console.log('🔄 Llamando logout de auth...');
      await logout();
      console.log('✅ Logout completado - debería redirigir al login');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      if (typeof window !== 'undefined') {
        window.alert('No se pudo cerrar la sesión');
      } else {
        Alert.alert('Error', 'No se pudo cerrar la sesión');
      }
    }
  };

  const formatCurrency = (amountInCents: number) => {
    // Convertir de centavos a soles
    const amountInSoles = amountInCents / 100;
    return `S/ ${amountInSoles.toFixed(2)}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{selectedCashRegister?.name}</Text>
        <View style={styles.headerRight}>
          {/* Botón de configuración */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setSettingsModalVisible(true)}
          >
            <Text style={styles.settingsButtonIcon}>⚙️</Text>
          </TouchableOpacity>
          {/* Botón de cerrar sesión */}
          <TouchableOpacity
            style={[styles.settingsButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonIcon}>🚪</Text>
          </TouchableOpacity>
          <View
            style={[styles.statusBadge, currentSession ? styles.statusOpen : styles.statusClosed]}
          >
            <Text style={styles.statusText}>{currentSession ? 'ABIERTA' : 'CERRADA'}</Text>
          </View>
        </View>
      </View>

      {/* Modal de Configuración con Pestañas */}
      <Modal
        visible={settingsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseSettingsModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalContent}>
            {/* Header del Modal */}
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>⚙️ Configuración</Text>
              {!downloading && !updateReady && !syncing ? (
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={handleCloseSettingsModal}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.modalCloseButtonDisabled}>
                  <Text style={styles.modalCloseTextDisabled}>✕</Text>
                </View>
              )}
            </View>

            {/* Pestañas */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'sync' && styles.tabActive]}
                onPress={() => setActiveTab('sync')}
              >
                <Text style={[styles.tabText, activeTab === 'sync' && styles.tabTextActive]}>
                  🔄 Sincronización
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'updates' && styles.tabActive]}
                onPress={() => setActiveTab('updates')}
              >
                <Text style={[styles.tabText, activeTab === 'updates' && styles.tabTextActive]}>
                  📦 Actualizaciones
                </Text>
              </TouchableOpacity>
            </View>

            {/* Contenido de las pestañas */}
            <ScrollView style={styles.settingsModalBody}>
              {/* ============ PESTAÑA DE SINCRONIZACIÓN ============ */}
              {activeTab === 'sync' && (
                <View style={styles.tabContent}>
                  {/* Estadísticas de sincronización */}
                  <View style={styles.syncStatsCard}>
                    <Text style={styles.cardTitle}>📊 Estado de Datos Offline</Text>

                    <View style={styles.statsGrid}>
                      <View style={styles.statBox}>
                        <Text style={styles.statNumber}>{totalProducts.toLocaleString()}</Text>
                        <Text style={styles.statLabel}>Productos</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text
                          style={[styles.statNumber, availableTokens < 100 && styles.statWarning]}
                        >
                          {availableTokens.toLocaleString()}
                        </Text>
                        <Text style={styles.statLabel}>Tokens</Text>
                      </View>
                      <View style={styles.statBox}>
                        <Text style={[styles.statNumber, pendingSales > 0 && styles.statPending]}>
                          {pendingSales}
                        </Text>
                        <Text style={styles.statLabel}>Ventas Pendientes</Text>
                      </View>
                    </View>

                    <View style={styles.lastSyncRow}>
                      <Text style={styles.lastSyncLabel}>Última sincronización:</Text>
                      <Text style={styles.lastSyncValue}>
                        {formatLastSync(lastSyncTime || lastProductSync)}
                      </Text>
                    </View>
                  </View>

                  {/* Mensajes de estado */}
                  {syncError && (
                    <View style={styles.syncErrorContainer}>
                      <Text style={styles.syncErrorIcon}>❌</Text>
                      <Text style={styles.syncErrorText}>{syncError}</Text>
                    </View>
                  )}

                  {syncSuccess && (
                    <View style={styles.syncSuccessContainer}>
                      <Text style={styles.syncSuccessIcon}>✅</Text>
                      <Text style={styles.syncSuccessText}>{syncSuccess}</Text>
                    </View>
                  )}

                  {/* Acciones de sincronización */}
                  <View style={styles.syncActionsCard}>
                    <Text style={styles.cardTitle}>🔄 Acciones de Sincronización</Text>

                    {/* Sincronización completa */}
                    <TouchableOpacity
                      style={[styles.syncActionButton, styles.syncActionPrimary]}
                      onPress={handleFullSync}
                      disabled={syncing || syncingStock || syncingTokens || syncingSales}
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.syncActionIcon}>🔄</Text>
                      )}
                      <View style={styles.syncActionTextContainer}>
                        <Text style={styles.syncActionTitle}>Sincronización Completa</Text>
                        <Text style={styles.syncActionDesc}>
                          Descarga productos, stock y tokens
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Sincronizar solo productos */}
                    <TouchableOpacity
                      style={[styles.syncActionButton, styles.syncActionSecondary]}
                      onPress={handleSyncProducts}
                      disabled={syncing || syncingStock || syncingTokens || syncingSales}
                    >
                      {syncing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.syncActionIcon}>📦</Text>
                      )}
                      <View style={styles.syncActionTextContainer}>
                        <Text style={styles.syncActionTitle}>Sincronizar Productos</Text>
                        <Text style={styles.syncActionDesc}>Actualiza catálogo completo</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Sincronizar stock */}
                    <TouchableOpacity
                      style={[styles.syncActionButton, styles.syncActionSecondary]}
                      onPress={handleSyncStock}
                      disabled={syncing || syncingStock || syncingTokens || syncingSales}
                    >
                      {syncingStock ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.syncActionIcon}>📊</Text>
                      )}
                      <View style={styles.syncActionTextContainer}>
                        <Text style={styles.syncActionTitle}>Actualizar Stock</Text>
                        <Text style={styles.syncActionDesc}>Solo cambios de inventario</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Reponer tokens */}
                    <TouchableOpacity
                      style={[styles.syncActionButton, styles.syncActionTokens]}
                      onPress={handleReplenishTokens}
                      disabled={syncing || syncingStock || syncingTokens || syncingSales}
                    >
                      {syncingTokens ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.syncActionIcon}>🎫</Text>
                      )}
                      <View style={styles.syncActionTextContainer}>
                        <Text style={styles.syncActionTitle}>Reponer Tokens</Text>
                        <Text style={styles.syncActionDesc}>Completar hasta 1000 tokens</Text>
                      </View>
                    </TouchableOpacity>

                    {/* Sincronizar ventas pendientes (MANUAL) */}
                    <TouchableOpacity
                      style={[
                        styles.syncActionButton,
                        pendingSales > 0 ? styles.syncActionWarning : styles.syncActionSecondary,
                      ]}
                      onPress={handleSyncPendingSales}
                      disabled={
                        syncing ||
                        syncingStock ||
                        syncingTokens ||
                        syncingSales ||
                        pendingSales === 0
                      }
                    >
                      {syncingSales ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.syncActionIcon}>📤</Text>
                      )}
                      <View style={styles.syncActionTextContainer}>
                        <Text style={styles.syncActionTitle}>
                          Sincronizar Ventas Pendientes
                          {pendingSales > 0 && ` (${pendingSales})`}
                        </Text>
                        <Text style={styles.syncActionDesc}>
                          {pendingSales > 0
                            ? 'Enviar ventas offline al servidor'
                            : 'No hay ventas pendientes'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Limpiar datos */}
                    <TouchableOpacity
                      style={[styles.syncActionButton, styles.syncActionDanger]}
                      onPress={handleClearOfflineData}
                      disabled={syncing || syncingStock || syncingTokens || syncingSales}
                    >
                      <Text style={styles.syncActionIcon}>🗑️</Text>
                      <View style={styles.syncActionTextContainer}>
                        <Text style={styles.syncActionTitle}>Limpiar Datos Offline</Text>
                        <Text style={styles.syncActionDesc}>
                          Elimina productos y tokens locales
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ============ PESTAÑA DE ACTUALIZACIONES ============ */}
              {activeTab === 'updates' && (
                <View style={styles.tabContent}>
                  <View style={styles.updateCard}>
                    <Text style={styles.cardTitle}>📦 Actualización de Software</Text>

                    {/* Versión actual */}
                    <View style={styles.versionRow}>
                      <Text style={styles.versionLabel}>Versión instalada:</Text>
                      <Text style={styles.versionValue}>v{currentVersion}</Text>
                    </View>

                    {!isElectron && (
                      <View style={styles.notElectronWarning}>
                        <Text style={styles.notElectronIcon}>ℹ️</Text>
                        <Text style={styles.notElectronText}>
                          Las actualizaciones automáticas solo están disponibles en la aplicación de
                          escritorio.
                        </Text>
                      </View>
                    )}

                    {isElectron && (
                      <>
                        {/* Estado de verificación */}
                        {checkingUpdate && (
                          <View style={styles.statusRow}>
                            <ActivityIndicator size="small" color="#007AFF" />
                            <Text style={styles.statusText2}>Verificando actualizaciones...</Text>
                          </View>
                        )}

                        {/* Resultado de verificación */}
                        {updateInfo && !checkingUpdate && (
                          <View style={styles.updateResultContainer}>
                            {updateInfo.error ? (
                              <View style={styles.errorContainer}>
                                <Text style={styles.errorIcon}>⚠️</Text>
                                <Text style={styles.errorText}>{updateInfo.error}</Text>
                              </View>
                            ) : updateInfo.updateAvailable ? (
                              <View style={styles.updateAvailableContainer}>
                                <Text style={styles.updateAvailableIcon}>🎉</Text>
                                <Text style={styles.updateAvailableTitle}>
                                  ¡Nueva versión disponible!
                                </Text>
                                <Text style={styles.updateAvailableVersion}>
                                  v{updateInfo.latestVersion}
                                </Text>
                                {updateInfo.releaseDate && (
                                  <Text style={styles.updateDate}>
                                    Publicada:{' '}
                                    {new Date(updateInfo.releaseDate).toLocaleDateString('es-PE')}
                                  </Text>
                                )}
                              </View>
                            ) : (
                              <View style={styles.upToDateContainer}>
                                <Text style={styles.upToDateIcon}>✅</Text>
                                <Text style={styles.upToDateText}>
                                  Tienes la última versión instalada
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                        {/* Progreso de descarga */}
                        {downloading && (
                          <View style={styles.downloadProgressContainer}>
                            <View style={styles.downloadingHeader}>
                              <ActivityIndicator size="small" color="#4CAF50" />
                              <Text style={styles.downloadingTitle}>Descargando actualización</Text>
                            </View>
                            <Text style={styles.downloadingSubtext}>
                              Por favor espere, no cierre la aplicación...
                            </Text>
                            <View style={styles.progressBarContainer}>
                              <View
                                style={[styles.progressBar, { width: `${downloadProgress}%` }]}
                              />
                            </View>
                            <Text style={styles.progressText}>{downloadProgress}%</Text>
                          </View>
                        )}

                        {/* Actualización lista */}
                        {updateReady && !installError && (
                          <View style={styles.updateReadyContainer}>
                            <Text style={styles.updateReadyIcon}>✅</Text>
                            <View style={styles.updateReadyTextContainer}>
                              <Text style={styles.updateReadyTitle}>¡Actualización lista!</Text>
                              <Text style={styles.updateReadyText}>
                                La descarga se completó correctamente. Reinicie para aplicar los
                                cambios.
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* Error de descarga */}
                        {downloadError && (
                          <View style={styles.downloadErrorContainer}>
                            <Text style={styles.downloadErrorIcon}>❌</Text>
                            <View style={styles.downloadErrorTextContainer}>
                              <Text style={styles.downloadErrorTitle}>Error de descarga</Text>
                              <Text style={styles.downloadErrorText}>{downloadError}</Text>
                            </View>
                          </View>
                        )}

                        {/* Error de instalación */}
                        {installError && (
                          <View style={styles.installErrorContainer}>
                            <Text style={styles.installErrorIcon}>⚠️</Text>
                            <View style={styles.installErrorTextContainer}>
                              <Text style={styles.installErrorTitle}>Error de instalación</Text>
                              <Text style={styles.installErrorText}>{installError}</Text>
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>

                  {/* Botones de acción de actualizaciones */}
                  {isElectron && (
                    <View style={styles.updateActionsCard}>
                      {/* Botón verificar */}
                      {!downloading && !updateReady && !downloadError && (
                        <TouchableOpacity
                          style={[styles.modalButton, styles.checkButton]}
                          onPress={handleCheckUpdates}
                          disabled={checkingUpdate}
                        >
                          <Text style={styles.modalButtonText}>
                            {checkingUpdate ? 'Verificando...' : '🔍 Verificar Actualizaciones'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Botón descargar */}
                      {updateInfo?.updateAvailable &&
                        !downloading &&
                        !updateReady &&
                        !downloadError && (
                          <TouchableOpacity
                            style={[styles.modalButton, styles.downloadButton]}
                            onPress={handleDownloadUpdate}
                          >
                            <Text style={styles.modalButtonText}>⬇️ Descargar Actualización</Text>
                          </TouchableOpacity>
                        )}

                      {/* Botón reintentar */}
                      {downloadError && (
                        <TouchableOpacity
                          style={[styles.modalButton, styles.retryButton]}
                          onPress={handleRetryDownload}
                        >
                          <Text style={styles.modalButtonText}>🔄 Reintentar</Text>
                        </TouchableOpacity>
                      )}

                      {/* Botón reiniciar */}
                      {updateReady && !installError && (
                        <TouchableOpacity
                          style={[styles.modalButton, styles.restartButton]}
                          onPress={handleInstallUpdate}
                        >
                          <Text style={styles.restartButtonText}>
                            🔄 Reiniciar para Ver los Cambios
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Botones cuando hay error de instalación */}
                      {installError && (
                        <>
                          <TouchableOpacity
                            style={[styles.modalButton, styles.retryButton]}
                            onPress={handleInstallUpdate}
                          >
                            <Text style={styles.modalButtonText}>🔄 Reintentar Instalación</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.modalButton, styles.closeErrorButton]}
                            onPress={() => {
                              setInstallError(null);
                              setUpdateReady(false);
                              setSettingsModalVisible(false);
                            }}
                          >
                            <Text style={styles.closeErrorButtonText}>
                              Cerrar (reiniciar manualmente)
                            </Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Session Info */}
      {currentSession ? (
        <View style={styles.sessionCard}>
          <Text style={styles.sectionTitle}>Información de Sesión</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Balance Actual:</Text>
            <Text style={styles.infoValueHighlight}>
              {formatCurrency(currentSession.currentCashCents)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ventas del día:</Text>
            <Text style={styles.infoValue}>
              {formatCurrency(currentSession.totalSalesCents || 0)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Transacciones:</Text>
            <Text style={styles.infoValue}>{currentSession.totalTransactions || 0}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Abierta por:</Text>
            <Text style={styles.infoValue}>{currentSession.user?.name || user?.name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Hora apertura:</Text>
            <Text style={styles.infoValue}>{formatDateTime(currentSession.openedAt)}</Text>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'Actualizando...' : '🔄 Actualizar'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noSessionCard}>
          <Text style={styles.noSessionTitle}>No hay sesión activa</Text>
          <Text style={styles.noSessionText}>Debe abrir una sesión para comenzar a operar</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {!currentSession ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => {
              console.log('🔘 Botón "Abrir Caja" presionado');
              handleOpenSession();
            }}
          >
            <Text style={styles.actionButtonIcon}>🔓</Text>
            <Text style={styles.actionButtonText}>Abrir Caja</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.saleButton]}
              onPress={handleNewSale}
            >
              <Text style={styles.actionButtonIcon}>🛒</Text>
              <Text style={styles.actionButtonText}>Nueva Venta</Text>
            </TouchableOpacity>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, styles.halfButton]}
                onPress={handleCashIn}
              >
                <Text style={styles.actionButtonIcon}>💵</Text>
                <Text style={styles.actionButtonText}>Ingreso</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.secondaryButton, styles.halfButton]}
                onPress={handleCashOut}
              >
                <Text style={styles.actionButtonIcon}>💸</Text>
                <Text style={styles.actionButtonText}>Retiro</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={handleCloseSession}
            >
              <Text style={styles.actionButtonIcon}>🔒</Text>
              <Text style={styles.actionButtonText}>Cerrar Caja</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsButtonIcon: {
    fontSize: 20,
  },
  logoutButton: {
    backgroundColor: '#FFEBEE',
  },
  logoutButtonIcon: {
    fontSize: 20,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusOpen: {
    backgroundColor: '#4CAF50',
  },
  statusClosed: {
    backgroundColor: '#9E9E9E',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noSessionCard: {
    backgroundColor: '#FFF3CD',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  noSessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  noSessionText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  infoValueHighlight: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  divider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 12,
  },
  refreshButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  refreshButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  actionsContainer: {
    padding: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  halfButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  saleButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#FF9800',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  actionButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Estilos del Modal de Configuración
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '95%',
    maxWidth: 600,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  settingsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  settingsModalBody: {
    flex: 1,
    maxHeight: 500,
  },
  // Estilos de pestañas
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#007AFF',
  },
  tabContent: {
    padding: 16,
  },
  // Estilos de tarjetas
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  syncStatsCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#007AFF',
  },
  statWarning: {
    color: '#FF9800',
  },
  statPending: {
    color: '#F44336',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
  lastSyncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
  },
  lastSyncLabel: {
    fontSize: 13,
    color: '#666',
  },
  lastSyncValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  // Mensajes de estado de sync
  syncErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  syncErrorIcon: {
    fontSize: 20,
  },
  syncErrorText: {
    flex: 1,
    color: '#C62828',
    fontSize: 14,
  },
  syncSuccessContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 10,
  },
  syncSuccessIcon: {
    fontSize: 20,
  },
  syncSuccessText: {
    flex: 1,
    color: '#2E7D32',
    fontSize: 14,
  },
  // Acciones de sincronización
  syncActionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  syncActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    gap: 12,
  },
  syncActionPrimary: {
    backgroundColor: '#007AFF',
  },
  syncActionSecondary: {
    backgroundColor: '#5C6BC0',
  },
  syncActionTokens: {
    backgroundColor: '#FF9800',
  },
  syncActionWarning: {
    backgroundColor: '#E65100',
  },
  syncActionDanger: {
    backgroundColor: '#9E9E9E',
  },
  syncActionIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  syncActionTextContainer: {
    flex: 1,
  },
  syncActionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  syncActionDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // Tarjeta de actualizaciones
  updateCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  updateActionsCard: {
    gap: 10,
  },
  notElectronWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    gap: 10,
  },
  notElectronIcon: {
    fontSize: 20,
  },
  notElectronText: {
    flex: 1,
    color: '#1565C0',
    fontSize: 13,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalCloseButtonDisabled: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseTextDisabled: {
    fontSize: 16,
    color: '#BDBDBD',
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  versionLabel: {
    fontSize: 15,
    color: '#666',
  },
  versionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  statusText2: {
    fontSize: 14,
    color: '#666',
  },
  updateResultContainer: {
    marginTop: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
  },
  errorIcon: {
    fontSize: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#856404',
    flex: 1,
  },
  updateAvailableContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  updateAvailableIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  updateAvailableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  updateAvailableVersion: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1B5E20',
  },
  updateDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  upToDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  upToDateIcon: {
    fontSize: 24,
  },
  upToDateText: {
    fontSize: 14,
    color: '#1565C0',
    flex: 1,
  },
  downloadProgressContainer: {
    padding: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  downloadingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  downloadingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
  },
  downloadingSubtext: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginTop: 8,
  },
  updateReadyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  updateReadyIcon: {
    fontSize: 32,
  },
  updateReadyTextContainer: {
    flex: 1,
  },
  updateReadyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  updateReadyText: {
    fontSize: 13,
    color: '#558B2F',
    lineHeight: 18,
  },
  modalActions: {
    padding: 16,
    paddingTop: 0,
    gap: 10,
  },
  modalButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkButton: {
    backgroundColor: '#007AFF',
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
  },
  installButton: {
    backgroundColor: '#FF9800',
  },
  restartButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 18,
    borderRadius: 12,
  },
  restartButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#FF9800',
  },
  closeErrorButton: {
    backgroundColor: '#9E9E9E',
  },
  closeErrorButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  downloadErrorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#F44336',
  },
  downloadErrorIcon: {
    fontSize: 32,
  },
  downloadErrorTextContainer: {
    flex: 1,
  },
  downloadErrorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    marginBottom: 4,
  },
  downloadErrorText: {
    fontSize: 13,
    color: '#B71C1C',
    lineHeight: 18,
  },
  installErrorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 20,
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  installErrorIcon: {
    fontSize: 32,
  },
  installErrorTextContainer: {
    flex: 1,
  },
  installErrorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E65100',
    marginBottom: 4,
  },
  installErrorText: {
    fontSize: 13,
    color: '#F57C00',
    lineHeight: 18,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
