"use strict";
/**
 * Update Configuration
 * Centraliza toda la configuración de actualizaciones
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConfig = void 0;
exports.getReleaseChannelConfig = getReleaseChannelConfig;
exports.getMessage = getMessage;
exports.updateConfig = {
    // Intervalos de chequeo
    checkIntervalOnStartup: 5000, // 5 segundos
    checkIntervalPeriodic: 4 * 60 * 60 * 1000, // 4 horas
    // Tolerancia de crashes
    maxCrashAttempts: 2,
    crashDetectionTimeout: 60000, // 1 minuto
    // Limpieza de logs
    logsRetentionDays: 30,
    logsMaxSize: 1000,
    // Distribución y publicación
    releaseChannel: {
        stable: 'release',
        beta: 'prerelease',
        edge: 'draft',
    },
    // Configuración de GitHub (ajustar según tu repo)
    github: {
        owner: 'aronis-web', // Cambiar al propietario del repo
        repo: 'caja-frontend-joanis', // Cambiar al nombre del repo
        provider: 'github',
    },
    // Mensajes en español
    messages: {
        checking: 'Buscando actualizaciones...',
        available: 'Nueva versión disponible',
        downloading: 'Descargando actualización...',
        downloaded: 'Actualización descargada',
        error: 'Error en la actualización',
        noUpdates: 'Ya tienes la versión más reciente',
        installNow: 'Instalar Ahora',
        installLater: 'Instalar al Cerrar',
        downloadNow: 'Descargar Ahora',
        moreInfo: 'Más Información',
        cancel: 'Cancelar',
    },
    // Telemetría
    telemetry: {
        enabled: true,
        endpoint: process.env.EXPO_PUBLIC_API_URL || 'https://pos-erp-aio.com',
        path: '/api/telemetry/updates',
    },
};
/**
 * Obtener configuración según el canal de release
 */
function getReleaseChannelConfig(channel) {
    return {
        channel,
        type: exports.updateConfig.releaseChannel[channel],
        allowPrerelease: channel !== 'stable',
        allowDowngrade: false,
    };
}
/**
 * Obtener mensaje localizado
 */
function getMessage(key) {
    return exports.updateConfig.messages[key];
}
