"use strict";
/**
 * useAppUpdater Hook
 * Hook personalizado para manejar el ciclo de vida de actualizaciones
 * Integrado con Electron y estado global
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAppUpdater = void 0;
const react_1 = require("react");
const defaultStatus = {
    currentVersion: '0.0.0',
    status: 'idle',
    updateAvailable: false,
};
const useAppUpdater = () => {
    const [updateStatus, setUpdateStatus] = (0, react_1.useState)(defaultStatus);
    const [showUpdateModal, setShowUpdateModal] = (0, react_1.useState)(false);
    const [isElectron, setIsElectron] = (0, react_1.useState)(false);
    // Detectar si está ejecutándose en Electron
    (0, react_1.useEffect)(() => {
        const hasElectronAPI = typeof window !== 'undefined' && !!window.electronAPI;
        setIsElectron(hasElectronAPI);
        if (hasElectronAPI && window.electronAPI) {
            // Cargar versión actual
            initializeVersionInfo();
            // Escuchar eventos de actualización
            setupElectronListeners();
        }
    }, []);
    /**
     * Inicializar información de versión
     */
    const initializeVersionInfo = async () => {
        if (!window.electronAPI)
            return;
        try {
            const { version } = await window.electronAPI.getAppVersion();
            setUpdateStatus((prev) => ({
                ...prev,
                currentVersion: version,
            }));
        }
        catch (error) {
            console.error('[UPDATE HOOK] Error getting app version:', error);
        }
    };
    /**
     * Configurar escuchadores de Electron
     */
    const setupElectronListeners = () => {
        if (!window.electronAPI)
            return;
        // Escuchar cambios de estado de actualización
        window.electronAPI.onUpdateStatus?.((data) => {
            console.log('[UPDATE HOOK] Status change:', data);
            const statusMap = {
                checking: 'checking',
                available: 'available',
                downloading: 'downloading',
                downloaded: 'downloaded',
                error: 'error',
            };
            setUpdateStatus((prev) => ({
                ...prev,
                status: statusMap[data.status] || prev.status,
                latestVersion: data.version || prev.latestVersion,
                releaseNotes: data.releaseNotes || prev.releaseNotes,
                error: data.error || undefined,
                updateAvailable: data.status === 'available' || data.status === 'downloaded',
            }));
            // Mostrar modal automáticamente para disponible o descargado
            if (data.status === 'available' || data.status === 'downloaded') {
                setShowUpdateModal(true);
            }
        });
        // Escuchar progreso de descarga
        window.electronAPI.onDownloadProgress?.((progress) => {
            setUpdateStatus((prev) => ({
                ...prev,
                status: 'downloading',
                downloadProgress: progress,
            }));
        });
    };
    /**
     * Verificar actualizaciones manualmente
     */
    const checkForUpdates = (0, react_1.useCallback)(async () => {
        if (!window.electronAPI) {
            console.warn('[UPDATE HOOK] Electron API no disponible');
            return;
        }
        try {
            setUpdateStatus((prev) => ({ ...prev, status: 'checking' }));
            const result = await window.electronAPI.checkForUpdates();
            setUpdateStatus((prev) => ({
                ...prev,
                status: result.updateAvailable ? 'available' : 'idle',
                latestVersion: result.latestVersion,
                updateAvailable: result.updateAvailable,
                releaseNotes: result.releaseNotes,
            }));
            if (result.updateAvailable) {
                setShowUpdateModal(true);
            }
            return result;
        }
        catch (error) {
            console.error('[UPDATE HOOK] Error checking for updates:', error);
            setUpdateStatus((prev) => ({
                ...prev,
                status: 'error',
                error: 'Error al verificar actualizaciones',
            }));
            throw error;
        }
    }, []);
    /**
     * Descargar actualización
     */
    const downloadUpdate = (0, react_1.useCallback)(async () => {
        if (!window.electronAPI) {
            console.warn('[UPDATE HOOK] Electron API no disponible');
            return;
        }
        try {
            setUpdateStatus((prev) => ({ ...prev, status: 'downloading' }));
            const result = await window.electronAPI.downloadUpdate();
            if (!result.success) {
                setUpdateStatus((prev) => ({
                    ...prev,
                    status: 'error',
                    error: result.error || 'Error desconocido al descargar',
                }));
                throw new Error(result.error || 'Error al descargar');
            }
            return result;
        }
        catch (error) {
            console.error('[UPDATE HOOK] Error downloading update:', error);
            setUpdateStatus((prev) => ({
                ...prev,
                status: 'error',
                error: error instanceof Error ? error.message : 'Error desconocido',
            }));
            throw error;
        }
    }, []);
    /**
     * Instalar actualización
     */
    const installUpdate = (0, react_1.useCallback)(async () => {
        if (!window.electronAPI) {
            console.warn('[UPDATE HOOK] Electron API no disponible');
            return;
        }
        try {
            const result = await window.electronAPI.installUpdate();
            if (!result.success) {
                setUpdateStatus((prev) => ({
                    ...prev,
                    status: 'error',
                    error: result.message || 'Error al instalar',
                }));
                throw new Error(result.message || 'Error al instalar');
            }
            // La app se reiniciará después de instalar
            return result;
        }
        catch (error) {
            console.error('[UPDATE HOOK] Error installing update:', error);
            setUpdateStatus((prev) => ({
                ...prev,
                status: 'error',
                error: error instanceof Error ? error.message : 'Error desconocido',
            }));
            throw error;
        }
    }, []);
    /**
     * Obtener estadísticas de actualización
     */
    const getUpdateStats = (0, react_1.useCallback)(async () => {
        if (!window.electronAPI)
            return null;
        try {
            return await window.electronAPI.getUpdateStats();
        }
        catch (error) {
            console.error('[UPDATE HOOK] Error getting stats:', error);
            return null;
        }
    }, []);
    /**
     * Obtener telemetría
     */
    const getTelemetryData = (0, react_1.useCallback)(async () => {
        if (!window.electronAPI)
            return null;
        try {
            return await window.electronAPI.getTelemetryData();
        }
        catch (error) {
            console.error('[UPDATE HOOK] Error getting telemetry:', error);
            return null;
        }
    }, []);
    /**
     * Cerrar modal
     */
    const dismissUpdateModal = (0, react_1.useCallback)(() => {
        setShowUpdateModal(false);
    }, []);
    return {
        // Estado
        updateStatus,
        showUpdateModal,
        isElectron,
        // Acciones
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        getUpdateStats,
        getTelemetryData,
        dismissUpdateModal,
        // Helpers
        hasUpdateAvailable: updateStatus.updateAvailable,
        isDownloading: updateStatus.status === 'downloading',
        isChecking: updateStatus.status === 'checking',
        hasError: updateStatus.status === 'error',
    };
};
exports.useAppUpdater = useAppUpdater;
