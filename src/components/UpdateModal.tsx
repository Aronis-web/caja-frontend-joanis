/**
 * UpdateModal Component
 * Modal mejorado para mostrar estado de actualizaciones con:
 * - Progress bar detallada
 * - Tiempo estimado
 * - Changelog
 * - Opciones de instalación
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface UpdateModalProps {
  visible: boolean;
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'error' | null;
  currentVersion: string;
  latestVersion?: string;
  downloadProgress?: {
    percent: number;
    transferred?: number;
    total?: number;
    estimatedTimeRemaining?: string;
  };
  releaseNotes?: string;
  error?: string;
  onDownload?: () => void;
  onInstall?: () => void;
  onLater?: () => void;
  onDismiss?: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  status,
  currentVersion,
  latestVersion,
  downloadProgress,
  releaseNotes,
  error,
  onDownload,
  onInstall,
  onLater,
  onDismiss
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.statusText}>Buscando actualizaciones...</Text>
          </View>
        );

      case 'available':
        return (
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="gift" size={40} color="#4CAF50" />
              <Text style={styles.title}>Actualización Disponible</Text>
            </View>

            <View style={styles.versionInfo}>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Versión Actual:</Text>
                <Text style={styles.versionValue}>{currentVersion}</Text>
              </View>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Nueva Versión:</Text>
                <Text style={[styles.versionValue, { color: '#4CAF50' }]}>
                  {latestVersion}
                </Text>
              </View>
            </View>

            {releaseNotes && (
              <View style={styles.releaseNotesContainer}>
                <Text style={styles.releaseNotesTitle}>Cambios:</Text>
                <ScrollView
                  style={styles.releaseNotesScroll}
                  nestedScrollEnabled
                >
                  <Text style={styles.releaseNotesText}>{releaseNotes}</Text>
                </ScrollView>
              </View>
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={onDownload}
              >
                <Ionicons name="download" size={20} color="#fff" />
                <Text style={styles.buttonText}>Descargar Ahora</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={onLater}
              >
                <Text style={styles.secondaryButtonText}>Más Tarde</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'downloading':
        return (
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="download" size={40} color="#2196F3" />
              <Text style={styles.title}>Descargando Actualización</Text>
            </View>

            {downloadProgress && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${downloadProgress.percent || 0}%` }
                    ]}
                  />
                </View>

                <Text style={styles.progressPercent}>
                  {Math.round(downloadProgress.percent || 0)}%
                </Text>

                {downloadProgress.transferred !== undefined &&
                  downloadProgress.total !== undefined && (
                    <Text style={styles.transferInfo}>
                      {formatBytes(downloadProgress.transferred)} /{' '}
                      {formatBytes(downloadProgress.total)}
                    </Text>
                  )}

                {downloadProgress.estimatedTimeRemaining && (
                  <Text style={styles.estimatedTime}>
                    ⏱️ Tiempo estimado: {downloadProgress.estimatedTimeRemaining}
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.downloadingNote}>
              No cierres la aplicación mientras se descarga la actualización
            </Text>
          </View>
        );

      case 'downloaded':
        return (
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
              <Text style={styles.title}>Actualización Lista</Text>
            </View>

            <View style={styles.versionInfo}>
              <Text style={styles.description}>
                La actualización a la versión {latestVersion} ha sido descargada
                correctamente.
              </Text>
            </View>

            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={onInstall}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.buttonText}>Instalar Ahora</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={onLater}
              >
                <Text style={styles.secondaryButtonText}>
                  Instalar al Cerrar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'error':
        return (
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="alert-circle" size={40} color="#FF6B6B" />
              <Text style={styles.title}>Error en la Actualización</Text>
            </View>

            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error || 'Ocurrió un error desconocido'}</Text>
            </View>

            <Text style={styles.description}>
              Por favor, intenta nuevamente más tarde o contacta al soporte.
            </Text>

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={onDismiss}
            >
              <Text style={styles.buttonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            isSmallScreen && styles.modalContainerSmall
          ]}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>

          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {renderContent()}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8
  },
  modalContainerSmall: {
    maxWidth: '100%'
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 8
  },
  scrollContent: {
    paddingTop: 16
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    paddingTop: 48
  },
  header: {
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
    color: '#000'
  },
  versionInfo: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  versionRow__last: {
    marginBottom: 0
  },
  versionLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500'
  },
  versionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000'
  },
  releaseNotesContainer: {
    marginBottom: 24,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    padding: 12,
    maxHeight: 200
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#000'
  },
  releaseNotesScroll: {
    maxHeight: 160
  },
  releaseNotesText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#555'
  },
  progressContainer: {
    marginVertical: 24
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2196F3',
    borderRadius: 4
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#000'
  },
  transferInfo: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 4
  },
  estimatedTime: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500'
  },
  downloadingNote: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic'
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 12,
    marginVertical: 16
  },
  errorText: {
    fontSize: 14,
    color: '#C62828',
    lineHeight: 20
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 24,
    textAlign: 'center'
  },
  buttonGroup: {
    gap: 12
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  primaryButton: {
    backgroundColor: '#2196F3'
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff'
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  statusText: {
    fontSize: 14,
    color: '#666',
    marginTop: 16
  }
});
