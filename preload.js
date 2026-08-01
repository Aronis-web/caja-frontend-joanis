// Preload script para inyectar polyfills antes de cargar la aplicación
const { contextBridge, ipcRenderer } = require('electron');

// Este script se ejecuta en un contexto aislado antes de que se cargue la página
// Podemos usar contextBridge para exponer APIs seguras al renderer

console.log('Preload script ejecutándose...');

// Diagnóstico: reenviar errores no atrapados del renderer al main process
// para que queden en electron-server.log junto con render-process-gone.
function safeSerialize(value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === 'object' && value !== null) {
    try { return JSON.parse(JSON.stringify(value)); } catch (_) { return String(value); }
  }
  return value;
}

window.addEventListener('error', (event) => {
  try {
    ipcRenderer.send('renderer-error', {
      type: 'window.error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: safeSerialize(event.error),
    });
  } catch (_) {}
});

window.addEventListener('unhandledrejection', (event) => {
  try {
    ipcRenderer.send('renderer-error', {
      type: 'unhandledrejection',
      reason: safeSerialize(event.reason),
    });
  } catch (_) {}
});

// Exponer información del entorno
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  isElectron: true,
  // Función para imprimir PDF
  printPDF: (base64Data, filename) => {
    return ipcRenderer.invoke('print-pdf', { base64Data, filename });
  },
  // Función para imprimir HTML (tickets offline)
  printHTML: (htmlContent, filename) => {
    return ipcRenderer.invoke('print-html', { htmlContent, filename });
  },
  // Versión de la app
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },
  // Actualizaciones automáticas (electron-updater + GitHub Releases)
  // El check/descarga/instalación los maneja el main process vía electron-updater.
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates');
  },
  downloadUpdate: () => {
    return ipcRenderer.invoke('download-update');
  },
  installUpdate: () => {
    return ipcRenderer.invoke('install-update');
  },
  // Escuchar eventos de estado y progreso de descarga
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, status) => callback(status));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },
  removeUpdateListeners: () => {
    ipcRenderer.removeAllListeners('update-status');
    ipcRenderer.removeAllListeners('download-progress');
  },
});

console.log('Preload script completado');
