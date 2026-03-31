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
  const { selectedCashRegister, currentSession, refreshSession, loadActiveSession, isLoading } =
    usePOSStore();

  const [refreshing, setRefreshing] = useState(false);

  // Estados para el modal de actualizaciones
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('...');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateReady, setUpdateReady] = useState(false);

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

    try {
      await window.electronAPI.downloadUpdate();
    } catch (error) {
      console.error('Error downloading update:', error);
      setDownloading(false);
      Alert.alert('Error', 'No se pudo descargar la actualización');
    }
  }, [isElectron]);

  // Instalar actualización
  const handleInstallUpdate = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return;

    try {
      await window.electronAPI.installUpdate();
    } catch (error) {
      console.error('Error installing update:', error);
      Alert.alert('Error', 'No se pudo instalar la actualización');
    }
  }, [isElectron]);

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
          {/* Botón de actualización - solo mostrar en Electron */}
          {isElectron && (
            <TouchableOpacity
              style={styles.updateButton}
              onPress={() => setUpdateModalVisible(true)}
            >
              <Text style={styles.updateButtonIcon}>⚙️</Text>
            </TouchableOpacity>
          )}
          <View
            style={[styles.statusBadge, currentSession ? styles.statusOpen : styles.statusClosed]}
          >
            <Text style={styles.statusText}>{currentSession ? 'ABIERTA' : 'CERRADA'}</Text>
          </View>
        </View>
      </View>

      {/* Modal de Actualizaciones */}
      <Modal
        visible={updateModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          // No permitir cerrar si está descargando o la actualización está lista
          if (!downloading && !updateReady) {
            setUpdateModalVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚙️ Actualización de Software</Text>
              {/* Solo mostrar botón de cerrar si no está descargando ni la actualización está lista */}
              {!downloading && !updateReady ? (
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setUpdateModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.modalCloseButtonDisabled}>
                  <Text style={styles.modalCloseTextDisabled}>✕</Text>
                </View>
              )}
            </View>

            <View style={styles.modalBody}>
              {/* Versión actual */}
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Versión instalada:</Text>
                <Text style={styles.versionValue}>v{currentVersion}</Text>
              </View>

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
                      <Text style={styles.updateAvailableTitle}>¡Nueva versión disponible!</Text>
                      <Text style={styles.updateAvailableVersion}>v{updateInfo.latestVersion}</Text>
                      {updateInfo.releaseDate && (
                        <Text style={styles.updateDate}>
                          Publicada: {new Date(updateInfo.releaseDate).toLocaleDateString('es-PE')}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.upToDateContainer}>
                      <Text style={styles.upToDateIcon}>✅</Text>
                      <Text style={styles.upToDateText}>Tienes la última versión instalada</Text>
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
                    <View style={[styles.progressBar, { width: `${downloadProgress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{downloadProgress}%</Text>
                </View>
              )}

              {/* Actualización lista */}
              {updateReady && (
                <View style={styles.updateReadyContainer}>
                  <Text style={styles.updateReadyIcon}>✅</Text>
                  <View style={styles.updateReadyTextContainer}>
                    <Text style={styles.updateReadyTitle}>¡Actualización lista!</Text>
                    <Text style={styles.updateReadyText}>
                      La descarga se completó correctamente. Reinicie para aplicar los cambios.
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Botones de acción */}
            <View style={styles.modalActions}>
              {!downloading && !updateReady && (
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

              {updateInfo?.updateAvailable && !downloading && !updateReady && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.downloadButton]}
                  onPress={handleDownloadUpdate}
                >
                  <Text style={styles.modalButtonText}>⬇️ Descargar Actualización</Text>
                </TouchableOpacity>
              )}

              {updateReady && (
                <TouchableOpacity
                  style={[styles.modalButton, styles.restartButton]}
                  onPress={handleInstallUpdate}
                >
                  <Text style={styles.restartButtonText}>🔄 Reiniciar para Ver los Cambios</Text>
                </TouchableOpacity>
              )}
            </View>
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
  updateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonIcon: {
    fontSize: 18,
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
  // Estilos del Modal de Actualizaciones
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
