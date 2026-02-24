const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const http = require('http');
const mime = require('mime-types');

const isDev = process.env.NODE_ENV === 'development';
const isPackaged = app.isPackaged;

let mainWindow;
let server;

// Función para buscar archivo recursivamente
function findFile(dir, filename) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      const found = findFile(filePath, filename);
      if (found) return found;
    } else if (file === filename) {
      return filePath;
    }
  }

  return null;
}

// Crear servidor HTTP simple para servir archivos estáticos
function createServer() {
  // En producción empaquetada, web-build está en app.asar.unpacked
  let webBuildPath;
  if (isPackaged) {
    // Cuando está empaquetado, los archivos desempaquetados están en app.asar.unpacked
    const appPath = app.getAppPath();
    webBuildPath = appPath.replace('app.asar', 'app.asar.unpacked') + '/web-build';
  } else {
    webBuildPath = path.join(__dirname, 'web-build');
  }

  console.log('App is packaged:', isPackaged);
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
