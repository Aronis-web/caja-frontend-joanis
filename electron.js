const { app, BrowserWindow, protocol, dialog } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const http = require('http');
const mime = require('mime-types');
const { autoUpdater } = require('electron-updater');

const isDev = process.env.NODE_ENV === 'development';
const isPackaged = app.isPackaged;

let mainWindow;
let server;
let logStream;

// Configurar auto-updater
autoUpdater.autoDownload = false; // No descargar automáticamente
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar la app

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
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'CajaGrit - Sistema POS',
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // En desarrollo, carga desde el servidor de Expo
  // En producción, carga desde el servidor HTTP local
  if (isDev) {
    mainWindow.loadURL('http://localhost:8081');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${port}`);
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (server) {
      server.close();
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
      detail: 'La aplicación se reiniciará para instalar la actualización.',
      buttons: ['Reiniciar Ahora', 'Reiniciar Más Tarde'],
      defaultId: 0,
      cancelId: 1
    }).then((result) => {
      if (result.response === 0) {
        // Instalar y reiniciar inmediatamente
        autoUpdater.quitAndInstall(false, true);
      }
      // Si elige "Más tarde", se instalará al cerrar la app (autoInstallOnAppQuit = true)
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
    createWindow(8081);
  } else {
    createServer();
  }

  // Inicializar sistema de actualizaciones automáticas
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (server) {
    server.close();
  }
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
