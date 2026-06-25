/**
 * CashCollectionScreen
 * Pantalla para solicitar recaudación de efectivo y mostrar código QR
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
import { useAuthStore } from '@/store/auth';
import { useCollectionsStore } from '@/store/collections';
import { CashProgressBar } from '@/components/collections/CashProgressBar';
import { CashAlertBadge } from '@/components/collections/CashAlertBadge';
import {
  CashAlertLevel,
  CollectionRequestStatus,
  CollectionRequestReason,
  ALERT_LEVEL_CONFIGS,
} from '@/types/collections';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';

// Importación condicional de QRCode para web/Electron
let QRCode: React.ComponentType<{ value: string; size?: number; level?: string }> | null = null;
if (Platform.OS === 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    QRCode = require('react-qr-code').default;
  } catch {
    console.warn('⚠️ react-qr-code no está instalado');
  }
}

export default function CashCollectionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { currentSession, selectedCashRegister } = usePOSStore();
  const logout = useAuthStore((state) => state.logout);
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);
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
  const [closureLogoutCountdown, setClosureLogoutCountdown] = useState<number>(10);
  const completedRequestIdRef = useRef<string | null>(null);
  const closureTicketPrintedForRequestRef = useRef<string | null>(null);

  const completedRequestId = useMemo(
    () =>
      requestStatus?.status === CollectionRequestStatus.COMPLETED && requestStatus?.id
        ? requestStatus.id
        : null,
    [requestStatus?.status, requestStatus?.id]
  );

  const routeParams =
    (route.params as
      | { mode?: 'regular' | 'closure'; autoStart?: boolean; forceFlow?: number }
      | undefined) || undefined;

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
    if (
      requestStatus?.expiresInSeconds &&
      requestStatus.status === CollectionRequestStatus.PENDING
    ) {
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

  useEffect(() => {
    if (!isClosureMode || !completedRequestId) {
      completedRequestIdRef.current = null;
      closureTicketPrintedForRequestRef.current = null;
      setClosureLogoutCountdown(10);
      return;
    }

    if (completedRequestIdRef.current !== completedRequestId) {
      completedRequestIdRef.current = completedRequestId;
      closureTicketPrintedForRequestRef.current = null;
      setClosureLogoutCountdown(10);
    }
  }, [isClosureMode, completedRequestId]);

  const buildClosureTicketHtml = useCallback((): string | null => {
    const closureSnapshot = requestStatus?.closureContext?.sessionSnapshot;
    if (!closureSnapshot) return null;

    const sessionIdentity = closureSnapshot.session_identity;
    const timesAndStatus = closureSnapshot.times_and_status;
    const monetarySummary = closureSnapshot.monetary_summary;
    const salesBreakdown = closureSnapshot.sales_breakdown;
    const operationalTraceability = closureSnapshot.operational_traceability;
    const reconciliationAndAudit = closureSnapshot.reconciliation_and_audit;

    const escapeHtml = (value: unknown): string =>
      String(value ?? '-')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const formatMoney = (cents?: number | null): string => `S/ ${((cents ?? 0) / 100).toFixed(2)}`;

    const mapLabel = (key: string): string => {
      const labels: Record<string, string> = {
        method_name: 'Método',
        methodName: 'Método',
        methodCode: 'Código método',
        document_type: 'Tipo doc.',
        documentType: 'Tipo doc.',
        document_type_label: 'Documento',
        total_transactions: 'Transacciones',
        total_count: 'Cantidad',
        count: 'Cantidad',
        total_sales_count: 'Cantidad ventas',
        total_quantity: 'Cantidad',
        totalCents: 'Monto',
        session_number: 'Sesión',
        cashier_name: 'Cajero',
        cashier_user_id: 'ID cajero',
        userName: 'Cajero',
        userId: 'ID cajero',
        difference_type: 'Tipo diferencia',
      };
      return labels[key] ?? key.replace(/_/g, ' ');
    };

    const formatFieldValue = (key: string, value: unknown): string => {
      if (value === null || value === undefined || value === '') return '-';
      if (
        typeof value === 'number' &&
        (key.endsWith('_cents') || key.endsWith('Cents') || key === 'totalCents')
      ) {
        return formatMoney(value);
      }
      if (Array.isArray(value)) return value.join(', ');
      return String(value);
    };

    const row = (label: string, value: unknown): string =>
      `<div class="row"><span class="label">${escapeHtml(label)}:</span><span class="value">${escapeHtml(String(value ?? '-'))}</span></div>`;

    const section = (title: string, rows: string): string =>
      `<div class="line"></div><div class="section-title">${escapeHtml(title)}</div>${rows || row('Info', '-')}`;

    const renderList = (title: string, items?: Array<Record<string, unknown>>): string => {
      if (!items || items.length === 0) {
        return section(title, row('Registros', 'Sin datos'));
      }

      const rows = items
        .map((item, index) => {
          const itemRows = Object.entries(item)
            .map(([key, value]) =>
              row(`${index + 1}. ${mapLabel(key)}`, formatFieldValue(key, value))
            )
            .join('');
          return `<div class="sub-block">${itemRows}</div>`;
        })
        .join('');

      return section(title, rows);
    };

    const identityRows = [
      row('Caja', sessionIdentity?.cash_register_name ?? '-'),
      row('Código caja', sessionIdentity?.cash_register_code ?? '-'),
      row('Sede', sessionIdentity?.site_name ?? '-'),
      row('Usuario', sessionIdentity?.user_name ?? '-'),
      row('N° sesión', sessionIdentity?.session_number ?? '-'),
      row('ID sesión', sessionIdentity?.session_id ?? '-'),
    ].join('');

    const statusRows = [
      row('Estado', timesAndStatus?.status ?? '-'),
      row('Apertura', timesAndStatus?.opened_at ?? '-'),
      row('Cierre', timesAndStatus?.closed_at ?? '-'),
      row('Duración (min)', timesAndStatus?.duration_minutes ?? '-'),
      row('Motivo cierre', timesAndStatus?.closure_reason ?? '-'),
    ].join('');

    const moneyRows = [
      row('Apertura', formatMoney(monetarySummary?.opening_cash_cents)),
      row('Cierre', formatMoney(monetarySummary?.closing_cash_cents)),
      row('Esperado', formatMoney(monetarySummary?.expected_cash_cents)),
      row('Diferencia', formatMoney(monetarySummary?.difference_cents)),
      row('Tipo diferencia', monetarySummary?.difference_type ?? '-'),
      row('Ventas totales', formatMoney(monetarySummary?.total_sales_cents)),
      row('Cantidad ventas', monetarySummary?.total_sales_count ?? '-'),
      row('Ingresos caja', formatMoney(monetarySummary?.total_cash_in_cents)),
      row('Egresos caja', formatMoney(monetarySummary?.total_cash_out_cents)),
      row('Devoluciones', formatMoney(monetarySummary?.total_refunds_cents)),
      row('Efectivo actual', formatMoney(monetarySummary?.current_cash_cents)),
    ].join('');

    const traceabilityRows = [
      row(
        'Cerrado por',
        operationalTraceability?.closed_by_name ?? operationalTraceability?.closed_by ?? '-'
      ),
      row('ID recaudo final', operationalTraceability?.final_collection_id ?? '-'),
      row('Nivel alerta caja', operationalTraceability?.alerts?.cash_alert_level ?? '-'),
      row('Caja bloqueada', String(operationalTraceability?.alerts?.is_blocked ?? false)),
      row(
        'Con inconsistencias',
        String(operationalTraceability?.alerts?.had_inconsistencies ?? false)
      ),
    ].join('');

    const reconciliationRows = [
      row('Estado reconciliación', reconciliationAndAudit?.reconciliation_status ?? '-'),
      row('Generado', reconciliationAndAudit?.generated_at ?? '-'),
      row('Versión reporte', reconciliationAndAudit?.report_version ?? '-'),
      row('Request origen', reconciliationAndAudit?.source_request_id ?? '-'),
    ].join('');

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Ticket de Cierre</title>
        <style>
          body { font-family: Arial, sans-serif; width: 220px; margin: 0 auto; padding: 6px; color: #000; }
          h1, h2 { text-align: center; margin: 2px 0; }
          h1 { font-size: 13px; }
          h2 { font-size: 10px; font-weight: normal; }
          .line { border-top: 1px dashed #000; margin: 5px 0; }
          .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; margin: 3px 0; }
          .sub-block { padding-left: 2px; margin-bottom: 3px; }
          .row { display: flex; justify-content: space-between; font-size: 9px; margin: 1px 0; gap: 6px; align-items: flex-start; }
          .label { font-weight: 700; max-width: 55%; word-break: break-word; }
          .value { text-align: right; word-break: break-word; max-width: 45%; }
          .footer { text-align: center; font-size: 9px; margin-top: 6px; }
        </style>
      </head>
      <body>
        <h1>CIERRE DE CAJA</h1>
        <h2>${escapeHtml(sessionIdentity?.cash_register_name ?? '-')}</h2>

        ${section('Identidad de sesión', identityRows)}
        ${section('Tiempos y estado', statusRows)}
        ${section('Resumen monetario (S/)', moneyRows)}
        ${renderList(
          'Ventas por método de pago',
          salesBreakdown?.by_payment_method as Array<Record<string, unknown>> | undefined
        )}
        ${renderList(
          'Ventas por tipo de documento',
          salesBreakdown?.by_document_type as Array<Record<string, unknown>> | undefined
        )}
        ${renderList(
          'Ventas por cajero/sesión',
          salesBreakdown?.by_cashier_session as Array<Record<string, unknown>> | undefined
        )}
        ${section('Trazabilidad operativa', traceabilityRows)}
        ${section('Reconciliación y auditoría', reconciliationRows)}

        <div class="line"></div>
        <div class="footer">${new Date().toLocaleString('es-PE')}</div>
      </body>
      </html>
    `;
  }, [requestStatus?.closureContext?.sessionSnapshot]);

  const printClosureTicket = useCallback(async (): Promise<boolean> => {
    try {
      const ticketHtml = buildClosureTicketHtml();
      if (!ticketHtml) {
        console.warn('⚠️ No hay sessionSnapshot para imprimir ticket de cierre.');
        return false;
      }

      const filename = `ticket_cierre_${completedRequestId ?? Date.now()}.pdf`;

      const electronAPI =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? (
              window as unknown as {
                electronAPI?: {
                  printHTML?: (
                    html: string,
                    filename: string
                  ) => Promise<{ success: boolean; error?: string }>;
                };
              }
            ).electronAPI
          : undefined;

      if (electronAPI?.printHTML) {
        const result = await electronAPI.printHTML(ticketHtml, filename);
        if (!result?.success) {
          console.error('❌ Error imprimiendo ticket de cierre en Electron:', result?.error);
          return false;
        }
        console.log('✅ Ticket de cierre impreso en Electron');
        return true;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank', 'width=420,height=720');
        if (!printWindow) {
          console.error('❌ No se pudo abrir ventana para imprimir ticket de cierre');
          return false;
        }
        printWindow.document.write(ticketHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 250);
        console.log('✅ Ticket de cierre enviado a impresión (web)');
        return true;
      }

      console.warn('⚠️ Impresión automática de ticket de cierre soportada en web/electron.');
      return false;
    } catch (error) {
      console.error('❌ Error imprimiendo ticket de cierre:', error);
      return false;
    }
  }, [buildClosureTicketHtml, completedRequestId]);

  useEffect(() => {
    if (!isClosureMode || !completedRequestId) {
      return;
    }

    const closureSnapshot = requestStatus?.closureContext?.sessionSnapshot;
    const isSnapshotReady =
      !!closureSnapshot &&
      closureSnapshot.times_and_status?.status === 'CLOSED' &&
      !!closureSnapshot.times_and_status?.closed_at &&
      Array.isArray(closureSnapshot.sales_breakdown?.by_payment_method) &&
      Array.isArray(closureSnapshot.sales_breakdown?.by_document_type) &&
      !!closureSnapshot.operational_traceability;

    if (closureTicketPrintedForRequestRef.current !== completedRequestId && isSnapshotReady) {
      closureTicketPrintedForRequestRef.current = completedRequestId;
      printClosureTicket().catch((error) => {
        console.error('❌ Error en impresión automática de ticket de cierre:', error);
      });
    }

    if (closureLogoutCountdown <= 0) {
      clearActiveRequest();
      logout().catch((error) => {
        console.error('❌ Error cerrando sesión post-cierre:', error);
      });
      return;
    }

    const timer = setTimeout(() => {
      setClosureLogoutCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    isClosureMode,
    completedRequestId,
    closureLogoutCountdown,
    clearActiveRequest,
    logout,
    printClosureTicket,
    requestStatus?.closureContext?.sessionSnapshot,
  ]);

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
      [
        CollectionRequestStatus.PENDING,
        CollectionRequestStatus.IN_PROGRESS,
        CollectionRequestStatus.PROCESSING,
      ].includes(requestStatus.status)
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
          <ActivityIndicator size="large" color={theme.color.text.link} />
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
        case CollectionRequestStatus.PROCESSING:
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
          <ActivityIndicator size="large" color={theme.color.text.link} />
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
            <CashProgressBar
              percent={cashStatus.percentUsed}
              alertLevel={cashStatus.alertLevel}
              height={16}
            />
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
            <View
              style={[
                styles.alertBox,
                { backgroundColor: config.backgroundColor, borderColor: config.borderColor },
              ]}
            >
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
            style={[styles.requestButton, cashStatus.isBlocked && styles.requestButtonUrgent]}
            onPress={handleRequestCollection}
            disabled={isRequestLoading}
          >
            {isRequestLoading ? (
              <ActivityIndicator color={theme.color.text.onAction} />
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
            <Text style={styles.errorText}>
              ❌ No se pudo obtener el código QR para esta solicitud.
            </Text>
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
          <Text style={styles.qrTitle}>
            {isClosureMode ? '🔒 ESCANEAR PARA RECAUDO DE CIERRE' : '📱 ESCANEAR PARA RECAUDAR'}
          </Text>

          {/* QR Code */}
          <View style={styles.qrContainer}>
            {QRCode ? (
              <QRCode value={qrValue} size={220} level="H" />
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
            <ActivityIndicator size="small" color={theme.color.state.warning.border} />
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
                <TouchableOpacity style={styles.confirmButtonYes} onPress={handleCancelRequest}>
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
          <ActivityIndicator size="large" color={theme.color.icon.accent} />
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
    const closureSnapshot = requestStatus?.closureContext?.sessionSnapshot;
    const monetarySummary = closureSnapshot?.monetary_summary;
    const sessionIdentity = closureSnapshot?.session_identity;
    const timesAndStatus = closureSnapshot?.times_and_status;
    const salesBreakdown = closureSnapshot?.sales_breakdown;
    const operationalTraceability = closureSnapshot?.operational_traceability;
    const reconciliationAndAudit = closureSnapshot?.reconciliation_and_audit;

    const renderArraySection = (title: string, rows?: Array<Record<string, unknown>>) => {
      if (!rows || rows.length === 0) {
        return (
          <View style={styles.completedInfo}>
            <Text style={styles.sectionTitleText}>{title}</Text>
            <Text style={styles.sectionEmptyText}>Sin registros</Text>
          </View>
        );
      }

      return (
        <View style={styles.completedInfo}>
          <Text style={styles.sectionTitleText}>{title}</Text>
          {rows.map((row, index) => (
            <View key={`${title}-${index}`} style={styles.subSectionBlock}>
              {Object.entries(row).map(([key, value]) => (
                <View key={`${title}-${index}-${key}`} style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>{key}:</Text>
                  <Text style={styles.completedValue}>{String(value ?? '-')}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
    };

    return (
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollCenter}>
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

          {isClosureMode && closureSnapshot && (
            <>
              <View style={styles.completedInfo}>
                <Text style={styles.sectionTitleText}>Identidad de sesión</Text>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Session ID:</Text>
                  <Text style={styles.completedValue}>{sessionIdentity?.session_id ?? '-'}</Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Caja:</Text>
                  <Text style={styles.completedValue}>
                    {sessionIdentity?.cash_register_name ?? '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Código caja:</Text>
                  <Text style={styles.completedValue}>
                    {sessionIdentity?.cash_register_code ?? '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Sede:</Text>
                  <Text style={styles.completedValue}>{sessionIdentity?.site_name ?? '-'}</Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Usuario:</Text>
                  <Text style={styles.completedValue}>{sessionIdentity?.user_name ?? '-'}</Text>
                </View>
              </View>

              <View style={styles.completedInfo}>
                <Text style={styles.sectionTitleText}>Tiempos y estado</Text>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Estado:</Text>
                  <Text style={styles.completedValue}>{timesAndStatus?.status ?? '-'}</Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Apertura:</Text>
                  <Text style={styles.completedValue}>{timesAndStatus?.opened_at ?? '-'}</Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Cierre:</Text>
                  <Text style={styles.completedValue}>{timesAndStatus?.closed_at ?? '-'}</Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Duración (min):</Text>
                  <Text style={styles.completedValue}>
                    {String(timesAndStatus?.duration_minutes ?? '-')}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Motivo cierre:</Text>
                  <Text style={styles.completedValue}>{timesAndStatus?.closure_reason ?? '-'}</Text>
                </View>
              </View>

              <View style={styles.completedInfo}>
                <Text style={styles.sectionTitleText}>Resumen monetario</Text>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Apertura:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.opening_cash_cents ?? 0) / 100)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Cierre:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.closing_cash_cents ?? 0) / 100)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Esperado:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.expected_cash_cents ?? 0) / 100)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Diferencia:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.difference_cents ?? 0) / 100)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Tipo diferencia:</Text>
                  <Text style={styles.completedValue}>
                    {monetarySummary?.difference_type ?? '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Ventas total:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.total_sales_cents ?? 0) / 100)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Cantidad ventas:</Text>
                  <Text style={styles.completedValue}>
                    {String(monetarySummary?.total_sales_count ?? '-')}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Ingresos caja:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.total_cash_in_cents ?? 0) / 100)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Egresos caja:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.total_cash_out_cents ?? 0) / 100)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Devoluciones:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.total_refunds_cents ?? 0) / 100)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Efectivo actual:</Text>
                  <Text style={styles.completedValue}>
                    {formatCurrency((monetarySummary?.current_cash_cents ?? 0) / 100)}
                  </Text>
                </View>
              </View>

              {renderArraySection(
                'Desglose por método de pago',
                salesBreakdown?.by_payment_method as Array<Record<string, unknown>> | undefined
              )}
              {renderArraySection(
                'Desglose por tipo de documento',
                salesBreakdown?.by_document_type as Array<Record<string, unknown>> | undefined
              )}
              {renderArraySection(
                'Desglose por cajero/sesión',
                salesBreakdown?.by_cashier_session as Array<Record<string, unknown>> | undefined
              )}

              <View style={styles.completedInfo}>
                <Text style={styles.sectionTitleText}>Trazabilidad operativa</Text>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Cerrado por:</Text>
                  <Text style={styles.completedValue}>
                    {operationalTraceability?.closed_by_name ??
                      operationalTraceability?.closed_by ??
                      '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Recaudo final ID:</Text>
                  <Text style={styles.completedValue}>
                    {operationalTraceability?.final_collection_id ?? '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Alerta caja:</Text>
                  <Text style={styles.completedValue}>
                    {operationalTraceability?.alerts?.cash_alert_level ?? '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Bloqueada:</Text>
                  <Text style={styles.completedValue}>
                    {String(operationalTraceability?.alerts?.is_blocked ?? false)}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Inconsistencias:</Text>
                  <Text style={styles.completedValue}>
                    {String(operationalTraceability?.alerts?.had_inconsistencies ?? false)}
                  </Text>
                </View>
              </View>

              <View style={styles.completedInfo}>
                <Text style={styles.sectionTitleText}>Reconciliación y auditoría</Text>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Estado:</Text>
                  <Text style={styles.completedValue}>
                    {reconciliationAndAudit?.reconciliation_status ?? '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Generado:</Text>
                  <Text style={styles.completedValue}>
                    {reconciliationAndAudit?.generated_at ?? '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Versión:</Text>
                  <Text style={styles.completedValue}>
                    {reconciliationAndAudit?.report_version ?? '-'}
                  </Text>
                </View>
                <View style={styles.completedInfoRow}>
                  <Text style={styles.completedLabel}>Source request ID:</Text>
                  <Text style={styles.completedValue}>
                    {reconciliationAndAudit?.source_request_id ?? '-'}
                  </Text>
                </View>
              </View>
            </>
          )}

          <Text style={styles.completedHint}>
            {isClosureMode
              ? `Cerrando sesión automáticamente en ${closureLogoutCountdown}s...`
              : 'El efectivo de su caja ha sido actualizado.'}
          </Text>

          {!isClosureMode && (
            <TouchableOpacity
              style={styles.completedButton}
              onPress={() => {
                clearActiveRequest();
                navigation.goBack();
              }}
            >
              <Text style={styles.completedButtonText}>Volver al Dashboard</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
          <Text style={styles.cancelledText}>La solicitud de recaudación ha sido cancelada.</Text>

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
        <Text style={styles.headerTitle}>
          {isClosureMode ? 'Recaudo de Cierre' : 'Recaudación de Efectivo'}
        </Text>
        <Text style={styles.headerSubtitle}>{selectedCashRegister?.name}</Text>
      </View>

      {renderContent()}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.background.subtle,
    },
    header: {
      backgroundColor: theme.color.surface.base,
      paddingTop: theme.space[4],
      paddingBottom: theme.space[4],
      paddingHorizontal: theme.space[5],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerBackButton: {
      marginRight: theme.space[3],
      padding: theme.space[1],
    },
    headerBackText: {
      fontSize: 24,
      color: theme.color.text.link,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      flex: 1,
    },
    headerSubtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    scrollContent: {
      flex: 1,
      padding: theme.space[4],
    },
    scrollCenter: {
      alignItems: 'center',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },
    loadingText: {
      marginTop: theme.space[3],
      fontSize: 16,
      color: theme.color.text.muted,
    },
    statusCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[5],
      marginBottom: theme.space[4],
      ...theme.shadow.sm,
    },
    statusHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[4],
    },
    statusTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[3],
      marginBottom: theme.space[5],
    },
    percentBig: {
      fontSize: 24,
      fontWeight: '700',
      minWidth: 60,
      textAlign: 'right',
    },
    amountsGrid: {
      gap: theme.space[3],
    },
    amountBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    amountLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    amountValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    amountValueBig: {
      fontSize: 18,
      fontWeight: '700',
    },
    alertBox: {
      marginTop: theme.space[4],
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      borderWidth: 1,
    },
    alertBoxText: {
      fontSize: 14,
      fontWeight: '500',
      textAlign: 'center',
    },
    collectionInfoCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[5],
      marginBottom: theme.space[4],
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[4],
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[2],
    },
    infoLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    infoValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    suggestedValue: {
      color: theme.color.action.success.background,
    },
    infoHint: {
      fontSize: 12,
      color: theme.color.text.placeholder,
      marginTop: theme.space[3],
      fontStyle: 'italic',
    },
    requestButton: {
      backgroundColor: theme.color.text.link,
      paddingVertical: theme.space[4],
      borderRadius: theme.radii.lg,
      alignItems: 'center',
      marginBottom: theme.space[3],
    },
    requestButtonUrgent: {
      backgroundColor: theme.color.action.danger.background,
    },
    requestButtonText: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '600',
    },
    backButton: {
      paddingVertical: theme.space[3],
      alignItems: 'center',
    },
    backButtonText: {
      color: theme.color.text.muted,
      fontSize: 14,
    },
    errorBox: {
      backgroundColor: theme.color.state.danger.background,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[3],
    },
    errorText: {
      color: theme.color.state.danger.text,
      fontSize: 14,
      textAlign: 'center',
    },

    qrCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[6],
      alignItems: 'center',
      width: '100%',
      maxWidth: 400,
    },
    qrTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[5],
    },
    qrContainer: {
      padding: theme.space[4],
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      borderWidth: 2,
      borderColor: theme.color.border.subtle,
      marginBottom: theme.space[4],
    },
    qrPlaceholder: {
      width: 220,
      height: 220,
      backgroundColor: theme.color.surface.subtle,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: theme.radii.md,
    },
    qrPlaceholderText: {
      fontSize: 48,
      fontWeight: 'bold',
      color: theme.color.text.placeholder,
    },
    qrTokenText: {
      fontSize: 10,
      color: theme.color.text.muted,
      marginTop: theme.space[2],
    },
    tokenContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      marginBottom: theme.space[4],
    },
    tokenLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    tokenValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
      fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    },
    countdownContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
      backgroundColor: theme.color.state.info.background,
      paddingHorizontal: theme.space[4],
      paddingVertical: theme.space[2],
      borderRadius: theme.radii.full,
      marginBottom: theme.space[5],
    },
    countdownUrgent: {
      backgroundColor: theme.color.state.danger.background,
    },
    countdownIcon: {
      fontSize: 16,
    },
    countdownText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.state.info.text,
    },
    countdownTextUrgent: {
      color: theme.color.state.danger.text,
    },
    qrInfoBox: {
      width: '100%',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[4],
      marginBottom: theme.space[5],
    },
    qrInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[1],
    },
    qrInfoLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    qrInfoValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    statusIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.space[2],
    },
    statusIndicatorText: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    cancelButton: {
      marginTop: theme.space[5],
      paddingVertical: theme.space[3],
      paddingHorizontal: theme.space[6],
      borderRadius: theme.radii.md,
      borderWidth: 1,
      borderColor: theme.color.action.danger.background,
    },
    cancelButtonText: {
      color: theme.color.action.danger.background,
      fontSize: 14,
      fontWeight: '500',
    },
    confirmOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[5],
    },
    confirmBox: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.lg,
      padding: theme.space[6],
      maxWidth: 320,
      width: '100%',
    },
    confirmTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[3],
      textAlign: 'center',
    },
    confirmText: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginBottom: theme.space[5],
      textAlign: 'center',
    },
    confirmButtons: {
      flexDirection: 'row',
      gap: theme.space[3],
    },
    confirmButtonNo: {
      flex: 1,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.border.subtle,
      alignItems: 'center',
    },
    confirmButtonNoText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.heading,
    },
    confirmButtonYes: {
      flex: 1,
      paddingVertical: theme.space[3],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.action.danger.background,
      alignItems: 'center',
    },
    confirmButtonYesText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.color.text.onAction,
    },

    inProgressCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[8],
      alignItems: 'center',
      maxWidth: 350,
    },
    inProgressTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.state.info.text,
      marginTop: theme.space[5],
      marginBottom: theme.space[3],
    },
    inProgressText: {
      fontSize: 16,
      color: theme.color.text.heading,
      textAlign: 'center',
      marginBottom: theme.space[2],
    },
    inProgressHint: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      fontStyle: 'italic',
    },
    completedCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[8],
      alignItems: 'center',
      width: '100%',
      maxWidth: 560,
    },
    completedIcon: {
      fontSize: 64,
      marginBottom: theme.space[4],
    },
    completedTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.color.action.success.background,
      marginBottom: theme.space[5],
    },
    completedInfo: {
      width: '100%',
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[4],
      marginBottom: theme.space[5],
    },
    completedInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.space[1.5],
    },
    completedLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    completedValue: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    sectionTitleText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.color.text.heading,
      marginBottom: theme.space[2.5],
    },
    sectionEmptyText: {
      fontSize: 13,
      color: theme.color.text.subtle,
      fontStyle: 'italic',
    },
    subSectionBlock: {
      marginBottom: theme.space[3],
      paddingBottom: theme.space[2],
      borderBottomWidth: 1,
      borderBottomColor: theme.color.border.subtle,
    },
    completedHint: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginBottom: theme.space[6],
    },
    completedButton: {
      backgroundColor: theme.color.action.success.background,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[8],
      borderRadius: theme.radii.md,
    },
    completedButtonText: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '600',
    },
    expiredCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[8],
      alignItems: 'center',
      maxWidth: 350,
    },
    expiredIcon: {
      fontSize: 64,
      marginBottom: theme.space[4],
    },
    expiredTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.icon.warning,
      marginBottom: theme.space[3],
    },
    expiredText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginBottom: theme.space[6],
    },
    regenerateButton: {
      backgroundColor: theme.color.text.link,
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[6],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[3],
    },
    regenerateButtonText: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '600',
    },
    backButtonAlt: {
      paddingVertical: theme.space[3],
    },
    backButtonAltText: {
      color: theme.color.text.muted,
      fontSize: 14,
    },
    cancelledCard: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      padding: theme.space[8],
      alignItems: 'center',
      maxWidth: 350,
    },
    cancelledIcon: {
      fontSize: 64,
      marginBottom: theme.space[4],
    },
    cancelledTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.muted,
      marginBottom: theme.space[3],
    },
    cancelledText: {
      fontSize: 14,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginBottom: theme.space[6],
    },
  });
