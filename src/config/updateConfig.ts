/**
 * Update Configuration
 * Centraliza configuración de actualizaciones server-side (/api/pos/app-updates/*).
 */

export const updateConfig = {
  // Intervalos de chequeo
  checkIntervalOnStartup: 5000, // 5 segundos
  checkIntervalPeriodic: 4 * 60 * 60 * 1000, // 4 horas

  // Tolerancia de crashes
  maxCrashAttempts: 2,
  crashDetectionTimeout: 60000, // 1 minuto

  // Limpieza de logs
  logsRetentionDays: 30,
  logsMaxSize: 1000,

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
 * Obtener mensaje localizado
 */
export function getMessage(key: keyof typeof updateConfig.messages): string {
  return updateConfig.messages[key];
}
