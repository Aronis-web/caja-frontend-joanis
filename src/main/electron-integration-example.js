/**
 * EJEMPLO DE INTEGRACIÓN - electron.js
 * 
 * Este archivo muestra cómo integrar el nuevo sistema de actualización
 * en el electron.js existente.
 * 
 * Sigue estos pasos:
 * 1. Copia las líneas relevantes al inicio de electron.js
 * 2. Llama a setupUpdateIpcHandlers después de createWindow
 * 3. Elimina los viejos manejadores de actualización
 */

// ============================================================
// AGREGAR ESTAS LÍNEAS AL INICIO DE electron.js
// ============================================================

const { app, BrowserWindow, protocol, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ⭐ NUEVAS LÍNEAS A AGREGAR:
const { autoUpdater } = require('electron-updater');
const { initializeUpdateService } = require('../services/UpdateService');
const { setupUpdateIpcHandlers } = require('./updateHandlers');

// ============================================================
// EN LA FUNCIÓN app.on('ready', ...)
// ============================================================

app.on('ready', () => {
  isPackaged = app.isPackaged;

  console.log('[ELECTRON] 🚀 App ready event triggered');
  console.log('[ELECTRON] 📦 Is packaged:', isPackaged);
  console.log('[ELECTRON] 🔧 Is dev:', isDev);

  // ... código existente ...

  // ⭐ AGREGAR ESTAS LÍNEAS:
  // Inicializar servicio de actualización
  const updateService = initializeUpdateService(app.getVersion());
  global.updateService = updateService; // Guardar en global para acceso posterior

  // Luego de que createWindow se haya llamado y mainWindow esté listo:
  if (mainWindow && mainWindow.webContents) {
    // Configurar handlers de actualización
    const updateManager = setupUpdateIpcHandlers(mainWindow, updateService, isDev);
    global.updateManager = updateManager;
  }

  // ... resto del código ...
});

// ============================================================
// REEMPLAZAR LOS VIEJOS HANDLERS
// ============================================================

// ❌ ELIMINA ESTOS BLOQUES DEL CÓDIGO VIEJO:
// - ipcMain.handle('get-app-version', ...)
// - ipcMain.handle('check-for-updates', ...)
// - ipcMain.handle('download-update', ...)
// - ipcMain.handle('install-update', ...)
// - autoUpdater.on('update-available', ...)
// - autoUpdater.on('update-not-available', ...)
// - autoUpdater.on('error', ...)
// - autoUpdater.on('download-progress', ...)
// - autoUpdater.on('update-downloaded', ...)
// - setupAutoUpdater() función

// ✅ LOS NUEVOS HANDLERS ESTÁN EN updateHandlers.js

// ============================================================
// CONFIGURACIÓN EN electron-builder.yml
// ============================================================

/*
Crear archivo electron-builder.yml en la raíz del proyecto.
Ver electron-builder.yml en este repositorio para la configuración completa.

Lo importante es asegurar que:
- publish.owner = tu usuario de GitHub
- publish.repo = el nombre del repo
- nsis está configurado correctamente
*/

// ============================================================
// SCRIPTS EN package.json
// ============================================================

/*
Agregar estos scripts a package.json:

"version": "node scripts/version-manager.js",
"publish:stable": "node scripts/publish-release.js stable",
"publish:beta": "node scripts/publish-release.js beta",
"publish:edge": "node scripts/publish-release.js edge"

Ver package.json para todos los scripts.
*/

// ============================================================
// LOGS Y ARCHIVOS GENERADOS
// ============================================================

/*
Se crearán automáticamente en:
- %APPDATA%\CajaGrit\update-service.log (logs de actualización)
- %APPDATA%\CajaGrit\version-state.json (estado de versión)
- %APPDATA%\CajaGrit\electron-server.log (logs generales)

Usa:
const { getUpdateService } = require('../services/UpdateService');
const service = getUpdateService();

service.getUpdateStats();
// Retorna: { totalChecks, totalUpdates, updateAttempts, crashesDetected }

service.getTelemetryData();
// Retorna: { stats, recentLogs, version }
*/

// ============================================================
// INTEGRACIÓN CON REACT
// ============================================================

/*
En tus componentes React:

import { useAppUpdater } from '@/hooks/useAppUpdater';
import { UpdateModal } from '@/components/UpdateModal';

export const MyComponent = () => {
  const {
    updateStatus,
    showUpdateModal,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdateModal
  } = useAppUpdater();

  return (
    <>
      <Button onPress={checkForUpdates} title="Buscar Actualizaciones" />
      
      <UpdateModal
        visible={showUpdateModal}
        status={updateStatus.status}
        currentVersion={updateStatus.currentVersion}
        latestVersion={updateStatus.latestVersion}
        downloadProgress={updateStatus.downloadProgress}
        releaseNotes={updateStatus.releaseNotes}
        error={updateStatus.error}
        onDownload={downloadUpdate}
        onInstall={installUpdate}
        onLater={dismissUpdateModal}
        onDismiss={dismissUpdateModal}
      />
    </>
  );
};
*/

// ============================================================
// TESTING DEL SISTEMA
// ============================================================

/*
En desarrollo, desactiva modo dev en el inspector para probar:

// En el archivo de configuración:
if (isDev) {
  // Comentar/descomentar para testing
  // console.log('[ELECTRON] 🎯 Modo desarrollo - creando ventana en puerto 8081');
  // createWindow(8081);
}

O usa:
NODE_ENV=production npm run electron

Para simular errores, modifica UpdateService.ts:
- this.versionState.updateAttempts = 1; // Simular primer intento fallido
- this.versionState.crashDetected = true; // Forzar rollback

Ver UPDATE_SYSTEM.md para workflow completo.
*/
