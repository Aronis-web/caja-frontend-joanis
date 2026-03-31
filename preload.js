// Preload script para inyectar polyfills antes de cargar la aplicación
const { contextBridge, ipcRenderer } = require('electron');

// Este script se ejecuta en un contexto aislado antes de que se cargue la página
// Podemos usar contextBridge para exponer APIs seguras al renderer

console.log('Preload script ejecutándose...');

// Exponer información del entorno
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  isElectron: true,
  // Función para imprimir PDF
  printPDF: (base64Data, filename) => {
    return ipcRenderer.invoke('print-pdf', { base64Data, filename });
  },
  // Funciones para actualizaciones
  getAppVersion: () => {
    return ipcRenderer.invoke('get-app-version');
  },
  checkForUpdates: () => {
    return ipcRenderer.invoke('check-for-updates');
  },
  downloadUpdate: () => {
    return ipcRenderer.invoke('download-update');
  },
  installUpdate: () => {
    return ipcRenderer.invoke('install-update');
  },
  // Escuchar eventos de actualización
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, status) => callback(status));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  }
});

console.log('Preload script completado');
