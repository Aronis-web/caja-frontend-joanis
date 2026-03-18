console.log('[ELECTRON] 📂 Cargando electron.js...');
console.log('[ELECTRON] 🔧 NODE_ENV:', process.env.NODE_ENV);

const { app, BrowserWindow, protocol, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const http = require('http');
const mime = require('mime-types');

console.log('[ELECTRON] ✅ Módulos básicos cargados');

const { autoUpdater } = require('electron-updater');

console.log('[ELECTRON] ✅ electron-updater cargado');

const isDev = process.env.NODE_ENV === 'development';
let isPackaged = false; // Se inicializará en app.whenReady()

console.log('[ELECTRON] 🎯 isDev:', isDev);

let mainWindow;
let server;
let logStream;

// Configurar auto-updater
autoUpdater.autoDownload = false; // No descargar automáticamente
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar la app
autoUpdater.allowDowngrade = false; // No permitir downgrades
autoUpdater.allowPrerelease = false; // No permitir pre-releases

// Configuración adicional para Windows
if (process.platform === 'win32') {
  autoUpdater.forceDevUpdateConfig = false;
}

// Función para buscar archivo recursivamente
function findFile(dir, filename) {
  try {
    if (!fs.existsSync(dir)) {
      console.log('Directory does not exist:', dir);
      return null;
    }

    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);

      try {
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          const found = findFile(filePath, filename);
          if (found) return found;
        } else if (file === filename) {
          console.log('Found matching file:', filePath);
          return filePath;
        }
      } catch (err) {
        console.error('Error accessing file:', filePath, err.message);
        continue;
      }
    }
  } catch (err) {
    console.error('Error reading directory:', dir, err.message);
  }

  return null;
}

// Crear servidor HTTP simple para servir archivos estáticos
function createServer() {
  // Use process.resourcesPath to get the correct path when packaged
  // extraResources copies web-build to process.resourcesPath/web-build
  const webBuildPath = isPackaged
    ? path.join(process.resourcesPath, 'web-build')
    : path.join(__dirname, 'web-build');

  console.log('App is packaged:', isPackaged);
  console.log('__dirname:', __dirname);
  console.log('Resources path:', isPackaged ? process.resourcesPath : 'N/A');
  console.log('Web build path:', webBuildPath);
  console.log('Web build exists:', fs.existsSync(webBuildPath));

  server = http.createServer((req, res) => {
    // Decodificar URL para manejar caracteres especiales
    let requestPath = decodeURIComponent(req.url);

    // Remover query strings
    requestPath = requestPath.split('?')[0];

    let filePath = path.join(webBuildPath, requestPath === '/' ? 'index.html' : requestPath);

    // Log para debug
    console.log('Request:', requestPath);
    console.log('File path:', filePath);

    // Función para servir archivo
    const serveFile = (filePathToServe) => {
      fs.readFile(filePathToServe, (err, data) => {
        if (err) {
          console.error('Error reading file:', err.message);
          res.writeHead(500);
          res.end('Error reading file');
          return;
        }

        const mimeType = mime.lookup(filePathToServe) || 'application/octet-stream';
        console.log('Serving file:', filePathToServe, 'Type:', mimeType);
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000'
        });
        res.end(data);
      });
    };

    // Si el archivo existe, servirlo directamente
    let fileExists = false;
    try {
      fileExists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
      console.log('File exists:', fileExists);
    } catch (err) {
      console.error('Error checking file:', err.message);
    }

    if (fileExists) {
      serveFile(filePath);
      return;
    }

    // Si no existe y es una fuente o imagen, buscar recursivamente
    if (requestPath.includes('.ttf') || requestPath.includes('.woff') || requestPath.includes('.woff2') || requestPath.includes('.png') || requestPath.includes('.jpg')) {
      const filename = path.basename(requestPath);
      console.log('Searching for file:', filename);
      const foundPath = findFile(webBuildPath, filename);

      if (foundPath) {
        console.log('Found file at:', foundPath);
        serveFile(foundPath);
        return;
      } else {
        console.error('File not found after recursive search:', filename);
      }
    }

    // Archivo no encontrado
    console.error('File not found:', requestPath);
    res.writeHead(404);
    res.end('File not found');
  });

  server.listen(0, 'localhost', () => {
    const port = server.address().port;
    console.log(`Local server running on http://localhost:${port}`);
    createWindow(port);
  });
}

function createWindow(port) {
  console.log('[ELECTRON] 🚀 Creando ventana de Electron...');
  console.log('[ELECTRON] 🔧 Modo desarrollo:', isDev);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'CajaGrit - Sistema POS',
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Deshabilitar webSecurity para evitar CORS en desarrollo
      allowRunningInsecureContent: true,
    },
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    show: false,
  });

  console.log('[ELECTRON] ✅ Ventana creada, webSecurity deshabilitado');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // En desarrollo, carga desde el servidor de Expo
  // En producción, carga desde el servidor HTTP local
  if (isDev) {
    // Interceptar y modificar el HTML antes de que se cargue
    const { session } = mainWindow.webContents;

    session.webRequest.onBeforeSendHeaders((details, callback) => {
      // Agregar headers CORS a todas las peticiones
      const requestHeaders = { ...details.requestHeaders };

      // Si es una petición al backend, agregar headers necesarios
      if (details.url.includes('api.app-joanis-backend.com')) {
        console.log('[ELECTRON] 🌐 Interceptando petición al backend:', details.url);
        requestHeaders['Origin'] = 'https://app.app-joanis-backend.com';
      }

      callback({ requestHeaders });
    });

    session.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders || {};

      // Permitir CORS para todas las respuestas
      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
      responseHeaders['Access-Control-Allow-Headers'] = ['*'];
      responseHeaders['Access-Control-Allow-Credentials'] = ['true'];

      // Permitir módulos ES
      if (!details.url.includes('api.app-joanis-backend.com')) {
        responseHeaders['Content-Security-Policy'] = ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval';"];
      }

      callback({ responseHeaders });
    });

    mainWindow.loadURL('http://localhost:8081');
    mainWindow.webContents.openDevTools();

    // Log de todas las solicitudes de red
    mainWindow.webContents.session.webRequest.onBeforeRequest((details, callback) => {
      console.log('[ELECTRON] 🌐 Request:', details.url);
      callback({});
    });

    // Log de errores de consola con más detalle
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const levelStr = ['verbose', 'info', 'warning', 'error'][level] || 'log';
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];

      // Colorear según el nivel
      const prefix = level === 3 ? '❌' : level === 2 ? '⚠️' : level === 1 ? 'ℹ️' : '📝';

      console.log(`[${timestamp}] ${prefix} [BROWSER] ${message}`);
      if (sourceId && line) {
        console.log(`           └─ ${sourceId}:${line}`);
      }
    });

    // Log cuando se carga un script
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[ELECTRON] ✅ Página cargada completamente');
    });

    // Log de errores de carga
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('[ELECTRON] ❌ Error cargando:', errorCode, errorDescription, validatedURL);
    });
  } else {
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    console.log('Ventana principal cerrada');
    mainWindow = null;
    if (server) {
      server.close(() => {
        console.log('Servidor cerrado después de cerrar ventana');
      });
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`Console [${level}]:`, message);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });
}

// ===== SISTEMA DE ACTUALIZACIONES AUTOMÁTICAS =====

// Configurar eventos del auto-updater
function setupAutoUpdater() {
  // Solo verificar actualizaciones en producción
  if (isDev) {
    console.log('Auto-updater deshabilitado en modo desarrollo');
    return;
  }

  console.log('Configurando auto-updater...');

  // Cuando hay una actualización disponible
  autoUpdater.on('update-available', (info) => {
    console.log('Actualización disponible:', info.version);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización Disponible',
      message: `Nueva versión ${info.version} disponible`,
      detail: '¿Deseas descargar e instalar la actualización ahora?',
      buttons: ['Descargar', 'Más tarde'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        // Usuario eligió descargar
        autoUpdater.downloadUpdate();

        // Mostrar progreso de descarga
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Descargando Actualización',
          message: 'La actualización se está descargando en segundo plano...',
          buttons: ['OK']
        });
      }
    });
  });

  // Cuando NO hay actualizaciones disponibles
  autoUpdater.on('update-not-available', (info) => {
    console.log('No hay actualizaciones disponibles');
  });

  // Error al verificar actualizaciones
  autoUpdater.on('error', (err) => {
    console.error('Error en auto-updater:', err);

    // Mostrar error al usuario solo si es un error crítico durante la descarga
    if (err.message && err.message.includes('download')) {
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Error de Actualización',
        message: 'No se pudo descargar la actualización',
        detail: 'Por favor, intenta nuevamente más tarde o descarga la actualización manualmente desde GitHub.',
        buttons: ['OK']
      });
    }
  });

  // Progreso de descarga
  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    console.log(`Descargando actualización: ${percent}%`);
  });

  // Actualización descargada y lista para instalar
  autoUpdater.on('update-downloaded', (info) => {
    console.log('Actualización descargada:', info.version);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización Lista',
      message: 'La actualización ha sido descargada',
      detail: 'La aplicación se cerrará e instalará la actualización automáticamente.',
      buttons: ['Instalar Ahora', 'Instalar al Cerrar'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        console.log('Usuario eligió instalar ahora');

        // Cerrar el servidor HTTP primero
        if (server) {
          server.close(() => {
            console.log('Servidor HTTP cerrado');
          });
        }

        // Cerrar todas las ventanas
        if (mainWindow) {
          mainWindow.removeAllListeners('close');
          mainWindow.close();
        }

        // Esperar un momento para asegurar que todo se cierre
        setTimeout(() => {
          console.log('Instalando actualización...');
          // isSilent = false (mostrar instalador), isForceRunAfter = true (ejecutar después)
          autoUpdater.quitAndInstall(false, true);
        }, 500);
      } else {
        console.log('Usuario eligió instalar al cerrar');
        // Si elige "Más tarde", se instalará al cerrar la app (autoInstallOnAppQuit = true)
      }
    });
  });

  // Verificar actualizaciones al iniciar (después de 3 segundos)
  setTimeout(() => {
    console.log('Verificando actualizaciones...');
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Error al verificar actualizaciones:', err);
    });
  }, 3000);

  // Verificar actualizaciones cada 4 horas
  setInterval(() => {
    console.log('Verificación periódica de actualizaciones...');
    autoUpdater.checkForUpdates().catch(err => {
      console.error('Error al verificar actualizaciones:', err);
    });
  }, 4 * 60 * 60 * 1000); // 4 horas
}

app.on('ready', () => {
  // Inicializar isPackaged ahora que app está listo
  isPackaged = app.isPackaged;

  console.log('[ELECTRON] 🚀 App ready event triggered');
  console.log('[ELECTRON] 📦 Is packaged:', isPackaged);
  console.log('[ELECTRON] 🔧 Is dev:', isDev);

  // Configurar logging después de que la app esté lista
  const logFile = path.join(app.getPath('userData'), 'electron-server.log');
  logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args) => {
    const message = args.join(' ') + '\n';
    logStream.write(`[LOG] ${new Date().toISOString()} - ${message}`);
    originalLog.apply(console, args);
  };

  console.error = (...args) => {
    const message = args.join(' ') + '\n';
    logStream.write(`[ERROR] ${new Date().toISOString()} - ${message}`);
    originalError.apply(console, args);
  };

  console.log('=== Electron App Starting ===');
  console.log('Log file:', logFile);
  console.log('Is packaged:', isPackaged);
  console.log('Is dev:', isDev);

  if (isDev) {
    console.log('[ELECTRON] 🎯 Modo desarrollo - creando ventana en puerto 8081');
    createWindow(8081);
  } else {
    console.log('[ELECTRON] 🎯 Modo producción - creando servidor');
    createServer();
  }

  // Inicializar sistema de actualizaciones automáticas
  setupAutoUpdater();
});

app.on('before-quit', (event) => {
  console.log('Aplicación a punto de cerrarse');

  // Cerrar el servidor HTTP si existe
  if (server) {
    server.close(() => {
      console.log('Servidor HTTP cerrado en before-quit');
    });
  }

  // Cerrar el stream de logs
  if (logStream) {
    logStream.end();
  }
});

app.on('window-all-closed', () => {
  console.log('Todas las ventanas cerradas');

  // Cerrar el servidor HTTP
  if (server) {
    server.close(() => {
      console.log('Servidor HTTP cerrado completamente');
    });
  }

  // Cerrar el stream de logs
  if (logStream) {
    logStream.end(() => {
      console.log('Stream de logs cerrado');
    });
  }

  // En Windows y Linux, cerrar la aplicación
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    if (isDev) {
      createWindow(8081);
    } else {
      createServer();
    }
  }
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
