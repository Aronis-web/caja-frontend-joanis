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

type RouteParams = {
  SaleDetail: {
    saleId: string;
  };
};

export default function SaleDetailScreen() {
  const route = useRoute<RouteProp<RouteParams, 'SaleDetail'>>();
  const navigation = useNavigation();
  const { saleId } = route.params;

  const [saleInfo, setSaleInfo] = useState<SaleInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    loadSaleInfo();
  }, []);

  useEffect(() => {
    // Poll for document status if processing
    if (saleInfo?.status === 'processing' || saleInfo?.status === 'pending') {
      setPolling(true);
      const interval = setInterval(() => {
        loadSaleInfo(true);
      }, 5000);

      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    }
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'processing':
      case 'pending':
        return '#FF9800';
      case 'rejected':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'COMPLETADO';
      case 'processing':
        return 'PROCESANDO';
      case 'pending':
        return 'PENDIENTE';
      case 'rejected':
        return 'RECHAZADO';
      default:
        return status.toUpperCase();
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
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
          <ActivityIndicator size="small" color="#FF9800" />
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

        {saleInfo.status === 'completed' && saleInfo.documents.length > 0 && (
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#F44336',
    marginBottom: 16,
  },
  retryButton: {
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pollingBanner: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pollingText: {
    fontSize: 14,
    color: '#F57C00',
    fontWeight: '500',
  },
  card: {
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
  messageBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  messageText: {
    fontSize: 14,
    color: '#1976D2',
  },
  documentCard: {
    backgroundColor: '#F9F9F9',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  documentInfo: {
    marginBottom: 12,
  },
  documentNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentDate: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  documentHash: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
