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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles, type Theme } from '@/design-system';

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
  onDismiss,
}) => {
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;
  const theme = useTheme();
  const styles = useThemedStyles(createStyles);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.color.text.link} />
            <Text style={styles.statusText}>Buscando actualizaciones...</Text>
          </View>
        );

      case 'available':
        return (
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="gift" size={40} color={theme.color.action.success.background} />
              <Text style={styles.title}>Actualización Disponible</Text>
            </View>

            <View style={styles.versionInfo}>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Versión Actual:</Text>
                <Text style={styles.versionValue}>{currentVersion}</Text>
              </View>
              <View style={styles.versionRow}>
                <Text style={styles.versionLabel}>Nueva Versión:</Text>
                <Text
                  style={[styles.versionValue, { color: theme.color.action.success.background }]}
                >
                  {latestVersion}
                </Text>
              </View>
            </View>

            {releaseNotes && (
              <View style={styles.releaseNotesContainer}>
                <Text style={styles.releaseNotesTitle}>Cambios:</Text>
                <ScrollView style={styles.releaseNotesScroll} nestedScrollEnabled>
                  <Text style={styles.releaseNotesText}>{releaseNotes}</Text>
                </ScrollView>
              </View>
            )}

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={onDownload}>
                <Ionicons name="download" size={20} color={theme.color.text.onAction} />
                <Text style={styles.buttonText}>Descargar Ahora</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onLater}>
                <Text style={styles.secondaryButtonText}>Más Tarde</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'downloading':
        return (
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="download" size={40} color={theme.color.icon.accent} />
              <Text style={styles.title}>Descargando Actualización</Text>
            </View>

            {downloadProgress && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBackground}>
                  <View
                    style={[styles.progressBarFill, { width: `${downloadProgress.percent || 0}%` }]}
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
              <Ionicons
                name="checkmark-circle"
                size={40}
                color={theme.color.action.success.background}
              />
              <Text style={styles.title}>Actualización Lista</Text>
            </View>

            <View style={styles.versionInfo}>
              <Text style={styles.description}>
                La actualización a la versión {latestVersion} ha sido descargada correctamente.
              </Text>
            </View>

            <View style={styles.buttonGroup}>
              <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={onInstall}>
                <Ionicons name="checkmark" size={20} color={theme.color.text.onAction} />
                <Text style={styles.buttonText}>Instalar Ahora</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={onLater}>
                <Text style={styles.secondaryButtonText}>Instalar al Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'error':
        return (
          <View style={styles.content}>
            <View style={styles.header}>
              <Ionicons name="alert-circle" size={40} color={theme.color.icon.danger} />
              <Text style={styles.title}>Error en la Actualización</Text>
            </View>

            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error || 'Ocurrió un error desconocido'}</Text>
            </View>

            <Text style={styles.description}>
              Por favor, intenta nuevamente más tarde o contacta al soporte.
            </Text>

            <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={onDismiss}>
              <Text style={styles.buttonText}>Aceptar</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, isSmallScreen && styles.modalContainerSmall]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={theme.color.icon.muted} />
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

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.color.overlay.medium,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.space[4],
    },
    modalContainer: {
      backgroundColor: theme.color.surface.base,
      borderRadius: theme.radii.xl,
      width: '100%',
      maxWidth: 500,
      maxHeight: '80%',
      ...theme.shadow.lg,
    },
    modalContainerSmall: {
      maxWidth: '100%',
    },
    closeButton: {
      position: 'absolute',
      top: theme.space[4],
      right: theme.space[4],
      zIndex: 10,
      padding: theme.space[2],
    },
    scrollContent: {
      paddingTop: theme.space[4],
    },
    centerContent: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.space[10],
    },
    content: {
      paddingHorizontal: theme.space[6],
      paddingVertical: theme.space[8],
      paddingTop: theme.space[12],
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.space[6],
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      marginTop: theme.space[3],
      textAlign: 'center',
      color: theme.color.text.heading,
    },
    versionInfo: {
      backgroundColor: theme.color.surface.subtle,
      borderRadius: theme.radii.md,
      padding: theme.space[4],
      marginBottom: theme.space[6],
    },
    versionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.space[2],
    },
    versionRow__last: {
      marginBottom: 0,
    },
    versionLabel: {
      fontSize: 14,
      color: theme.color.text.muted,
      fontWeight: '500',
    },
    versionValue: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    releaseNotesContainer: {
      marginBottom: theme.space[6],
      borderRadius: theme.radii.md,
      backgroundColor: theme.color.surface.subtle,
      padding: theme.space[3],
      maxHeight: 200,
    },
    releaseNotesTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: theme.space[2],
      color: theme.color.text.heading,
    },
    releaseNotesScroll: {
      maxHeight: 160,
    },
    releaseNotesText: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.color.text.body,
    },
    progressContainer: {
      marginVertical: theme.space[6],
    },
    progressBarBackground: {
      height: 8,
      backgroundColor: theme.color.border.subtle,
      borderRadius: theme.radii.xs,
      overflow: 'hidden',
      marginBottom: theme.space[3],
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: theme.color.icon.accent,
      borderRadius: theme.radii.xs,
    },
    progressPercent: {
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: theme.space[2],
      color: theme.color.text.heading,
    },
    transferInfo: {
      fontSize: 12,
      color: theme.color.text.muted,
      textAlign: 'center',
      marginBottom: theme.space[1],
    },
    estimatedTime: {
      fontSize: 12,
      color: theme.color.text.muted,
      textAlign: 'center',
      fontWeight: '500',
    },
    downloadingNote: {
      fontSize: 12,
      color: theme.color.icon.warning,
      textAlign: 'center',
      marginTop: theme.space[4],
      fontStyle: 'italic',
    },
    errorContainer: {
      backgroundColor: theme.color.state.danger.background,
      borderRadius: theme.radii.md,
      padding: theme.space[3],
      marginVertical: theme.space[4],
    },
    errorText: {
      fontSize: 14,
      color: theme.color.state.danger.text,
      lineHeight: 20,
    },
    description: {
      fontSize: 14,
      color: theme.color.text.muted,
      lineHeight: 20,
      marginBottom: theme.space[6],
      textAlign: 'center',
    },
    buttonGroup: {
      gap: theme.space[3],
    },
    button: {
      paddingVertical: theme.space[3.5],
      paddingHorizontal: theme.space[4],
      borderRadius: theme.radii.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.space[2],
    },
    primaryButton: {
      backgroundColor: theme.color.icon.accent,
    },
    secondaryButton: {
      backgroundColor: theme.color.surface.subtle,
      borderWidth: 1,
      borderColor: theme.color.border.subtle,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.onAction,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.color.text.heading,
    },
    statusText: {
      fontSize: 14,
      color: theme.color.text.muted,
      marginTop: theme.space[4],
    },
  });
