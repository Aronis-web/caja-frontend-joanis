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
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth';
import { usePOSStore } from '@/store/pos';
import { useOfflineStore } from '@/store/offline';
import { useCollectionsStore } from '@/store/collections';
import { offlineSyncService } from '@/services/OfflineSyncService';
import { offlineDatabase } from '@/services/OfflineDatabase';
import { deviceTokenService } from '@/services/DeviceTokenService';
import { offlineUsersBundleService } from '@/services/OfflineUsersBundleService';
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { ROUTES } from '@/constants/routes';
import {
  useTheme,
  useThemedStyles,
  useThemeStore,
  type Theme,
  type ThemeMode,
} from '@/design-system';
import { Ionicons } from '@expo/vector-icons';

// Tipo Window.electronAPI declarado globalmente en src/hooks/useAppUpdater.ts

export default function POSDashboardScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
  const [activeTab, setActiveTab] = useState<'sync' | 'updates' | 'appearance' | 'offline'>('sync');

  // Estados para provisioning del X-Device-Token
  const [deviceTokenInput, setDeviceTokenInput] = useState('');
  const [deviceTokenProvisioned, setDeviceTokenProvisioned] = useState(false);
  const [deviceTokenSaving, setDeviceTokenSaving] = useState(false);
  const [deviceTokenMessage, setDeviceTokenMessage] = useState<string | null>(null);
  const [bundleDownloading, setBundleDownloading] = useState(false);

  // Tema (modo claro / oscuro / sistema)
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);

  // Estados de sincronización offline
  const {
    totalProducts,
    availableTokens,
    pendingSales,
    lastProductSync,
    isInitialized: offlineInitialized,
    refreshStats,
  } = useOfflineStore();

  // Estado de recaudación de efectivo
  const { clearActiveRequest } = useCollectionsStore();

  const [syncing, setSyncing] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);
  const [syncingTokens, setSyncingTokens] = useState(false);
  const [syncingSales, setSyncingSales] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Hook de actualizaciones server-side (/api/pos/app-updates)
  const {
    updateStatus,
    isElectron: isElectronUpdater,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    resetUpdateState,
    isChecking,
    isDownloading,
    isDownloaded,
  } = useAppUpdater();

  const currentVersion = updateStatus.currentVersion;
  const downloadProgress = Math.round(updateStatus.downloadProgress?.percent ?? 0);
  const updateReady = isDownloaded;
  // Diferenciar errores de descarga vs instalación: si ya hay filePath, el fallo es de instalación
  const downloadError =
    updateStatus.status === 'error' && !updateStatus.filePath ? updateStatus.error ?? null : null;
  const installError =
    updateStatus.status === 'error' && !!updateStatus.filePath ? updateStatus.error ?? null : null;
  // Mostrar resultado del check (disponible o al día) sin pintar error como "updateInfo"
  const updateInfo =
    updateStatus.status === 'available' ||
    updateStatus.status === 'up-to-date' ||
    isDownloading ||
    isDownloaded
      ? {
          updateAvailable: !!updateStatus.updateAvailable,
          latestVersion: updateStatus.latestVersion,
          releaseNotes: updateStatus.releaseNotes,
          releasedAt: updateStatus.releasedAt,
        }
      : null;

  // Verificar si estamos en Electron (o web en general para mostrar el botón)
  const isElectron =
    isElectronUpdater ||
    (Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      (window.electronAPI?.isElectron || window.electronAPI !== undefined));

  // Acciones delegadas al hook (mantienen firmas previas para no tocar JSX)
  const handleCheckUpdates = useCallback(async () => {
    await checkForUpdates();
  }, [checkForUpdates]);

  const handleDownloadUpdate = useCallback(async () => {
    await downloadUpdate();
  }, [downloadUpdate]);

  const handleInstallUpdate = useCallback(async () => {
    await installUpdate();
  }, [installUpdate]);

  const handleRetryDownload = useCallback(() => {
    resetUpdateState();
    void checkForUpdates();
  }, [resetUpdateState, checkForUpdates]);

  // Cerrar modal y resetear estados
  const handleCloseSettingsModal = useCallback(() => {
    if (!isDownloading && !updateReady && !syncing) {
      setSettingsModalVisible(false);
      resetUpdateState();
      setSyncError(null);
      setSyncSuccess(null);
      setDeviceTokenMessage(null);
      setDeviceTokenInput('');
    }
  }, [isDownloading, updateReady, syncing, resetUpdateState]);

  // Cargar estado de provisioning al abrir el modal
  useEffect(() => {
    if (!settingsModalVisible) return;
    void deviceTokenService.isProvisioned().then(setDeviceTokenProvisioned);
  }, [settingsModalVisible]);

  // Guardar device token
  const handleSaveDeviceToken = useCallback(async () => {
    const token = deviceTokenInput.trim();
    if (!token) {
      setDeviceTokenMessage('Pegá un token válido antes de guardar.');
      return;
    }
    if (!selectedCashRegister?.id || !selectedCashRegister?.code) {
      setDeviceTokenMessage('Seleccioná y abrí la caja antes de provisionar el device token.');
      return;
    }
    setDeviceTokenSaving(true);
    setDeviceTokenMessage(null);
    try {
      await deviceTokenService.set(token);
      await deviceTokenService.setProvisionedCashRegister({
        id: selectedCashRegister.id,
        code: selectedCashRegister.code,
      });
      setDeviceTokenProvisioned(true);
      setDeviceTokenInput('');
      setDeviceTokenMessage(
        `Device token guardado y pareado con la caja ${selectedCashRegister.code}.`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo guardar el token';
      setDeviceTokenMessage(msg);
    } finally {
      setDeviceTokenSaving(false);
    }
  }, [deviceTokenInput, selectedCashRegister?.id, selectedCashRegister?.code]);

  // Eliminar device token
  const handleClearDeviceToken = useCallback(() => {
    Alert.alert(
      'Eliminar device token',
      'La caja dejará de poder operar offline hasta que se vuelva a provisionar. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceTokenService.clear();
              setDeviceTokenProvisioned(false);
              setDeviceTokenMessage('Device token eliminado.');
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'No se pudo eliminar';
              setDeviceTokenMessage(msg);
            }
          },
        },
      ]
    );
  }, []);

  // Descargar bundle de usuarios offline
  const handleDownloadUsersBundle = useCallback(async () => {
    const cashRegisterId = currentSession?.cashRegisterId || selectedCashRegister?.id;
    if (!cashRegisterId) {
      setDeviceTokenMessage('Seleccioná una caja antes de descargar el bundle.');
      return;
    }
    setBundleDownloading(true);
    setDeviceTokenMessage(null);
    try {
      const result = await offlineUsersBundleService.downloadBundle(cashRegisterId);
      if (result.ok) {
        setDeviceTokenMessage(
          `Bundle descargado: ${result.bundle.userCount} usuarios. Expira ${new Date(
            result.bundle.expiresAt
          ).toLocaleString()}.`
        );
      } else {
        const reasons: Record<string, string> = {
          FEATURE_OFF: 'El backend tiene desactivado el login offline (403).',
          NOT_FOUND: 'No hay bundle disponible para esta caja.',
          NO_DEVICE_TOKEN: 'Faltá guardar el device token primero.',
          NETWORK_ERROR: 'No se pudo conectar al backend.',
        };
        setDeviceTokenMessage(reasons[result.reason] || 'No se pudo descargar el bundle.');
      }
    } finally {
      setBundleDownloading(false);
    }
  }, [currentSession?.cashRegisterId, selectedCashRegister?.id]);

  // ============ FUNCIONES DE SINCRONIZACIÓN ============

  // Sincronización completa (productos + tokens)
  const handleFullSync = useCallback(async () => {
    const syncCashRegisterId = currentSession?.cashRegisterId || selectedCashRegister?.id;
    if (!syncCashRegisterId) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('🔄 [SETTINGS] Iniciando sincronización completa...');
      await offlineSyncService.performInitialSync(syncCashRegisterId);
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
  }, [currentSession?.cashRegisterId, selectedCashRegister?.id, refreshStats]);

  // Sincronizar solo productos
  const handleSyncProducts = useCallback(async () => {
    const syncCashRegisterId = currentSession?.cashRegisterId || selectedCashRegister?.id;
    if (!syncCashRegisterId) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('📦 [SETTINGS] Sincronizando productos...');
      await offlineSyncService.syncProducts(syncCashRegisterId, 'full');
      await refreshStats();
      setLastSyncTime(new Date().toISOString());
      setSyncSuccess('Productos sincronizados correctamente');
    } catch (error) {
      console.error('❌ [SETTINGS] Error sincronizando productos:', error);
      setSyncError(error instanceof Error ? error.message : 'Error sincronizando productos');
    } finally {
      setSyncing(false);
    }
  }, [currentSession?.cashRegisterId, selectedCashRegister?.id, refreshStats]);

  // Sincronizar solo stock (delta)
  const handleSyncStock = useCallback(async () => {
    const syncCashRegisterId = currentSession?.cashRegisterId || selectedCashRegister?.id;
    if (!syncCashRegisterId) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    setSyncingStock(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('📊 [SETTINGS] Sincronizando stock...');
      await offlineSyncService.syncStock(syncCashRegisterId);
      await refreshStats();
      setSyncSuccess('Stock actualizado correctamente');
    } catch (error) {
      console.error('❌ [SETTINGS] Error sincronizando stock:', error);
      setSyncError(error instanceof Error ? error.message : 'Error sincronizando stock');
    } finally {
      setSyncingStock(false);
    }
  }, [currentSession?.cashRegisterId, selectedCashRegister?.id, refreshStats]);

  // Reponer tokens
  const handleReplenishTokens = useCallback(async () => {
    const syncCashRegisterId = currentSession?.cashRegisterId || selectedCashRegister?.id;
    if (!syncCashRegisterId) {
      setSyncError('No hay caja registradora seleccionada');
      return;
    }

    setSyncingTokens(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      console.log('🎫 [SETTINGS] Reponiendo tokens...');
      await offlineSyncService.ensureTokenPool(syncCashRegisterId);
      await refreshStats();
      setSyncSuccess('Tokens reabastecidos correctamente');
    } catch (error) {
      console.error('❌ [SETTINGS] Error reponiendo tokens:', error);
      setSyncError(error instanceof Error ? error.message : 'Error reponiendo tokens');
    } finally {
      setSyncingTokens(false);
    }
  }, [currentSession?.cashRegisterId, selectedCashRegister?.id, refreshStats]);

  // Sincronizar ventas pendientes (MANUAL)
  const handleSyncPendingSales = useCallback(async () => {
    const syncCashRegisterId = currentSession?.cashRegisterId || selectedCashRegister?.id;
    if (!syncCashRegisterId) {
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
      await offlineSyncService.syncPendingSales(syncCashRegisterId);
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
  }, [currentSession?.cashRegisterId, selectedCashRegister?.id, pendingSales, refreshStats]);

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

  const handleCloseSession = () => {
    if (!currentSession) {
      Alert.alert('Error', 'No hay sesión activa');
      return;
    }

    // Reiniciar estado previo de recaudación para forzar el flujo de cierre propuesto (QR auto)
    clearActiveRequest();

    (navigation.navigate as unknown as (route: string, params?: unknown) => void)(
      ROUTES.CASH_COLLECTION,
      {
        mode: 'closure',
        autoStart: true,
        forceFlow: Date.now(),
      }
    );
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
        <ActivityIndicator size="large" color={theme.color.text.link} />
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
              {!isDownloading && !updateReady && !syncing ? (
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
              <TouchableOpacity
                style={[styles.tab, activeTab === 'appearance' && styles.tabActive]}
                onPress={() => setActiveTab('appearance')}
              >
                <Text style={[styles.tabText, activeTab === 'appearance' && styles.tabTextActive]}>
                  🎨 Apariencia
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'offline' && styles.tabActive]}
                onPress={() => setActiveTab('offline')}
              >
                <Text style={[styles.tabText, activeTab === 'offline' && styles.tabTextActive]}>
                  📴 Offline
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
                        <ActivityIndicator size="small" color={theme.color.text.onAction} />
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
                        <ActivityIndicator size="small" color={theme.color.text.onAction} />
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
                        <ActivityIndicator size="small" color={theme.color.text.onAction} />
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
                        <ActivityIndicator size="small" color={theme.color.text.onAction} />
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
                        <ActivityIndicator size="small" color={theme.color.text.onAction} />
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
                        {isChecking && (
                          <View style={styles.statusRow}>
                            <ActivityIndicator size="small" color={theme.color.text.link} />
                            <Text style={styles.statusText2}>Verificando actualizaciones...</Text>
                          </View>
                        )}

                        {/* Resultado de verificación */}
                        {updateInfo && !isChecking && (
                          <View style={styles.updateResultContainer}>
                            {updateInfo.updateAvailable ? (
                              <View style={styles.updateAvailableContainer}>
                                <Text style={styles.updateAvailableIcon}>🎉</Text>
                                <Text style={styles.updateAvailableTitle}>
                                  ¡Nueva versión disponible!
                                </Text>
                                <Text style={styles.updateAvailableVersion}>
                                  v{updateInfo.latestVersion}
                                </Text>
                                {updateInfo.releasedAt && (
                                  <Text style={styles.updateDate}>
                                    Publicada:{' '}
                                    {new Date(updateInfo.releasedAt).toLocaleDateString('es-PE')}
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
                        {isDownloading && (
                          <View style={styles.downloadProgressContainer}>
                            <View style={styles.downloadingHeader}>
                              <ActivityIndicator size="small" color={theme.color.text.success} />
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
                      {!isDownloading && !updateReady && !downloadError && (
                        <TouchableOpacity
                          style={[styles.modalButton, styles.checkButton]}
                          onPress={handleCheckUpdates}
                          disabled={isChecking}
                        >
                          <Text style={styles.modalButtonText}>
                            {isChecking ? 'Verificando...' : '🔍 Verificar Actualizaciones'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Botón descargar */}
                      {updateInfo?.updateAvailable &&
                        !isDownloading &&
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
                              resetUpdateState();
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

              {/* ============ PESTAÑA DE APARIENCIA ============ */}
              {activeTab === 'appearance' && (
                <View style={styles.tabContent}>
                  <View style={styles.appearanceCard}>
                    <Text style={styles.cardTitle}>🎨 Modo de visualización</Text>
                    <Text style={styles.appearanceHelper}>
                      Elige cómo se ve la aplicación. El modo automático sigue la configuración del
                      sistema.
                    </Text>

                    {(
                      [
                        {
                          mode: 'light',
                          label: 'Claro',
                          helper: 'Fondo blanco, ideal para entornos iluminados',
                          icon: 'sunny-outline' as const,
                        },
                        {
                          mode: 'dark',
                          label: 'Oscuro',
                          helper: 'Fondo oscuro, reduce la fatiga visual',
                          icon: 'moon-outline' as const,
                        },
                        {
                          mode: 'system',
                          label: 'Automático',
                          helper: 'Sigue la preferencia del sistema operativo',
                          icon: 'phone-portrait-outline' as const,
                        },
                      ] as Array<{
                        mode: ThemeMode;
                        label: string;
                        helper: string;
                        icon: keyof typeof Ionicons.glyphMap;
                      }>
                    ).map((option) => {
                      const selected = themeMode === option.mode;
                      return (
                        <TouchableOpacity
                          key={option.mode}
                          style={[
                            styles.appearanceOption,
                            selected && styles.appearanceOptionSelected,
                          ]}
                          onPress={() => setThemeMode(option.mode)}
                          activeOpacity={0.7}
                        >
                          <View
                            style={[
                              styles.appearanceIconWrap,
                              selected && styles.appearanceIconWrapSelected,
                            ]}
                          >
                            <Ionicons
                              name={option.icon}
                              size={22}
                              color={selected ? theme.color.text.inverse : theme.color.text.muted}
                            />
                          </View>
                          <View style={styles.appearanceTextWrap}>
                            <Text
                              style={[
                                styles.appearanceLabel,
                                selected && styles.appearanceLabelSelected,
                              ]}
                            >
                              {option.label}
                            </Text>
                            <Text style={styles.appearanceHelperSmall}>{option.helper}</Text>
                          </View>
                          <View
                            style={[
                              styles.appearanceRadio,
                              selected && styles.appearanceRadioSelected,
                            ]}
                          >
                            {selected && <View style={styles.appearanceRadioDot} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* ============ PESTAÑA OFFLINE / DEVICE TOKEN ============ */}
              {activeTab === 'offline' && (
                <View style={styles.tabContent}>
                  <View style={styles.appearanceCard}>
                    <Text style={styles.cardTitle}>🔐 Device token de la caja</Text>
                    <Text style={styles.appearanceHelper}>
                      Este token (válido 1 año) habilita el login offline y la sincronización contra
                      el backend. Lo genera un administrador y se pega una sola vez por caja.
                    </Text>

                    <View style={styles.deviceTokenStatusRow}>
                      <Ionicons
                        name={deviceTokenProvisioned ? 'shield-checkmark' : 'shield-outline'}
                        size={18}
                        color={
                          deviceTokenProvisioned ? theme.color.text.success : theme.color.text.muted
                        }
                      />
                      <Text style={styles.deviceTokenStatusText}>
                        {deviceTokenProvisioned ? 'Caja provisionada' : 'Caja sin provisionar'}
                      </Text>
                    </View>

                    <TextInput
                      style={styles.deviceTokenInput}
                      value={deviceTokenInput}
                      onChangeText={setDeviceTokenInput}
                      placeholder="Pegá el device token aquí"
                      placeholderTextColor={theme.color.text.placeholder}
                      autoCapitalize="none"
                      autoCorrect={false}
                      multiline
                    />

                    <TouchableOpacity
                      style={[
                        styles.deviceTokenButton,
                        (deviceTokenSaving || !deviceTokenInput.trim()) &&
                          styles.deviceTokenButtonDisabled,
                      ]}
                      onPress={handleSaveDeviceToken}
                      disabled={deviceTokenSaving || !deviceTokenInput.trim()}
                    >
                      {deviceTokenSaving ? (
                        <ActivityIndicator color={theme.color.text.onAction} />
                      ) : (
                        <Text style={styles.deviceTokenButtonText}>Guardar token</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.deviceTokenButton,
                        styles.deviceTokenButtonSecondary,
                        (bundleDownloading || !deviceTokenProvisioned) &&
                          styles.deviceTokenButtonDisabled,
                      ]}
                      onPress={handleDownloadUsersBundle}
                      disabled={bundleDownloading || !deviceTokenProvisioned}
                    >
                      {bundleDownloading ? (
                        <ActivityIndicator color={theme.color.text.body} />
                      ) : (
                        <Text style={styles.deviceTokenButtonSecondaryText}>
                          Descargar bundle de usuarios
                        </Text>
                      )}
                    </TouchableOpacity>

                    {deviceTokenProvisioned && (
                      <TouchableOpacity
                        style={[styles.deviceTokenButton, styles.deviceTokenButtonDanger]}
                        onPress={handleClearDeviceToken}
                      >
                        <Text style={styles.deviceTokenButtonDangerText}>
                          Eliminar device token
                        </Text>
                      </TouchableOpacity>
                    )}

                    {deviceTokenMessage && (
                      <Text style={styles.deviceTokenMessage}>{deviceTokenMessage}</Text>
                    )}
                  </View>
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      padding: theme.space[5],
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      flex: 1,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsButtonIcon: {
      fontSize: 20,
    },
    logoutButton: {
      backgroundColor: theme.color.state.danger.background,
    },
    logoutButtonIcon: {
      fontSize: 20,
    },
    statusBadge: {
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.full,
    },
    statusOpen: {
      backgroundColor: theme.color.action.success.background,
    },
    statusClosed: {
      backgroundColor: theme.color.text.subtle,
    },
    statusText: {
      color: theme.color.text.onAction,
      fontSize: 14,
      fontWeight: '600',
    },
    sessionCard: {
      backgroundColor: theme.color.surface.base,
      margin: theme.space[4],
      padding: theme.space[5],
      borderRadius: theme.radii.lg,
      ...theme.shadow.sm,
    },
    noSessionCard: {
      backgroundColor: theme.color.state.warning.background,
      margin: theme.space[4],
      padding: theme.space[6],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
    },
    noSessionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.state.warning.text,
      marginBottom: theme.space[2],
    },
    noSessionText: {
      fontSize: 14,
      color: theme.color.state.warning.text,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[4],
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    infoLabel: {
      fontSize: 15,
      color: theme.color.text.muted,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.color.text.heading,
    },
    infoValueHighlight: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.success,
    },
    divider: {
      height: 1,
      backgroundColor: theme.color.border.subtle,
      marginVertical: theme.space[3],
    },
    refreshButton: {
      marginTop: theme.space[3],
      padding: theme.space[3],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    refreshButtonText: {
      fontSize: 14,
      color: theme.color.text.link,
      fontWeight: '500',
    },
    actionsContainer: {
      padding: theme.space[4],
    },
    actionRow: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    actionButton: {
      padding: theme.space[5],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      marginBottom: theme.space[3],
      ...theme.shadow.sm,
    },
    halfButton: {
      flex: 1,
    },
    primaryButton: {
      backgroundColor: theme.color.action.primary.background,
    },
    saleButton: {
      backgroundColor: theme.color.action.success.background,
    },
    secondaryButton: {
      backgroundColor: theme.color.icon.warning,
    },
    dangerButton: {
      backgroundColor: theme.color.action.danger.background,
    },
    actionButtonIcon: {
      fontSize: 32,
      marginBottom: theme.space[2],
    },
    actionButtonText: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '600',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsModalContent: {
      backgroundColor: theme.color.surface.elevated,
      borderRadius: theme.radii.xl,
      width: '95%',
      maxWidth: 600,
      maxHeight: '90%',
      ...theme.shadow.lg,
    },
    settingsModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    settingsModalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.color.text.heading,
    },
    settingsModalBody: {
      flex: 1,
      maxHeight: 500,
    },
    tabsContainer: {
      flexDirection: 'row',
      backgroundColor: theme.color.surface.subtle,
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    tab: {
      flex: 1,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[4],
      alignItems: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      backgroundColor: theme.color.surface.base,
      borderBottomColor: theme.color.text.link,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    tabTextActive: {
      color: theme.color.text.link,
    },
    tabContent: {
      padding: theme.space[4],
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[4],
    },
    appearanceCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    appearanceHelper: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginTop: -theme.space[2],
      marginBottom: theme.space[4],
      lineHeight: 18,
    },
    deviceTokenStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.space[3],
      gap: theme.space[2],
    },
    deviceTokenStatusText: {
      fontSize: 13,
      color: theme.color.text.body,
    },
    deviceTokenInput: {
      borderWidth: 1,
      borderColor: theme.color.border.default,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      backgroundColor: theme.color.surface.base,
      color: theme.color.text.body,
      fontSize: 13,
      minHeight: 80,
      textAlignVertical: 'top',
      marginBottom: theme.space[3],
    },
    deviceTokenButton: {
      backgroundColor: theme.color.action.primary.background,
      borderRadius: theme.radii.md,
      paddingVertical: theme.space[3],
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    deviceTokenButtonDisabled: {
      opacity: 0.5,
    },
    deviceTokenButtonText: {
      color: theme.color.text.onAction,
      fontWeight: '600',
    },
    deviceTokenButtonSecondary: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.default,
    },
    deviceTokenButtonSecondaryText: {
      color: theme.color.text.body,
      fontWeight: '600',
    },
    deviceTokenButtonDanger: {
      backgroundColor: theme.color.state.danger.background,
      borderWidth: 1,
      borderColor: theme.color.state.danger.border,
    },
    deviceTokenButtonDangerText: {
      color: theme.color.text.danger,
      fontWeight: '600',
    },
    deviceTokenMessage: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[2],
      lineHeight: 16,
    },
    appearanceOption: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginBottom: theme.space[2],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
      gap: theme.space[3],
    },
    appearanceOptionSelected: {
      borderColor: theme.color.action.primary.background,
      backgroundColor: theme.color.surface.base,
      ...theme.shadow.xs,
    },
    appearanceIconWrap: {
      width: 40,
      height: 40,
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appearanceIconWrapSelected: {
      backgroundColor: theme.color.action.primary.background,
    },
    appearanceTextWrap: {
      flex: 1,
    },
    appearanceLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    appearanceLabelSelected: {
      color: theme.color.text.heading,
    },
    appearanceHelperSmall: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: 2,
    },
    appearanceRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: theme.color.border.default,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appearanceRadioSelected: {
      borderColor: theme.color.action.primary.background,
    },
    appearanceRadioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.color.action.primary.background,
    },
    syncStatsCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: theme.space[4],
    },
    statBox: {
      alignItems: 'center',
      padding: theme.space[3],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.md,
      minWidth: 100,
      ...theme.shadow.xs,
    },
    statNumber: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.color.text.link,
    },
    statWarning: {
      color: theme.color.text.warning,
    },
    statPending: {
      color: theme.color.text.danger,
    },
    statLabel: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[1],
      fontWeight: '500',
    },
    lastSyncRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: theme.space[3],
      borderTopWidth: 1,
      borderTopColor: theme.color.border.subtle,
    },
    lastSyncLabel: {
      fontSize: 13,
      color: theme.color.text.muted,
    },
    lastSyncValue: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    syncErrorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.state.danger.background,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[4],
      gap: theme.space[2.5],
    },
    syncErrorIcon: {
      fontSize: 20,
    },
    syncErrorText: {
      flex: 1,
      color: theme.color.state.danger.text,
      fontSize: 14,
    },
    syncSuccessContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.state.success.background,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[4],
      gap: theme.space[2.5],
    },
    syncSuccessIcon: {
      fontSize: 20,
    },
    syncSuccessText: {
      flex: 1,
      color: theme.color.state.success.text,
      fontSize: 14,
    },
    syncActionsCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    syncActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: theme.space[3.5],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[2.5],
      gap: theme.space[3],
    },
    syncActionPrimary: {
      backgroundColor: theme.color.action.primary.background,
    },
    syncActionSecondary: {
      backgroundColor: theme.color.text.link,
    },
    syncActionTokens: {
      backgroundColor: theme.color.icon.warning,
    },
    syncActionWarning: {
      backgroundColor: theme.color.state.warning.border,
    },
    syncActionDanger: {
      backgroundColor: theme.color.text.subtle,
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
      color: theme.color.text.onAction,
    },
    syncActionDesc: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      marginTop: theme.space[0.5],
    },
    updateCard: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.lg,
      padding: theme.space[4],
      marginBottom: theme.space[4],
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    updateActionsCard: {
      gap: theme.space[2.5],
    },
    notElectronWarning: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.color.state.info.background,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      gap: theme.space[2.5],
    },
    notElectronIcon: {
      fontSize: 20,
    },
    notElectronText: {
      flex: 1,
      color: theme.color.state.info.text,
      fontSize: 13,
    },
    modalCloseButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.surface.muted,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseText: {
      fontSize: 16,
      color: theme.color.text.muted,
      fontWeight: '600',
    },
    modalCloseButtonDisabled: {
      width: 32,
      height: 32,
      borderRadius: theme.radii.full,
      backgroundColor: theme.color.border.subtle,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCloseTextDisabled: {
      fontSize: 16,
      color: theme.color.text.disabled,
      fontWeight: '600',
    },
    modalBody: {
      padding: theme.space[5],
    },
    versionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[4],
      paddingBottom: theme.space[4],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    versionLabel: {
      fontSize: 15,
      color: theme.color.text.muted,
    },
    versionValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.link,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      padding: theme.space[4],
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
    },
    statusText2: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    updateResultContainer: {
      marginTop: theme.space[2],
    },
    errorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      padding: theme.space[4],
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.md,
    },
    errorIcon: {
      fontSize: 24,
    },
    errorText: {
      fontSize: 14,
      color: theme.color.state.warning.text,
      flex: 1,
    },
    updateAvailableContainer: {
      alignItems: 'center',
      padding: theme.space[5],
      backgroundColor: theme.color.state.success.background,
      borderRadius: theme.radii.md,
    },
    updateAvailableIcon: {
      fontSize: 40,
      marginBottom: theme.space[2],
    },
    updateAvailableTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.state.success.text,
      marginBottom: theme.space[1],
    },
    updateAvailableVersion: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.text.success,
    },
    updateDate: {
      fontSize: 12,
      color: theme.color.text.muted,
      marginTop: theme.space[2],
    },
    upToDateContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      padding: theme.space[4],
      backgroundColor: theme.color.state.info.background,
      borderRadius: theme.radii.md,
    },
    upToDateIcon: {
      fontSize: 24,
    },
    upToDateText: {
      fontSize: 14,
      color: theme.color.state.info.text,
      flex: 1,
    },
    downloadProgressContainer: {
      padding: theme.space[5],
      backgroundColor: theme.color.state.success.background,
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.color.state.success.border,
    },
    downloadingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2.5],
      marginBottom: theme.space[2],
    },
    downloadingTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.state.success.text,
    },
    downloadingSubtext: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: theme.space[4],
      textAlign: 'center',
    },
    progressBarContainer: {
      width: '100%',
      height: 8,
      backgroundColor: theme.color.border.subtle,
      borderRadius: theme.radii.sm,
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      backgroundColor: theme.color.action.success.background,
    },
    progressText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.success,
      marginTop: theme.space[2],
    },
    updateReadyContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[3],
      padding: theme.space[5],
      backgroundColor: theme.color.state.success.background,
      borderRadius: theme.radii.lg,
      marginTop: theme.space[2],
      borderWidth: 2,
      borderColor: theme.color.state.success.border,
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
      color: theme.color.state.success.text,
      marginBottom: theme.space[1],
    },
    updateReadyText: {
      fontSize: 13,
      color: theme.color.state.success.text,
      lineHeight: 18,
    },
    modalActions: {
      padding: theme.space[4],
      paddingTop: 0,
      gap: theme.space[2.5],
    },
    modalButton: {
      padding: theme.space[3.5],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    checkButton: {
      backgroundColor: theme.color.action.primary.background,
    },
    downloadButton: {
      backgroundColor: theme.color.action.success.background,
    },
    installButton: {
      backgroundColor: theme.color.icon.warning,
    },
    restartButton: {
      backgroundColor: theme.color.action.success.background,
      paddingVertical: theme.space[4],
      borderRadius: theme.radii.lg,
    },
    restartButtonText: {
      color: theme.color.text.onAction,
      fontSize: 17,
      fontWeight: 'bold',
    },
    retryButton: {
      backgroundColor: theme.color.icon.warning,
    },
    closeErrorButton: {
      backgroundColor: theme.color.text.subtle,
    },
    closeErrorButtonText: {
      color: theme.color.text.onAction,
      fontSize: 15,
      fontWeight: '600',
    },
    downloadErrorContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[3],
      padding: theme.space[5],
      backgroundColor: theme.color.state.danger.background,
      borderRadius: theme.radii.lg,
      marginTop: theme.space[2],
      borderWidth: 2,
      borderColor: theme.color.state.danger.border,
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
      color: theme.color.state.danger.text,
      marginBottom: theme.space[1],
    },
    downloadErrorText: {
      fontSize: 13,
      color: theme.color.state.danger.text,
      lineHeight: 18,
    },
    installErrorContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.space[3],
      padding: theme.space[5],
      backgroundColor: theme.color.state.warning.background,
      borderRadius: theme.radii.lg,
      marginTop: theme.space[2],
      borderWidth: 2,
      borderColor: theme.color.state.warning.border,
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
      color: theme.color.state.warning.text,
      marginBottom: theme.space[1],
    },
    installErrorText: {
      fontSize: 13,
      color: theme.color.state.warning.text,
      lineHeight: 18,
    },
    modalButtonText: {
      color: theme.color.text.onAction,
      fontSize: 15,
      fontWeight: '600',
    },
  });
