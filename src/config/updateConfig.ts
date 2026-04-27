/**
 * Update Configuration
 * Centraliza toda la configuración de actualizaciones
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

  // Distribución y publicación
  releaseChannel: {
    stable: 'release',
    beta: 'prerelease',
    edge: 'draft'
  },

  // Configuración de GitHub (ajustar según tu repo)
  github: {
    owner: 'aronis-web', // Cambiar al propietario del repo
    repo: 'caja-frontend-joanis', // Cambiar al nombre del repo
    provider: 'github'
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
    cancel: 'Cancelar'
  },

  // Telemetría
  telemetry: {
    enabled: true,
    endpoint: process.env.EXPO_PUBLIC_API_URL || 'https://pos-erp-aio.com',
    path: '/api/telemetry/updates'
  }
};

/**
 * Obtener configuración según el canal de release
 */
export function getReleaseChannelConfig(channel: 'stable' | 'beta' | 'edge') {
  return {
    channel,
    type: updateConfig.releaseChannel[channel],
    allowPrerelease: channel !== 'stable',
    allowDowngrade: false
  };
}

/**
 * Obtener mensaje localizado
 */
export function getMessage(key: keyof typeof updateConfig.messages): string {
  return updateConfig.messages[key];
}
