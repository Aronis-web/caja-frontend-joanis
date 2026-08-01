/**
 * useAppUpdater Hook
 * Maneja el ciclo de vida de actualizaciones de la app.
 * - Electron (escritorio): electron-updater + GitHub Releases vía IPC
 *   (igual que admin-frontend-joanis). El check/descarga/instalación los hace
 *   el main process; el renderer solo reacciona a los eventos.
 * - Android: check HTTP a svc-admin (/api/app-updates) y abre el APK con Linking.
 * - iOS/Web: muestra info; no se puede sideload.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { appUpdatesService } from '@/services/AppUpdatesService';
import { APP_SLUG, getUpdatePlatform } from '@/utils/config';
import type { CheckUpdateResponse } from '@/types/appUpdates';

interface DownloadProgress {
  percent: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
}

type UpdateStage =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'up-to-date'
  | 'error';

interface UpdateState {
  currentVersion: string;
  latestVersion?: string;
  updateAvailable: boolean;
  status: UpdateStage;
  downloadProgress?: DownloadProgress;
  releaseNotes?: string;
  releasedAt?: string;
  downloadUrl?: string;
  checksum?: string;
  sizeBytes?: number;
  mandatory?: boolean;
  filePath?: string;
  error?: string;
}

/** Resultado del check expuesto por el main process (electron-updater). */
interface ElectronCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseDate?: string;
  releaseNotes?: string;
  updateDownloaded?: boolean;
  message?: string;
  error?: string;
}

/** Evento de estado reenviado desde el main process. */
interface ElectronUpdateStatus {
  status: string;
  version?: string;
  releaseDate?: string;
  releaseNotes?: string;
  filePath?: string;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform?: string;
      getAppVersion: () => Promise<{ version: string; name: string }>;
      // electron-updater (GitHub Releases)
      checkForUpdates: () => Promise<ElectronCheckResult>;
      downloadUpdate: () => Promise<{ success: boolean; message?: string; error?: string }>;
      installUpdate: () => Promise<{ success: boolean; message?: string; error?: string }>;
      onUpdateStatus: (cb: (data: ElectronUpdateStatus) => void) => void;
      onDownloadProgress: (cb: (data: DownloadProgress) => void) => void;
      removeUpdateListeners?: () => void;
    };
  }
}

const initialState: UpdateState = {
  currentVersion: '0.0.0',
  status: 'idle',
  updateAvailable: false,
};

export const useAppUpdater = () => {
  const [state, setState] = useState<UpdateState>(initialState);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const filePathRef = useRef<string | undefined>(undefined);

  const isElectron =
    typeof window !== 'undefined' && !!window.electronAPI && window.electronAPI.isElectron;

  useEffect(() => {
    if (!isElectron || !window.electronAPI) return;

    window.electronAPI
      .getAppVersion()
      .then(({ version }) => setState((s) => ({ ...s, currentVersion: version })))
      .catch(() => undefined);

    window.electronAPI.onDownloadProgress?.((progress) => {
      setState((s) => ({ ...s, status: 'downloading', downloadProgress: progress }));
    });

    window.electronAPI.onUpdateStatus?.((data) => {
      switch (data.status) {
        case 'available':
          setState((s) => ({
            ...s,
            status: 'available',
            updateAvailable: true,
            latestVersion: data.version ?? s.latestVersion,
            releaseNotes: data.releaseNotes ?? s.releaseNotes,
            releasedAt: data.releaseDate ?? s.releasedAt,
          }));
          setShowUpdateModal(true);
          break;
        case 'up-to-date':
          setState((s) => ({
            ...s,
            status: 'up-to-date',
            updateAvailable: false,
            error: undefined,
          }));
          break;
        case 'downloading':
          setState((s) => ({ ...s, status: 'downloading' }));
          break;
        case 'downloaded':
          filePathRef.current = data.filePath;
          setState((s) => ({
            ...s,
            status: 'downloaded',
            filePath: data.filePath,
            latestVersion: data.version ?? s.latestVersion,
          }));
          break;
        case 'installing':
          setState((s) => ({ ...s, status: 'installing' }));
          break;
        case 'error':
          setState((s) => ({ ...s, status: 'error', error: data.error || 'Error desconocido' }));
          break;
        default:
          break;
      }
    });

    return () => {
      window.electronAPI?.removeUpdateListeners?.();
    };
  }, [isElectron]);

  const checkForUpdates = useCallback(async (): Promise<CheckUpdateResponse | null> => {
    setState((s) => ({ ...s, status: 'checking', error: undefined }));

    // ===== Electron: electron-updater (GitHub Releases) =====
    if (isElectron && window.electronAPI) {
      try {
        const result = await window.electronAPI.checkForUpdates();
        setState((s) => ({
          ...s,
          currentVersion: result.currentVersion || s.currentVersion,
          latestVersion: result.latestVersion,
          updateAvailable: !!result.updateAvailable,
          status: result.updateAvailable ? 'available' : 'up-to-date',
          releaseNotes: result.releaseNotes,
          releasedAt: result.releaseDate,
          error: result.error,
        }));

        if (result.updateAvailable) setShowUpdateModal(true);

        return {
          updateAvailable: !!result.updateAvailable,
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          releaseNotes: result.releaseNotes,
          releasedAt: result.releaseDate,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Error al verificar actualizaciones';
        setState((s) => ({ ...s, status: 'error', error: message }));
        return null;
      }
    }

    // ===== Android / iOS / Web: check HTTP a svc-admin =====
    try {
      const currentVersion = state.currentVersion;
      const result = await appUpdatesService.check({
        appId: APP_SLUG,
        platform: getUpdatePlatform(),
        currentVersion,
      });

      setState((s) => ({
        ...s,
        currentVersion,
        latestVersion: result.latestVersion,
        updateAvailable: !!result.updateAvailable,
        status: result.updateAvailable ? 'available' : 'up-to-date',
        downloadUrl: result.downloadUrl,
        checksum: result.checksum,
        sizeBytes: result.sizeBytes,
        releaseNotes: result.releaseNotes,
        releasedAt: result.releasedAt,
        mandatory: result.mandatory,
      }));

      if (result.updateAvailable) setShowUpdateModal(true);
      return result;
    } catch (error) {
      // Si el endpoint no está disponible (404), no es un error real: no hay
      // actualizaciones que ofrecer.
      const status = (error as { status?: number } | undefined)?.status;
      if (status === 404) {
        setState((s) => ({ ...s, status: 'up-to-date', updateAvailable: false, error: undefined }));
        return null;
      }

      const message = error instanceof Error ? error.message : 'Error al verificar actualizaciones';
      setState((s) => ({ ...s, status: 'error', error: message }));
      return null;
    }
  }, [isElectron, state.currentVersion]);

  const downloadUpdate = useCallback(async () => {
    // ===== Electron: electron-updater descarga el binario =====
    if (isElectron && window.electronAPI) {
      setState((s) => ({ ...s, status: 'downloading', error: undefined }));
      try {
        const result = await window.electronAPI.downloadUpdate();
        if (!result.success) {
          setState((s) => ({ ...s, status: 'error', error: result.error || 'Error al descargar' }));
        }
        // El cambio a 'downloaded' y el progreso llegan por eventos IPC.
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al descargar';
        setState((s) => ({ ...s, status: 'error', error: message }));
        return { success: false, error: message };
      }
    }

    // ===== Android / iOS / Web: abrir la URL de descarga =====
    const version = state.latestVersion;
    const forcedUrl =
      version && state.updateAvailable
        ? appUpdatesService.buildDownloadUrl(APP_SLUG, getUpdatePlatform(), version)
        : state.downloadUrl;

    if (!forcedUrl) {
      setState((s) => ({ ...s, status: 'error', error: 'No hay URL de descarga' }));
      return { success: false, error: 'No hay URL de descarga' };
    }

    try {
      await Linking.openURL(forcedUrl);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo abrir la descarga';
      setState((s) => ({ ...s, status: 'error', error: message }));
      return { success: false, error: message };
    }
  }, [isElectron, state.downloadUrl, state.latestVersion, state.updateAvailable]);

  const installUpdate = useCallback(async () => {
    if (!isElectron || !window.electronAPI) {
      return { success: false, error: 'Solo disponible en Electron' };
    }
    try {
      setState((s) => ({ ...s, status: 'installing' }));
      const result = await window.electronAPI.installUpdate();
      if (!result.success) {
        setState((s) => ({
          ...s,
          status: 'error',
          error: result.error || result.message || 'Error al instalar',
        }));
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al instalar';
      setState((s) => ({ ...s, status: 'error', error: message }));
      return { success: false, error: message };
    }
  }, [isElectron]);

  // electron-updater no expone cancelación de descarga; se mantiene por
  // compatibilidad de API y para que la app pueda cerrar el modal.
  const cancelDownload = useCallback(async () => {
    return { success: false as const, error: 'Cancelación no soportada' };
  }, []);

  const dismissUpdateModal = useCallback(() => setShowUpdateModal(false), []);

  const resetUpdateState = useCallback(() => {
    filePathRef.current = undefined;
    setState((s) => ({
      currentVersion: s.currentVersion,
      status: 'idle',
      updateAvailable: false,
    }));
  }, []);

  return {
    // Estado
    updateStatus: state,
    showUpdateModal,
    isElectron,

    // Acciones
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    cancelDownload,
    dismissUpdateModal,
    setShowUpdateModal,
    resetUpdateState,

    // Helpers
    hasUpdateAvailable: state.updateAvailable,
    isDownloading: state.status === 'downloading',
    isChecking: state.status === 'checking',
    isDownloaded: state.status === 'downloaded',
    isInstalling: state.status === 'installing',
    hasError: state.status === 'error',
  };
};
