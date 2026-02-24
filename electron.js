const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const http = require('http');
const mime = require('mime-types');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let server;

// Crear servidor HTTP simple para servir archivos estáticos
function createServer() {
  const webBuildPath = path.join(__dirname, 'web-build');

  server = http.createServer((req, res) => {
    // Decodificar URL para manejar caracteres especiales
    let requestPath = decodeURIComponent(req.url);
    let filePath = path.join(webBuildPath, requestPath === '/' ? 'index.html' : requestPath);

    // Si el archivo no existe, intentar buscar en assets
    if (!fs.existsSync(filePath) && requestPath.includes('.ttf')) {
      filePath = path.join(webBuildPath, 'assets', requestPath);
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error('File not found:', requestPath);
        res.writeHead(404);
        res.end('File not found');
        return;
      }

      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    });
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

app.on('ready', () => {
  if (isDev) {
    createWindow(8081);
  } else {
    createServer();
  }
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
