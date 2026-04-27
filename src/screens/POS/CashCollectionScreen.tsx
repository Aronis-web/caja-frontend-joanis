/**
 * CashCollectionScreen
 * Pantalla para solicitar recaudación de efectivo y mostrar código QR
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { usePOSStore } from '@/store/pos';
import { useCollectionsStore } from '@/store/collections';
import { CashProgressBar } from '@/components/collections/CashProgressBar';
import { CashAlertBadge } from '@/components/collections/CashAlertBadge';
import {
  CashAlertLevel,
  CollectionRequestStatus,
  CollectionRequestReason,
  ALERT_LEVEL_CONFIGS,
} from '@/types/collections';

// Importación condicional de QRCode para web/Electron
let QRCode: React.ComponentType<{ value: string; size?: number; level?: string }> | null = null;
if (Platform.OS === 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    QRCode = require('react-qr-code').default;
  } catch (e) {
    console.warn('⚠️ react-qr-code no está instalado');
  }
}

export default function CashCollectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentSession, selectedCashRegister } = usePOSStore();
  const {
    cashStatus,
    isCashStatusLoading,
    activeRequest,
    requestStatus,
    isRequestLoading,
    requestError,
    fetchCashStatus,
    createCollectionRequest,
    cancelRequest,
    clearActiveRequest,
    stopRequestStatusPolling,
  } = useCollectionsStore();

  const [countdown, setCountdown] = useState<number>(0);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const routeParams =
    (route.params as { mode?: 'regular' | 'closure'; autoStart?: boolean; forceFlow?: number } | undefined) ||
    undefined;

  const isClosureMode = routeParams?.mode === 'closure';
  const autoStart = routeParams?.autoStart === true;
  const forceFlow = routeParams?.forceFlow;
  const autoStartTriggeredRef = useRef(false);

  // Cargar estado de efectivo al montar
  useEffect(() => {
    if (currentSession?.id) {
      fetchCashStatus(currentSession.id);
    }

    return () => {
      stopRequestStatusPolling();
    };
  }, [currentSession?.id, fetchCashStatus, stopRequestStatusPolling]);

  // Manejar countdown del QR
  useEffect(() => {
    if (requestStatus?.expiresInSeconds && requestStatus.status === CollectionRequestStatus.PENDING) {
      setCountdown(requestStatus.expiresInSeconds);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [requestStatus?.expiresInSeconds, requestStatus?.status]);

  // Manejar solicitud de recaudación
  const handleRequestCollection = useCallback(async () => {
    if (!currentSession?.id) return;

    try {
      const reason = isClosureMode
        ? CollectionRequestReason.END_OF_SHIFT
        : cashStatus?.isBlocked
        ? CollectionRequestReason.BLOCKED
        : cashStatus?.alertLevel === CashAlertLevel.CRITICAL
        ? CollectionRequestReason.APPROACHING_LIMIT
        : CollectionRequestReason.MANUAL;

      await createCollectionRequest(
        currentSession.id,
        reason,
        isClosureMode ? 'Solicitud automática de cierre de caja' : undefined,
        isClosureMode
          ? {
              mode: 'closure',
              expectedAmountCents: cashStatus?.maxCollectionCents,
            }
          : undefined
      );
    } catch (error) {
      console.error('Error al solicitar recaudación:', error);
      if (Platform.OS === 'web') {
        window.alert('Error al solicitar recaudación. Por favor, intente nuevamente.');
      }
    }
  }, [currentSession?.id, cashStatus, createCollectionRequest, isClosureMode]);

  // Resetear trigger cuando se fuerza el flujo desde Dashboard
  useEffect(() => {
    if (typeof forceFlow !== 'undefined') {
      autoStartTriggeredRef.current = false;
    }
  }, [forceFlow]);

  // Auto-generar solicitud cuando se solicita (cierre o regular)
  useEffect(() => {
    if (!autoStart || autoStartTriggeredRef.current) return;
    if (!currentSession?.id) return;
    if (isRequestLoading) return;

    // Si ya hay una solicitud pendiente/en proceso, no crear una nueva
    if (
      requestStatus &&
      [CollectionRequestStatus.PENDING, CollectionRequestStatus.IN_PROGRESS].includes(requestStatus.status)
    ) {
      autoStartTriggeredRef.current = true;
      return;
    }

    autoStartTriggeredRef.current = true;
    handleRequestCollection();
  }, [
    autoStart,
    currentSession?.id,
    requestStatus,
    isRequestLoading,
    handleRequestCollection,
    forceFlow,
  ]);

  // Manejar cancelación
  const handleCancelRequest = useCallback(async () => {
    const requestId = activeRequest?.requestId || requestStatus?.id;
    if (!requestId) return;

    if (requestStatus?.status !== CollectionRequestStatus.PENDING) {
      if (Platform.OS === 'web') {
        window.alert('Solo se puede cancelar una solicitud en estado PENDIENTE.');
      }
      return;
    }

    try {
      await cancelRequest(requestId);
      setShowConfirmCancel(false);
      navigation.goBack();
    } catch (error) {
      console.error('Error al cancelar solicitud:', error);
    }
  }, [
    activeRequest?.requestId,
    requestStatus?.id,
    requestStatus?.status,
    cancelRequest,
    navigation,
  ]);

  // Manejar regeneración de QR
  const handleRegenerateQR = useCallback(async () => {
    clearActiveRequest();
    await handleRequestCollection();
  }, [clearActiveRequest, handleRequestCollection]);

  // Formatear moneda
  const formatCurrency = (amount: number) => {
    return `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Formatear countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Renderizar contenido según estado
  const renderContent = () => {
    // Estado: Cargando
    if (isCashStatusLoading && !cashStatus) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Cargando información...</Text>
        </View>
      );
    }

    // Estado: Sin solicitud activa - Mostrar información y botón para solicitar
    if (!activeRequest && !requestStatus) {
      return renderInitialState();
    }

    // Estado: Solicitud en progreso
    if (requestStatus) {
      const isPendingButExpired =
        requestStatus.status === CollectionRequestStatus.PENDING &&
        (requestStatus.isExpired || requestStatus.expiresInSeconds <= 0);

      if (isPendingButExpired) {
        return renderExpiredState();
      }

      switch (requestStatus.status) {
        case CollectionRequestStatus.PENDING:
          return renderPendingState();
        case CollectionRequestStatus.IN_PROGRESS:
          return renderInProgressState();
        case CollectionRequestStatus.COMPLETED:
          return renderCompletedState();
        case CollectionRequestStatus.EXPIRED:
          return renderExpiredState();
        case CollectionRequestStatus.CANCELLED:
          return renderCancelledState();
        default:
          return renderPendingState();
      }
    }

    return renderInitialState();
  };

  // Render: Estado inicial (sin solicitud)
  const renderInitialState = () => {
    if (isClosureMode && autoStart && !activeRequest && !requestStatus) {
      if (requestError) {
        return (
          <View style={styles.centerContainer}>
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>❌ {requestError}</Text>
            </View>
            <TouchableOpacity style={styles.regenerateButton} onPress={handleRequestCollection}>
              <Text style={styles.regenerateButtonText}>🔄 Reintentar generar QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backButtonText}>← Volver al Dashboard</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Generando QR de cierre...</Text>
        </View>
      );
    }

    if (!cashStatus) return null;

    const config = ALERT_LEVEL_CONFIGS[cashStatus.alertLevel];

    return (
      <ScrollView style={styles.scrollContent}>
        {/* Card de Estado */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>💰 Estado del Efectivo</Text>
            <CashAlertBadge alertLevel={cashStatus.alertLevel} />
          </View>

          <View style={styles.progressContainer}>
            <CashProgressBar percent={cashStatus.percentUsed} alertLevel={cashStatus.alertLevel} height={16} />
            <Text style={[styles.percentBig, { color: config.color }]}>
              {cashStatus.percentUsed.toFixed(0)}%
            </Text>
          </View>

          <View style={styles.amountsGrid}>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Efectivo Actual</Text>
              <Text style={[styles.amountValueBig, { color: config.color }]}>
                {formatCurrency(cashStatus.currentCash)}
              </Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Máximo Permitido</Text>
              <Text style={styles.amountValue}>{formatCurrency(cashStatus.maxCash)}</Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>Mínimo Requerido</Text>
              <Text style={styles.amountValue}>{formatCurrency(cashStatus.minCash)}</Text>
            </View>
          </View>

          {cashStatus.message && (
            <View style={[styles.alertBox, { backgroundColor: config.backgroundColor, borderColor: config.borderColor }]}>
              <Text style={[styles.alertBoxText, { color: config.color }]}>
                {config.icon} {cashStatus.message}
              </Text>
            </View>
          )}
        </View>

        {/* Card de Recaudación */}
        <View style={styles.collectionInfoCard}>
          <Text style={styles.cardTitle}>📤 Información de Recaudación</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Máximo a retirar:</Text>
            <Text style={styles.infoValue}>{formatCurrency(cashStatus.maxCollection)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sugerido retirar:</Text>
            <Text style={[styles.infoValue, styles.suggestedValue]}>
              {formatCurrency(cashStatus.suggestedCollection)}
            </Text>
          </View>

          <Text style={styles.infoHint}>
            💡 El monto sugerido dejará la caja al 20% de capacidad
          </Text>
        </View>

        {/* Botón de Solicitar */}
        {cashStatus.canCollect && (
          <TouchableOpacity
            style={[
              styles.requestButton,
              cashStatus.isBlocked && styles.requestButtonUrgent,
            ]}
            onPress={handleRequestCollection}
            disabled={isRequestLoading}
          >
            {isRequestLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.requestButtonText}>
                {cashStatus.isBlocked
                  ? '🚨 Solicitar Recaudación Urgente'
                  : '📱 Generar Código QR para Recaudación'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {requestError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {requestError}</Text>
          </View>
        )}

        {/* Botón Volver */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>← Volver al Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // Render: Estado PENDING (mostrando QR)
  const renderPendingState = () => {
    if (!cashStatus) return null;

    const qrValue = activeRequest?.qrData || activeRequest?.qrUrl || requestStatus?.token;
    const tokenValue = activeRequest?.qrToken || requestStatus?.token;

    if (!qrValue || !tokenValue) {
      return (
        <View style={styles.centerContainer}>
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ No se pudo obtener el código QR para esta solicitud.</Text>
          </View>
          <TouchableOpacity style={styles.regenerateButton} onPress={handleRegenerateQR}>
            <Text style={styles.regenerateButtonText}>🔄 Generar Nuevo Código</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Volver al Dashboard</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollCenter}>
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>{isClosureMode ? '🔒 ESCANEAR PARA RECAUDO DE CIERRE' : '📱 ESCANEAR PARA RECAUDAR'}</Text>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            {QRCode ? (
              <QRCode
                value={qrValue}
                size={220}
                level="H"
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR</Text>
                <Text style={styles.qrTokenText}>{tokenValue}</Text>
              </View>
            )}
          </View>

          {/* Token */}
          <View style={styles.tokenContainer}>
            <Text style={styles.tokenLabel}>Token:</Text>
            <Text style={styles.tokenValue}>{tokenValue}</Text>
          </View>

          {/* Countdown */}
          <View style={[styles.countdownContainer, countdown < 60 && styles.countdownUrgent]}>
            <Text style={styles.countdownIcon}>⏱️</Text>
            <Text style={[styles.countdownText, countdown < 60 && styles.countdownTextUrgent]}>
              Expira en: {formatCountdown(countdown)}
            </Text>
          </View>

          {/* Info de recaudación */}
          <View style={styles.qrInfoBox}>
            {!isClosureMode && typeof activeRequest?.expectedAmountCents === 'number' && (
              <View style={styles.qrInfoRow}>
                <Text style={styles.qrInfoLabel}>🎯 Monto esperado:</Text>
                <Text style={[styles.qrInfoValue, styles.suggestedValue]}>
                  {formatCurrency(activeRequest.expectedAmountCents / 100)}
                </Text>
              </View>
            )}
            {activeRequest?.mode && (
              <View style={styles.qrInfoRow}>
                <Text style={styles.qrInfoLabel}>🧾 Modo:</Text>
                <Text style={styles.qrInfoValue}>{activeRequest.mode}</Text>
              </View>
            )}
          </View>

          {/* Estado */}
          <View style={styles.statusIndicator}>
            <ActivityIndicator size="small" color="#FFC107" />
            <Text style={styles.statusIndicatorText}>
              {isClosureMode
                ? '🟡 Esperando escaneo de supervisora para cierre...'
                : '🟡 Esperando que una supervisora escanee el código...'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setShowConfirmCancel(true)}
          disabled={isRequestLoading}
        >
          <Text style={styles.cancelButtonText}>
            {isClosureMode ? '❌ Cancelar Cierre' : '❌ Cancelar Solicitud'}
          </Text>
        </TouchableOpacity>

        {/* Modal de confirmación */}
        {showConfirmCancel && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>
                {isClosureMode ? '¿Cancelar cierre?' : '¿Cancelar solicitud?'}
              </Text>
              <Text style={styles.confirmText}>
                {isClosureMode
                  ? 'El cierre quedará cancelado. Si ya expiró o fue completado por supervisión, no se podrá cancelar.'
                  : 'El código QR dejará de ser válido y deberás generar uno nuevo.'}
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={styles.confirmButtonNo}
                  onPress={() => setShowConfirmCancel(false)}
                >
                  <Text style={styles.confirmButtonNoText}>No, mantener</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButtonYes}
                  onPress={handleCancelRequest}
                >
                  <Text style={styles.confirmButtonYesText}>Sí, cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  // Render: Estado IN_PROGRESS
  const renderInProgressState = () => {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.inProgressCard}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.inProgressTitle}>🔵 Recaudación en Proceso</Text>
          <Text style={styles.inProgressText}>
            {requestStatus?.processedBy?.name || 'Una supervisora'} está procesando la recaudación.
          </Text>
          <Text style={styles.inProgressHint}>
            Por favor, entregue el efectivo solicitado y espere la confirmación.
          </Text>
        </View>
      </View>
    );
  };

  // Render: Estado COMPLETED
  const renderCompletedState = () => {
    const completedInfo = requestStatus?.completedCollection;

    return (
      <View style={styles.centerContainer}>
        <View style={styles.completedCard}>
          <Text style={styles.completedIcon}>✅</Text>
          <Text style={styles.completedTitle}>¡Recaudación Completada!</Text>

          {completedInfo && (
            <View style={styles.completedInfo}>
              <View style={styles.completedInfoRow}>
                <Text style={styles.completedLabel}>Monto retirado:</Text>
                <Text style={styles.completedValue}>
                  {formatCurrency(completedInfo.amountCents / 100)}
                </Text>
              </View>
              <View style={styles.completedInfoRow}>
                <Text style={styles.completedLabel}>Recibo:</Text>
                <Text style={styles.completedValue}>{completedInfo.collectionNumber}</Text>
              </View>
            </View>
          )}

          <Text style={styles.completedHint}>
            El efectivo de su caja ha sido actualizado.
          </Text>

          <TouchableOpacity
            style={styles.completedButton}
            onPress={() => {
              clearActiveRequest();
              navigation.goBack();
            }}
          >
            <Text style={styles.completedButtonText}>Volver al Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render: Estado EXPIRED
  const renderExpiredState = () => {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.expiredCard}>
          <Text style={styles.expiredIcon}>⏰</Text>
          <Text style={styles.expiredTitle}>Código QR Expirado</Text>
          <Text style={styles.expiredText}>
            El código QR ha expirado. Genere uno nuevo para continuar con la recaudación.
          </Text>

          <TouchableOpacity style={styles.regenerateButton} onPress={handleRegenerateQR}>
            <Text style={styles.regenerateButtonText}>🔄 Generar Nuevo Código</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backButtonAlt}
            onPress={() => {
              clearActiveRequest();
              navigation.goBack();
            }}
          >
            <Text style={styles.backButtonAltText}>← Volver</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render: Estado CANCELLED
  const renderCancelledState = () => {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.cancelledCard}>
          <Text style={styles.cancelledIcon}>❌</Text>
          <Text style={styles.cancelledTitle}>Solicitud Cancelada</Text>
          <Text style={styles.cancelledText}>
            La solicitud de recaudación ha sido cancelada.
          </Text>

          <TouchableOpacity
            style={styles.completedButton}
            onPress={() => {
              clearActiveRequest();
              navigation.goBack();
            }}
          >
            <Text style={styles.completedButtonText}>Volver al Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackButton}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isClosureMode ? 'Recaudo de Cierre' : 'Recaudación de Efectivo'}</Text>
        <Text style={styles.headerSubtitle}>{selectedCashRegister?.name}</Text>
      </View>

      {renderContent()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackButton: {
    marginRight: 12,
    padding: 4,
  },
  headerBackText: {
    fontSize: 24,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  scrollContent: {
    flex: 1,
    padding: 16,
  },
  scrollCenter: {
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  // Status Card
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  percentBig: {
    fontSize: 24,
    fontWeight: '700',
    minWidth: 60,
    textAlign: 'right',
  },
  amountsGrid: {
    gap: 12,
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  amountValueBig: {
    fontSize: 18,
    fontWeight: '700',
  },
  alertBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  alertBoxText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Collection Info Card
  collectionInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  suggestedValue: {
    color: '#4CAF50',
  },
  infoHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 12,
    fontStyle: 'italic',
  },

  // Request Button
  requestButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  requestButtonUrgent: {
    backgroundColor: '#F44336',
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Back Button
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#666',
    fontSize: 14,
  },

  // Error Box
  errorBox: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
  },

  // QR Card
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  qrPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#999',
  },
  qrTokenText: {
    fontSize: 10,
    color: '#666',
    marginTop: 8,
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  tokenLabel: {
    fontSize: 14,
    color: '#666',
  },
  tokenValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  countdownUrgent: {
    backgroundColor: '#FFEBEE',
  },
  countdownIcon: {
    fontSize: 16,
  },
  countdownText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
  },
  countdownTextUrgent: {
    color: '#C62828',
  },
  qrInfoBox: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  qrInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  qrInfoLabel: {
    fontSize: 14,
    color: '#666',
  },
  qrInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusIndicatorText: {
    fontSize: 14,
    color: '#666',
  },

  // Cancel Button
  cancelButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '500',
  },

  // Confirm Overlay
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    maxWidth: 320,
    width: '100%',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButtonNo: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
  },
  confirmButtonNoText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  confirmButtonYes: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F44336',
    alignItems: 'center',
  },
  confirmButtonYesText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },

  // In Progress Card
  inProgressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 350,
  },
  inProgressTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976D2',
    marginTop: 20,
    marginBottom: 12,
  },
  inProgressText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  inProgressHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Completed Card
  completedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 350,
  },
  completedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 20,
  },
  completedInfo: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  completedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  completedLabel: {
    fontSize: 14,
    color: '#666',
  },
  completedValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  completedHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  completedButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  completedButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Expired Card
  expiredCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 350,
  },
  expiredIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  expiredTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF9800',
    marginBottom: 12,
  },
  expiredText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  regenerateButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 12,
  },
  regenerateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonAlt: {
    paddingVertical: 12,
  },
  backButtonAltText: {
    color: '#666',
    fontSize: 14,
  },

  // Cancelled Card
  cancelledCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 350,
  },
  cancelledIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  cancelledTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 12,
  },
  cancelledText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
});
