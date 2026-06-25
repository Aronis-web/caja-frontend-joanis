/**
 * useAppUpdater Hook
 * Maneja el ciclo de vida de actualizaciones contra el servidor (/api/pos/app-updates/*).
 * - Check: HTTP a svc-pos (funciona en cualquier plataforma).
 * - Descarga/instalacion: depende de la plataforma.
 *   - Electron: IPC para descargar binario y lanzar instalador.
 *   - Android: abre la URL del APK con Linking; el SO instala.
 *   - iOS/Web: muestra info; no se puede sideload.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Linking, Platform } from 'react-native';
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

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform?: string;
      getAppVersion: () => Promise<{ version: string; name: string }>;
      downloadAppUpdate: (args: {
        url: string;
        version?: string;
        filename?: string;
        expectedChecksum?: string;
        expectedBytes?: number;
      }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      installAppUpdate: (args?: { filePath?: string }) => Promise<{ success: boolean; error?: string }>;
      cancelAppUpdate: () => Promise<{ success: boolean; error?: string }>;
      onUpdateStatus: (
        cb: (data: { status: string; version?: string; filePath?: string; error?: string }) => void
      ) => void;
      onDownloadProgress: (cb: (data: DownloadProgress) => void) => void;
      removeUpdateListeners?: () => void;
      // legacy (preload viejo); ya no se usan
      checkForUpdates?: () => Promise<unknown>;
      downloadUpdate?: () => Promise<unknown>;
      installUpdate?: () => Promise<unknown>;
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
      if (data.status === 'downloaded') {
        filePathRef.current = data.filePath;
        setState((s) => ({ ...s, status: 'downloaded', filePath: data.filePath }));
      } else if (data.status === 'installing') {
        setState((s) => ({ ...s, status: 'installing' }));
      } else if (data.status === 'error') {
        setState((s) => ({ ...s, status: 'error', error: data.error || 'Error desconocido' }));
      }
    });

    return () => {
      window.electronAPI?.removeUpdateListeners?.();
    };
  }, [isElectron]);

  const checkForUpdates = useCallback(async (): Promise<CheckUpdateResponse | null> => {
    setState((s) => ({ ...s, status: 'checking', error: undefined }));
    try {
      const currentVersion =
        isElectron && window.electronAPI
          ? (await window.electronAPI.getAppVersion()).version
          : state.currentVersion;

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
      const message = error instanceof Error ? error.message : 'Error al verificar actualizaciones';
      setState((s) => ({ ...s, status: 'error', error: message }));
      return null;
    }
  }, [isElectron, state.currentVersion]);

  const downloadUpdate = useCallback(async () => {
    const downloadUrl = state.downloadUrl;
    const version = state.latestVersion;
    if (!downloadUrl) {
      setState((s) => ({ ...s, status: 'error', error: 'No hay URL de descarga' }));
      return { success: false, error: 'No hay URL de descarga' };
    }

    // Forzar svc-pos como origen de descarga si tenemos los datos necesarios
    const forcedUrl =
      version && state.updateAvailable
        ? appUpdatesService.buildDownloadUrl(APP_SLUG, getUpdatePlatform(), version)
        : downloadUrl;

    if (isElectron && window.electronAPI) {
      setState((s) => ({ ...s, status: 'downloading', error: undefined }));
      try {
        const result = await window.electronAPI.downloadAppUpdate({
          url: forcedUrl,
          version,
          expectedChecksum: state.checksum,
          expectedBytes: state.sizeBytes,
        });
        if (!result.success) {
          setState((s) => ({ ...s, status: 'error', error: result.error || 'Error al descargar' }));
        } else {
          filePathRef.current = result.filePath;
          setState((s) => ({ ...s, status: 'downloaded', filePath: result.filePath }));
        }
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al descargar';
        setState((s) => ({ ...s, status: 'error', error: message }));
        return { success: false, error: message };
      }
    }

    if (Platform.OS === 'android') {
      try {
        await Linking.openURL(forcedUrl);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'No se pudo abrir la descarga';
        setState((s) => ({ ...s, status: 'error', error: message }));
        return { success: false, error: message };
      }
    }

    // iOS / Web: solo abrir la URL en el navegador
    try {
      await Linking.openURL(forcedUrl);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo abrir la descarga';
      setState((s) => ({ ...s, status: 'error', error: message }));
      return { success: false, error: message };
    }
  }, [isElectron, state.downloadUrl, state.latestVersion, state.checksum, state.sizeBytes, state.updateAvailable]);

  const installUpdate = useCallback(async () => {
    if (!isElectron || !window.electronAPI) {
      return { success: false, error: 'Solo disponible en Electron' };
    }
    try {
      setState((s) => ({ ...s, status: 'installing' }));
      const result = await window.electronAPI.installAppUpdate({ filePath: filePathRef.current });
      if (!result.success) {
        setState((s) => ({ ...s, status: 'error', error: result.error || 'Error al instalar' }));
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al instalar';
      setState((s) => ({ ...s, status: 'error', error: message }));
      return { success: false, error: message };
    }
  }, [isElectron]);

  const cancelDownload = useCallback(async () => {
    if (!isElectron || !window.electronAPI) return { success: false };
    return window.electronAPI.cancelAppUpdate();
  }, [isElectron]);

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
