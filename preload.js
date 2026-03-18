// Preload script para inyectar polyfills antes de cargar la aplicación
const { contextBridge } = require('electron');

// Este script se ejecuta en un contexto aislado antes de que se cargue la página
// Podemos usar contextBridge para exponer APIs seguras al renderer

console.log('Preload script ejecutándose...');

// Exponer información del entorno
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: process.versions,
  isElectron: true
});

console.log('Preload script completado');
