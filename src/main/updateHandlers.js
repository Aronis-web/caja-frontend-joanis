/**
 * Update Handlers para Electron
 * Integración mejorada de electron-updater con UX mejorada,
 * rollback automático y telemetría
 */

const { autoUpdater, dialog } = require('electron-updater');
const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

class UpdateManager {
  constructor(mainWindow, updateService) {
    this.mainWindow = mainWindow;
    this.updateService = updateService;
    this.updateDownloadProgress = {
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
      startTime: null,
      estimatedTimeRemaining: null
    };
  }

  /**
   * Configurar eventos del auto-updater
   */
  setupAutoUpdater(isDev) {
    if (isDev) {
      console.log('[UPDATE] Auto-updater deshabilitado en modo desarrollo');
      return;
    }

    console.log('[UPDATE] Configurando auto-updater...');

    // Cuando hay una actualización disponible
    autoUpdater.on('update-available', (info) => {
      console.log('[UPDATE] 📦 Actualización disponible:', info.version);
      this.updateService.log('available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes ? 'Disponible' : 'No disponible'
      });

      // Enviar evento al renderer
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('update-status', {
          status: 'available',
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes
        });
      }

      // Dialog con opciones mejoradas
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Actualización Disponible',
        message: `Nueva versión ${info.version} disponible`,
        detail: '¿Deseas descargar e instalar la actualización?',
        buttons: ['Descargar Ahora', 'Actualizar Más Tarde'],
        defaultId: 0,
        cancelId: 1,
        icon: path.join(__dirname, '../../assets/icon.png')
      }).then((result) => {
        if (result.response === 0) {
          this.downloadUpdate();
        }
      });
    });

    // Cuando NO hay actualizaciones disponibles
    autoUpdater.on('update-not-available', (info) => {
      console.log('[UPDATE] ✅ No hay actualizaciones disponibles');
      this.updateService.log('check', {
        status: 'no-updates',
        currentVersion: info.version
      });
    });

    // Error al verificar o descargar actualizaciones
    autoUpdater.on('error', (err) => {
      console.error('[UPDATE] ❌ Error en auto-updater:', err.message);
      this.updateService.log('error', {
        message: err.message,
        stack: err.stack
      });

      // Enviar error al renderer solo si es crítico
      if (err.message && err.message.includes('download')) {
        if (this.mainWindow && this.mainWindow.webContents) {
          this.mainWindow.webContents.send('update-status', {
            status: 'error',
            error: 'Error al descargar la actualización. Intenta más tarde.'
          });
        }
      }
    });

    // Progreso de descarga
    autoUpdater.on('download-progress', (progressObj) => {
      const percent = Math.round(progressObj.percent);
      
      // Calcular tiempo estimado
      if (!this.updateDownloadProgress.startTime) {
        this.updateDownloadProgress.startTime = Date.now();
      }

      const elapsedSeconds = (Date.now() - this.updateDownloadProgress.startTime) / 1000;
      const speed = progressObj.bytesPerSecond || 0;
      const remainingBytes = progressObj.total - progressObj.transferred;
      const estimatedSecondsRemaining = speed > 0 ? remainingBytes / speed : 0;

      this.updateDownloadProgress = {
        percent,
        bytesPerSecond: progressObj.bytesPerSecond,
        transferred: progressObj.transferred,
        total: progressObj.total,
        startTime: this.updateDownloadProgress.startTime,
        estimatedTimeRemaining: Math.ceil(estimatedSecondsRemaining)
      };

      // Log cada 10%
      if (percent % 10 === 0) {
        this.updateService.log('download_progress', {
          percent,
          mbDownloaded: (progressObj.transferred / 1024 / 1024).toFixed(2),
          mbTotal: (progressObj.total / 1024 / 1024).toFixed(2),
          mbPerSecond: (progressObj.bytesPerSecond / 1024 / 1024).toFixed(2),
          estimatedMinutesRemaining: Math.ceil(estimatedSecondsRemaining / 60)
        });
      }

      // Enviar progreso al renderer cada segundo
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('download-progress', {
          percent,
          transferred: progressObj.transferred,
          total: progressObj.total,
          bytesPerSecond: progressObj.bytesPerSecond,
          estimatedTimeRemaining: this.formatTimeRemaining(estimatedSecondsRemaining)
        });
      }
    });

    // Actualización descargada y lista para instalar
    autoUpdater.on('update-downloaded', (info) => {
      console.log('[UPDATE] ✅ Actualización descargada:', info.version);
      this.updateService.log('download_complete', {
        version: info.version
      });

      // Reset progress
      this.updateDownloadProgress = {
        percent: 0,
        bytesPerSecond: 0,
        transferred: 0,
        total: 0,
        startTime: null,
        estimatedTimeRemaining: null
      };

      // Enviar evento al renderer
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('update-status', {
          status: 'downloaded',
          version: info.version
        });
      }

      // Dialog de instalación mejorado
      dialog.showMessageBox(this.mainWindow, {
        type: 'info',
        title: 'Actualización Descargada',
        message: 'La actualización está lista para instalar',
        detail: `Versión ${info.version}\n\n¿Cómo deseas proceder?`,
        buttons: [
          'Instalar Ahora',
          'Actualizar al Cerrar',
          'Más Tarde'
        ],
        defaultId: 0,
        cancelId: 2,
        icon: path.join(__dirname, '../../assets/icon.png')
      }).then((result) => {
        if (result.response === 0) {
          // Instalar ahora
          this.installUpdateNow(info.version);
        } else if (result.response === 1) {
          // Instalar al cerrar (default behavior con autoInstallOnAppQuit = true)
          console.log('[UPDATE] Instalación programada para al cerrar');
          this.updateService.log('install', {
            version: info.version,
            mode: 'on-quit'
          });
        }
        // Si es 2 (Más Tarde), no hacer nada
      });
    });

    // Verificar actualizaciones al iniciar (después de 5 segundos)
    setTimeout(() => {
      console.log('[UPDATE] 🔍 Verificando actualizaciones al iniciar...');
      this.updateService.log('check', { trigger: 'app-start' });
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[UPDATE] Error verificando actualizaciones:', err.message);
      });
    }, 5000);

    // Verificar actualizaciones cada 4 horas
    setInterval(() => {
      console.log('[UPDATE] 🔍 Verificación periódica de actualizaciones...');
      this.updateService.log('check', { trigger: 'periodic' });
      autoUpdater.checkForUpdates().catch(err => {
        console.error('[UPDATE] Error verificando actualizaciones:', err.message);
      });
    }, 4 * 60 * 60 * 1000);
  }

  /**
   * Instalar actualización inmediatamente
   */
  installUpdateNow(version) {
    console.log('[UPDATE] ⚙️ Instalando actualización ahora:', version);
    this.updateService.recordInstallationAttempt(version);

    // Cerrar servidor HTTP si existe
    if (global.server) {
      global.server.close(() => {
        console.log('[UPDATE] Servidor HTTP cerrado');
      });
    }

    // Cerrar todas las ventanas
    if (this.mainWindow) {
      this.mainWindow.removeAllListeners('close');
      this.mainWindow.close();
    }

    // Esperar un momento y luego instalar
    setTimeout(() => {
      console.log('[UPDATE] 🔄 Ejecutando instalador...');
      autoUpdater.quitAndInstall(false, true);
    }, 500);
  }

  /**
   * Descargar actualización manualmente
   */
  downloadUpdate() {
    console.log('[UPDATE] ⬇️ Iniciando descarga manual de actualización...');
    this.updateService.log('download_start', {
      trigger: 'manual'
    });

    // Reset progress
    this.updateDownloadProgress.startTime = Date.now();

    if (this.mainWindow && this.mainWindow.webContents) {
      this.mainWindow.webContents.send('update-status', {
        status: 'downloading',
        message: 'Descargando actualización...'
      });
    }

    autoUpdater.downloadUpdate().catch(err => {
      console.error('[UPDATE] Error descargando:', err.message);
      this.updateService.log('error', {
        phase: 'download',
        message: err.message
      });
    });
  }

  /**
   * Verificar actualizaciones manualmente
   */
  checkForUpdates() {
    console.log('[UPDATE] 🔍 Verificación manual de actualizaciones...');
    this.updateService.log('check', { trigger: 'user' });
    return autoUpdater.checkForUpdates();
  }

  /**
   * Formatear tiempo restante
   */
  formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Casi listo...';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
    return `${Math.ceil(seconds / 3600)}h`;
  }

  /**
   * Obtener estado actual de descarga
   */
  getDownloadProgress() {
    return this.updateDownloadProgress;
  }
}

/**
 * Registrar IPC handlers
 */
function setupUpdateIpcHandlers(mainWindow, updateService, isDev) {
  const updateManager = new UpdateManager(mainWindow, updateService);
  updateManager.setupAutoUpdater(isDev);

  // Obtener versión de la app
  ipcMain.handle('get-app-version', async (event) => {
    const { app } = require('electron');
    return {
      version: app.getVersion(),
      name: app.getName()
    };
  });

  // Verificar actualizaciones manualmente
  ipcMain.handle('check-for-updates', async (event) => {
    if (isDev) {
      return {
        updateAvailable: false,
        currentVersion: require('electron').app.getVersion(),
        message: 'Las actualizaciones no están disponibles en modo desarrollo'
      };
    }

    try {
      const result = await updateManager.checkForUpdates();
      const currentVersion = require('electron').app.getVersion();
      const latestVersion = result?.updateInfo?.version || currentVersion;

      return {
        updateAvailable: latestVersion !== currentVersion,
        currentVersion,
        latestVersion,
        releaseDate: result?.updateInfo?.releaseDate,
        releaseNotes: result?.updateInfo?.releaseNotes
      };
    } catch (error) {
      console.error('[UPDATE] Error verificando actualizaciones:', error.message);
      return {
        updateAvailable: false,
        currentVersion: require('electron').app.getVersion(),
        error: error.message
      };
    }
  });

  // Descargar actualización
  ipcMain.handle('download-update', async (event) => {
    if (isDev) {
      return { success: false, message: 'No disponible en modo desarrollo' };
    }

    try {
      updateManager.downloadUpdate();
      return { success: true, message: 'Descarga iniciada' };
    } catch (error) {
      console.error('[UPDATE] Error descargando:', error);
      return { success: false, error: error.message };
    }
  });

  // Instalar actualización
  ipcMain.handle('install-update', async (event) => {
    const progress = updateManager.getDownloadProgress();
    if (progress.percent >= 100) {
      updateManager.installUpdateNow(require('electron').app.getVersion());
      return { success: true };
    }
    return { success: false, message: 'Actualización no completamente descargada' };
  });

  // Obtener progreso de descarga
  ipcMain.handle('get-download-progress', async (event) => {
    return updateManager.getDownloadProgress();
  });

  // Obtener estadísticas de actualización
  ipcMain.handle('get-update-stats', async (event) => {
    return updateService.getUpdateStats();
  });

  // Obtener telemetría
  ipcMain.handle('get-telemetry-data', async (event) => {
    return updateService.getTelemetryData();
  });

  return updateManager;
}

module.exports = {
  UpdateManager,
  setupUpdateIpcHandlers
};
