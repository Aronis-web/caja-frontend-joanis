/**
 * Sale Detail Screen
 * Shows sale details and allows downloading PDF
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { posService } from '@/services/POSService';
import type { SaleInfo } from '@/types/pos';
import { config } from '@/utils/config';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';

type RouteParams = {
  SaleDetail: {
    saleId: string;
  };
};

export default function SaleDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'SaleDetail'>>();
  const navigation = useNavigation();
  const { saleId } = route.params;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const [saleInfo, setSaleInfo] = useState<SaleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    loadSaleInfo();
  }, []);

  useEffect(() => {
    const normalizedStatus = (saleInfo?.status ?? '').toLowerCase();

    // Poll for document status if processing
    if (normalizedStatus === 'processing' || normalizedStatus === 'pending') {
      setPolling(true);
      const interval = setInterval(() => {
        void loadSaleInfo(true);
      }, 5000);

      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    }

    setPolling(false);
  }, [saleInfo?.status]);

  const loadSaleInfo = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const info = await posService.getSaleInfo(saleId);
      setSaleInfo(info);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar la información de la venta');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!saleInfo?.documents || saleInfo.documents.length === 0) {
      Alert.alert('Error', 'El documento aún no está disponible');
      return;
    }

    const document = saleInfo.documents[0];
    const pdfUrl = `${config.API_URL}${document.pdfUrl}`;

    try {
      const supported = await Linking.canOpenURL(pdfUrl);
      if (supported) {
        await Linking.openURL(pdfUrl);
      } else {
        Alert.alert('Error', 'No se puede abrir el PDF');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo descargar el PDF');
    }
  };

  const formatCurrency = (amount: number) => `S/ ${amount.toFixed(2)}`;

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

  const getStatusColor = (status?: string) => {
    const normalizedStatus = (status ?? '').toLowerCase();

    switch (normalizedStatus) {
      case 'completed':
        return theme.color.action.success.background;
      case 'processing':
      case 'pending':
        return theme.color.icon.warning;
      case 'rejected':
        return theme.color.action.danger.background;
      default:
        return theme.color.icon.subtle;
    }
  };

  const getStatusText = (status?: string) => {
    const normalizedStatus = (status ?? '').toLowerCase();

    switch (normalizedStatus) {
      case 'completed':
        return 'COMPLETADO';
      case 'processing':
        return 'PROCESANDO';
      case 'pending':
        return 'PENDIENTE';
      case 'rejected':
        return 'RECHAZADO';
      default:
        return normalizedStatus ? normalizedStatus.toUpperCase() : 'SIN ESTADO';
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.color.text.link} />
        <Text style={styles.loadingText}>Cargando venta...</Text>
      </View>
    );
  }

  if (!saleInfo) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>No se pudo cargar la venta</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadSaleInfo()}>
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Venta {saleInfo.saleNumber}</Text>
          <Text style={styles.subtitle}>
            {saleInfo.documentType === '01' ? 'Factura' : 'Boleta'}
            {saleInfo.documentNumber && `: ${saleInfo.documentNumber}`}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(saleInfo.status) }]}>
          <Text style={styles.statusText}>{getStatusText(saleInfo.status)}</Text>
        </View>
      </View>

      {/* Status Message */}
      {polling && (
        <View style={styles.pollingBanner}>
          <ActivityIndicator size="small" color={theme.color.icon.warning} />
          <Text style={styles.pollingText}>Esperando generación del documento...</Text>
        </View>
      )}

      {/* Sale Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Información General</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fecha:</Text>
          <Text style={styles.infoValue}>{formatDateTime(saleInfo.createdAt)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Total:</Text>
          <Text style={styles.infoValueHighlight}>{formatCurrency(saleInfo.total)}</Text>
        </View>

        {saleInfo.message && (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>{saleInfo.message}</Text>
          </View>
        )}
      </View>

      {/* Documents */}
      {saleInfo.documents && saleInfo.documents.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Documentos</Text>

          {saleInfo.documents.map((doc) => (
            <View key={doc.id} style={styles.documentCard}>
              <View style={styles.documentInfo}>
                <Text style={styles.documentNumber}>{doc.documentNumber}</Text>
                <Text style={styles.documentDate}>{formatDateTime(doc.createdAt)}</Text>
                {doc.sunatHash && (
                  <Text style={styles.documentHash} numberOfLines={1}>
                    Hash: {doc.sunatHash.substring(0, 20)}...
                  </Text>
                )}
              </View>

              <TouchableOpacity style={styles.downloadButton} onPress={handleDownloadPDF}>
                <Text style={styles.downloadButtonText}>📄 Descargar PDF</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.backButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Volver</Text>
        </TouchableOpacity>

        {saleInfo.status === 'completed' && saleInfo.documents && saleInfo.documents.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleDownloadPDF}
          >
            <Text style={styles.primaryButtonText}>Descargar PDF</Text>
          </TouchableOpacity>
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
    loadingText: {
      marginTop: theme.space[3],
      fontSize: 16,
      color: theme.color.text.muted,
    },
    errorText: {
      fontSize: 18,
      color: theme.color.text.danger,
      marginBottom: theme.space[4],
    },
    retryButton: {
      padding: theme.space[3],
      backgroundColor: theme.color.text.link,
      borderRadius: theme.radii.md,
    },
    retryButtonText: {
      color: theme.color.text.onAction,
      fontSize: 16,
      fontWeight: '600',
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
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    subtitle: {
      fontSize: 14,
      color: theme.color.text.muted,
    },
    statusBadge: {
      paddingHorizontal: theme.space[3],
      paddingVertical: theme.space[1.5],
      borderRadius: theme.radii.lg,
    },
    statusText: {
      color: theme.color.text.onAction,
      fontSize: 12,
      fontWeight: '600',
    },
    pollingBanner: {
      backgroundColor: theme.color.state.warning.background,
      padding: theme.space[3],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
    },
    pollingText: {
      fontSize: 14,
      color: theme.color.state.warning.text,
      fontWeight: '500',
    },
    card: {
      backgroundColor: theme.color.surface.base,
      margin: theme.space[4],
      padding: theme.space[5],
      borderRadius: theme.radii.lg,
      ...theme.shadow.sm,
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
      color: theme.color.action.success.background,
    },
    messageBox: {
      backgroundColor: theme.color.state.info.background,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      marginTop: theme.space[2],
    },
    messageText: {
      fontSize: 14,
      color: theme.color.state.info.text,
    },
    documentCard: {
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[4],
      borderRadius: theme.radii.md,
      marginBottom: theme.space[3],
    },
    documentInfo: {
      marginBottom: theme.space[3],
    },
    documentNumber: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
      marginBottom: theme.space[1],
    },
    documentDate: {
      fontSize: 13,
      color: theme.color.text.muted,
      marginBottom: theme.space[1],
    },
    documentHash: {
      fontSize: 11,
      color: theme.color.text.placeholder,
      fontFamily: 'monospace',
    },
    downloadButton: {
      backgroundColor: theme.color.text.link,
      padding: theme.space[3],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    downloadButtonText: {
      color: theme.color.text.onAction,
      fontSize: 14,
      fontWeight: '600',
    },
    actionsContainer: {
      flexDirection: 'row',
      padding: theme.space[4],
      gap: theme.space[3],
    },
    button: {
      flex: 1,
      padding: theme.space[4],
      borderRadius: theme.radii.md,
      alignItems: 'center',
    },
    backButton: {
      backgroundColor: theme.color.surface.base,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    backButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.muted,
    },
    primaryButton: {
      backgroundColor: theme.color.text.link,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
  });
