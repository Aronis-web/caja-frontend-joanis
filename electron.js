console.log('[ELECTRON] 📂 Cargando electron.js...');
console.log('[ELECTRON] 🔧 NODE_ENV:', process.env.NODE_ENV);

const electronModule = require('electron');

// Si este archivo se ejecuta con Node (no con Electron), relanzar correctamente con el binario de Electron
if (typeof electronModule === 'string') {
  const { spawnSync } = require('child_process');
  const relaunchResult = spawnSync(electronModule, [__filename, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  });

  process.exit(relaunchResult.status ?? 0);
}

const { app, BrowserWindow, protocol, dialog, ipcMain, shell } = electronModule;
const path = require('path');
const url = require('url');
const fs = require('fs');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');
const mime = require('mime-types');
const os = require('os');
const ptp = require('pdf-to-printer');
const { PDFDocument } = require('pdf-lib');
const { autoUpdater } = require('electron-updater');

console.log('[ELECTRON] ✅ Módulos básicos cargados');

// ===== Configuración de electron-updater (igual que admin-frontend-joanis) =====
autoUpdater.autoDownload = false; // La descarga la dispara el usuario desde el modal
autoUpdater.autoInstallOnAppQuit = true; // Instalar al cerrar si quedó descargada
autoUpdater.allowDowngrade = false;
autoUpdater.allowPrerelease = false;
if (process.platform === 'win32') {
  autoUpdater.forceDevUpdateConfig = false;
}

// Token de GitHub para repos privados (opcional). Inyectar vía GH_TOKEN al empaquetar/ejecutar.
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
if (GITHUB_TOKEN) {
  autoUpdater.requestHeaders = { Authorization: `token ${GITHUB_TOKEN}` };
}

const isExplicitDev = process.env.NODE_ENV === 'development';
const isDev = isExplicitDev || !app.isPackaged;
let isPackaged = false; // Se inicializará en app.whenReady()

console.log('[ELECTRON] 🎯 isDev:', isDev);

let mainWindow;
let server;
let logStream;
let openpayBridgeProcess = null;
let openpayBridgeStopping = false;

// ===== openpay-bridge: proceso .NET local que envuelve el SDK EGlobal =====
// Corre solo en Windows y solo si encontramos el ejecutable ya compilado
// (`openpay-bridge/bin/Release/openpay-bridge.exe` en dev, o
// `resources/openpay-bridge/openpay-bridge.exe` en producción). Si no está,
// asumimos que el operador no usa PinPad OpenPay y no hacemos nada.
function resolveOpenPayBridgeExe() {
  if (process.platform !== 'win32') return null;
  const candidates = isPackaged
    ? [path.join(process.resourcesPath, 'openpay-bridge', 'openpay-bridge.exe')]
    : [
        path.join(__dirname, 'openpay-bridge', 'bin', 'Release', 'openpay-bridge.exe'),
        path.join(__dirname, 'openpay-bridge', 'bin', 'Debug', 'openpay-bridge.exe'),
      ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function probeOpenPayBridgeAlive(cb) {
  const req = http.get('http://localhost:9091/health', { timeout: 800 }, (res) => {
    res.resume();
    cb(res.statusCode === 200);
  });
  req.on('error', () => cb(false));
  req.on('timeout', () => { try { req.destroy(); } catch {} cb(false); });
}

function startOpenPayBridge() {
  try {
    if (openpayBridgeProcess) {
      console.log('[OPENPAY-BRIDGE] ya hay un bridge corriendo (pid=' + openpayBridgeProcess.pid + '); se omite spawn');
      return;
    }
    const exe = resolveOpenPayBridgeExe();
    if (!exe) {
      console.log('[OPENPAY-BRIDGE] ℹ️ openpay-bridge.exe no encontrado; se omite el arranque');
      return;
    }
    // Si ya hay un bridge externo respondiendo en 9091 (por ejemplo `run-sandbox.ps1`
    // corriendo aparte), no spawneamos otro para no chocar en el puerto.
    probeOpenPayBridgeAlive((alive) => {
      if (alive) {
        console.log('[OPENPAY-BRIDGE] ya responde en http://localhost:9091 (proceso externo); se omite spawn');
        return;
      }
      spawnOpenPayBridge(exe);
    });
  } catch (err) {
    console.error('[OPENPAY-BRIDGE] ❌ No se pudo iniciar el bridge:', err.message);
  }
}

function spawnOpenPayBridge(exe) {
  try {
    console.log('[OPENPAY-BRIDGE] 🚀 Iniciando bridge:', exe);
    // cwd = carpeta del exe para que el SDK encuentre pinpad.config / Local.config
    // junto al binario.
    openpayBridgeProcess = spawn(exe, [], {
      cwd: path.dirname(exe),
      env: { ...process.env, OPENPAY_BRIDGE_PORT: '9091' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    openpayBridgeProcess.stdout.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) console.log('[OPENPAY-BRIDGE]', line);
    });
    openpayBridgeProcess.stderr.on('data', (chunk) => {
      const line = chunk.toString().trim();
      if (line) console.error('[OPENPAY-BRIDGE][stderr]', line);
    });

    openpayBridgeProcess.on('exit', (code, signal) => {
      console.log('[OPENPAY-BRIDGE] 🛑 Bridge terminó', { code, signal });
      const wasStopping = openpayBridgeStopping;
      openpayBridgeProcess = null;
      openpayBridgeStopping = false;
      // Auto-reinicio si murió inesperadamente y la app sigue viva.
      if (!wasStopping && !app.isReady()) return;
      if (!wasStopping && mainWindow) {
        console.log('[OPENPAY-BRIDGE] 🔁 Reintentando arranque en 3s...');
        setTimeout(() => startOpenPayBridge(), 3000);
      }
    });

    openpayBridgeProcess.on('error', (err) => {
      console.error('[OPENPAY-BRIDGE] ❌ Error de proceso:', err.message);
    });
  } catch (err) {
    console.error('[OPENPAY-BRIDGE] ❌ No se pudo iniciar el bridge:', err.message);
  }
}

function stopOpenPayBridge() {
  if (!openpayBridgeProcess) return;
  openpayBridgeStopping = true;
  console.log('[OPENPAY-BRIDGE] 🛑 Deteniendo bridge...');
  try {
    // En Windows, kill() manda SIGTERM que HttpListener ignora; usamos
    // taskkill para asegurar el corte.
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(openpayBridgeProcess.pid), '/f', '/t'], {
        windowsHide: true,
      });
    } else {
      openpayBridgeProcess.kill();
    }
  } catch (err) {
    console.error('[OPENPAY-BRIDGE] ⚠️ Error deteniendo bridge:', err.message);
  }
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

  // En desarrollo, carga desde el servidor de Expo a través de un proxy
  // En producción, carga desde el servidor HTTP local
  if (isDev) {
    const zlib = require('zlib');

    // Crear servidor proxy que modifica los bundles para reemplazar import.meta
    const METRO_PORT = 8081;
    const proxyServer = http.createServer((req, res) => {
      const targetUrl = `http://localhost:${METRO_PORT}${req.url}`;

      // Log de peticiones
      const isBundle = req.url && req.url.includes('.bundle');
      if (isBundle) {
        console.log('[PROXY] 📦 Interceptando bundle:', req.url);
      }

      // Copiar headers pero remover Accept-Encoding para bundles (evitar compresión)
      const requestHeaders = { ...req.headers };
      if (isBundle) {
        delete requestHeaders['accept-encoding'];
        requestHeaders['accept-encoding'] = 'identity'; // Sin compresión
      }

      // Hacer petición a Metro
      const proxyReq = http.request(targetUrl, {
        method: req.method,
        headers: requestHeaders,
      }, (proxyRes) => {
        // Si es un bundle, acumular el contenido y modificarlo
        if (isBundle) {
          const chunks = [];
          const contentEncoding = proxyRes.headers['content-encoding'];

          proxyRes.on('data', (chunk) => chunks.push(chunk));
          proxyRes.on('end', () => {
            let buffer = Buffer.concat(chunks);

            // Descomprimir si es necesario
            const decompress = () => {
              return new Promise((resolve, reject) => {
                if (contentEncoding === 'gzip') {
                  console.log('[PROXY] 📦 Descomprimiendo gzip...');
                  zlib.gunzip(buffer, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                  });
                } else if (contentEncoding === 'deflate') {
                  console.log('[PROXY] 📦 Descomprimiendo deflate...');
                  zlib.inflate(buffer, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                  });
                } else if (contentEncoding === 'br') {
                  console.log('[PROXY] 📦 Descomprimiendo brotli...');
                  zlib.brotliDecompress(buffer, (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                  });
                } else {
                  resolve(buffer);
                }
              });
            };

            decompress()
              .then((decompressedBuffer) => {
                let body = decompressedBuffer.toString('utf8');

                // Si Metro devuelve un error (status 500), mostrar el error
                if (proxyRes.statusCode >= 400) {
                  console.error('[PROXY] ❌ Metro devolvió error:', proxyRes.statusCode);
                  try {
                    const errorJson = JSON.parse(body);
                    console.error('[PROXY] ❌ Error de Metro:', JSON.stringify(errorJson, null, 2));
                  } catch (e) {
                    console.error('[PROXY] ❌ Respuesta de error:', body.substring(0, 500));
                  }
                }

                // Reemplazar import.meta con polyfill
                if (body.includes('import.meta')) {
                  console.log('[PROXY] ⚠️ Reemplazando import.meta en bundle...');
                  body = body.replace(/import\.meta/g, '(window.__importMeta||{url:window.location.href,env:{},hot:null})');
                  console.log('[PROXY] ✅ import.meta reemplazado');
                }

                // Copiar headers pero remover Content-Encoding (enviamos sin comprimir)
                const headers = { ...proxyRes.headers };
                delete headers['content-encoding'];
                delete headers['content-length'];
                headers['content-length'] = Buffer.byteLength(body);

                res.writeHead(proxyRes.statusCode, headers);
                res.end(body);
              })
              .catch((err) => {
                console.error('[PROXY] ❌ Error descomprimiendo:', err.message);
                // Intentar enviar sin modificar
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                res.end(buffer);
              });
          });
        } else {
          // Para otros archivos, hacer streaming directo
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res);
        }
      });

      proxyReq.on('error', (err) => {
        console.error('[PROXY] ❌ Error:', err.message);
        res.writeHead(502);
        res.end('Proxy error: ' + err.message);
      });

      // Si hay body en la petición, enviarlo
      req.pipe(proxyReq);
    });

    // Iniciar el proxy en un puerto diferente
    const PROXY_PORT = 8082;
    proxyServer.listen(PROXY_PORT, 'localhost', () => {
      console.log(`[PROXY] 🚀 Proxy server running on http://localhost:${PROXY_PORT}`);
      console.log(`[PROXY] 🔄 Proxying requests to Metro on port ${METRO_PORT}`);
    });

    // Interceptar y modificar headers
    const { session } = mainWindow.webContents;

    session.webRequest.onBeforeSendHeaders((details, callback) => {
      const requestHeaders = { ...details.requestHeaders };

      try {
        const urlObj = new URL(details.url);
        if (urlObj.hostname === 'pos-erp-aio.com') {
          console.log('[ELECTRON] 🌐 Interceptando petición al backend:', details.url);
          requestHeaders['Origin'] = 'https://pos-erp-aio.com';
        }
      } catch (e) {
        // URL inválida, ignorar
      }

      callback({ requestHeaders });
    });

    session.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = details.responseHeaders || {};

      responseHeaders['Access-Control-Allow-Origin'] = ['*'];
      responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
      responseHeaders['Access-Control-Allow-Headers'] = ['*'];
      responseHeaders['Access-Control-Allow-Credentials'] = ['true'];

      if (!details.url.includes('pos-erp-aio.com')) {
        responseHeaders['Content-Security-Policy'] = ["default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval';"];
      }

      callback({ responseHeaders });
    });

    // Cargar desde el proxy en lugar de Metro directamente
    mainWindow.loadURL(`http://localhost:${PROXY_PORT}`);
    mainWindow.webContents.openDevTools();

    // Log de errores de consola
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      const prefix = level === 3 ? '❌' : level === 2 ? '⚠️' : level === 1 ? 'ℹ️' : '📝';

      console.log(`[${timestamp}] ${prefix} [BROWSER] ${message}`);
    });

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('[ELECTRON] ✅ Página cargada completamente');
    });

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

  // Diagnóstico: detectar caídas del proceso renderer (causa común de "se cierra de la nada")
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('[ELECTRON] 💥 render-process-gone:', JSON.stringify(details));
    try {
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox(
          'La aplicación dejó de responder',
          `El proceso del renderer terminó inesperadamente.\n` +
          `Razón: ${details.reason} (exitCode=${details.exitCode}).\n` +
          `Reinicia la aplicación. Si el problema persiste, revisa el log en %APPDATA%/erp-aio-electron/electron-server.log`
        );
      }
    } catch (e) {
      console.error('[ELECTRON] Error mostrando aviso de render-process-gone:', e.message);
    }
  });

  mainWindow.on('unresponsive', () => {
    console.error('[ELECTRON] ⚠️ Ventana no responde (unresponsive)');
  });

  mainWindow.on('responsive', () => {
    console.log('[ELECTRON] ✅ Ventana volvió a responder');
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

// ===== MANEJADOR DE IMPRESIÓN DE PDF =====

ipcMain.handle('print-pdf', async (event, { base64Data, filename }) => {
  try {
    console.log('[ELECTRON] 🖨️ Iniciando impresión automática de PDF:', filename);

    // Obtener la carpeta de Descargas del usuario (guardar copia de respaldo)
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, filename);

    console.log('[ELECTRON] 📂 Guardando PDF original en:', filePath);

    // Convertir base64 a buffer y guardar
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    console.log('[ELECTRON] ✅ PDF original guardado correctamente');

    // Modificar el PDF para reducir ancho al 90% (reducir ~8mm total)
    console.log('[ELECTRON] 🔧 Modificando PDF para reducir ancho al 90%...');

    try {
      // Cargar el PDF
      const pdfDoc = await PDFDocument.load(buffer);
      const pages = pdfDoc.getPages();

      // Escalar solo el ancho al 90% (reducir ~8mm)
      const scaleFactorX = 0.90; // Reducir ancho
      const scaleFactorY = 1.0;  // Mantener altura completa

      pages.forEach(page => {
        const { width, height } = page.getSize();
        const newWidth = width * scaleFactorX;

        // Reducir solo el ancho de la página, mantener altura
        page.setSize(newWidth, height);

        // Escalar el contenido solo horizontalmente
        page.scaleContent(scaleFactorX, scaleFactorY);

        // No centrar verticalmente, solo ajustar horizontalmente
        const xOffset = 0; // Sin offset horizontal
        page.translateContent(xOffset, 0);
      });

      // Guardar el PDF modificado
      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedFilePath = path.join(downloadsPath, `scaled_${filename}`);
      fs.writeFileSync(modifiedFilePath, modifiedPdfBytes);

      console.log('[ELECTRON] ✅ PDF modificado guardado en:', modifiedFilePath);

      // Usar el PDF modificado para imprimir
      const printFilePath = modifiedFilePath;

      // Obtener lista de impresoras
      const printers = await ptp.getPrinters();
      console.log('[ELECTRON] 🖨️ Impresoras disponibles:', printers.map(p => p.name).join(', '));

      // Buscar impresora térmica
      const thermalPrinter = printers.find(p =>
        p.name.toLowerCase().includes('80') ||
        p.name.toLowerCase().includes('thermal') ||
        p.name.toLowerCase().includes('pos') ||
        p.name.toLowerCase().includes('ticket')
      );

      // Opciones de impresión
      const printOptions = {
        scale: 'noscale', // Sin escala adicional, ya escalamos el PDF
        monochrome: true,
        orientation: 'portrait',
      };

      if (thermalPrinter) {
        console.log('[ELECTRON] 🎯 Impresora térmica detectada:', thermalPrinter.name);
        printOptions.printer = thermalPrinter.name;
      } else {
        console.log('[ELECTRON] ⚠️ No se detectó impresora térmica específica, usando predeterminada');
      }

      console.log('[ELECTRON] 📋 Opciones de impresión:', JSON.stringify(printOptions));

      // Imprimir el PDF escalado
      await ptp.print(printFilePath, printOptions);

      console.log('[ELECTRON] ✅ PDF enviado a la impresora térmica exitosamente');

      // Limpiar archivo temporal
      try {
        fs.unlinkSync(modifiedFilePath);
        console.log('[ELECTRON] 🗑️ Archivo temporal eliminado');
      } catch (cleanupError) {
        console.log('[ELECTRON] ⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
      }

      return {
        success: true,
        downloaded: true,
        printed: true,
        path: filePath
      };
    } catch (pdfError) {
      console.error('[ELECTRON] ❌ Error al modificar PDF:', pdfError);
      console.log('[ELECTRON] 🔄 Imprimiendo PDF original sin modificar...');

      // Si falla la modificación, imprimir el original
      await ptp.print(filePath, { scale: 'noscale', monochrome: true });

      return {
        success: true,
        downloaded: true,
        printed: true,
        path: filePath
      };
    }
  } catch (error) {
    console.error('[ELECTRON] ❌ Error en print-pdf:', error);
    return {
      success: false,
      error: error.message,
      details: error.toString()
    };
  }
});

// ===== HANDLER PARA IMPRIMIR HTML (TICKETS OFFLINE) =====

ipcMain.handle('print-html', async (event, { htmlContent, filename }) => {
  try {
    console.log('[ELECTRON] 🖨️ Iniciando impresión de HTML:', filename);

    // Guardar HTML a archivo temporal (más confiable que data URL)
    const tempDir = app.getPath('temp');
    const htmlFilePath = path.join(tempDir, `ticket_${Date.now()}.html`);
    fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
    console.log('[ELECTRON] 📄 HTML guardado temporalmente en:', htmlFilePath);

    // Crear una ventana para renderizar el HTML
    const printWindow = new BrowserWindow({
      width: 400,
      height: 1200,
      show: false, // Cambiar a true para debug visual
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        allowRunningInsecureContent: true,
      }
    });

    // Cargar el HTML desde archivo
    console.log('[ELECTRON] 📄 Cargando HTML en ventana...');
    await printWindow.loadFile(htmlFilePath);

    // Esperar a que las imágenes se carguen
    console.log('[ELECTRON] ⏳ Esperando que las imágenes se carguen...');
    const imageInfo = await printWindow.webContents.executeJavaScript(`
      new Promise((resolve) => {
        const images = document.querySelectorAll('img');
        const bodyText = document.body ? document.body.innerText.substring(0, 200) : 'NO BODY';

        if (images.length === 0) {
          resolve({ count: 0, loaded: 0, bodyPreview: bodyText });
          return;
        }

        let loaded = 0;
        let errors = 0;
        const checkComplete = (isError) => {
          if (isError) errors++;
          loaded++;
          if (loaded >= images.length) {
            resolve({ count: images.length, loaded: loaded - errors, errors, bodyPreview: bodyText });
          }
        };

        images.forEach(img => {
          if (img.complete && img.naturalHeight !== 0) {
            checkComplete(false);
          } else if (img.complete) {
            checkComplete(true); // Loaded but broken
          } else {
            img.onload = () => checkComplete(false);
            img.onerror = () => checkComplete(true);
          }
        });

        // Timeout de seguridad
        setTimeout(() => resolve({ count: images.length, loaded, errors, timeout: true, bodyPreview: bodyText }), 5000);
      });
    `);

    console.log('[ELECTRON] 📊 Info de contenido:', JSON.stringify(imageInfo));

    // Pequeña pausa adicional para renderizado completo
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('[ELECTRON] 📄 HTML y recursos cargados, imprimiendo...');

    // Obtener lista de impresoras para encontrar la térmica
    const printers = printWindow.webContents.getPrintersAsync
      ? await printWindow.webContents.getPrintersAsync()
      : printWindow.webContents.getPrinters();

    console.log('[ELECTRON] 🖨️ Impresoras disponibles:', printers.map(p => p.name).join(', '));

    // Buscar impresora térmica
    const thermalPrinter = printers.find(p =>
      p.name.toLowerCase().includes('80') ||
      p.name.toLowerCase().includes('thermal') ||
      p.name.toLowerCase().includes('pos') ||
      p.name.toLowerCase().includes('ticket')
    );

    const printerName = thermalPrinter ? thermalPrinter.name : '';

    if (thermalPrinter) {
      console.log('[ELECTRON] 🎯 Impresora térmica detectada:', thermalPrinter.name);
    } else {
      console.log('[ELECTRON] ⚠️ No se detectó impresora térmica específica, usando predeterminada');
    }

    // Imprimir directamente usando webContents.print()
    console.log('[ELECTRON] 🖨️ Enviando a impresora...');

    const printResult = await new Promise((resolve) => {
      printWindow.webContents.print({
        silent: true, // Imprimir sin diálogo
        printBackground: true,
        deviceName: printerName,
        margins: {
          marginType: 'none'
        },
        pageSize: {
          width: 80000, // 80mm en microns
          height: 297000 // Altura automática
        }
      }, (success, failureReason) => {
        resolve({ success, failureReason });
      });
    });

    // Cerrar la ventana oculta
    printWindow.close();

    // Limpiar archivo temporal
    try {
      fs.unlinkSync(htmlFilePath);
      console.log('[ELECTRON] 🗑️ Archivo temporal eliminado');
    } catch (cleanupError) {
      console.log('[ELECTRON] ⚠️ No se pudo eliminar archivo temporal:', cleanupError.message);
    }

    if (printResult.success) {
      console.log('[ELECTRON] ✅ Ticket offline impreso exitosamente');
      return {
        success: true,
        printed: true
      };
    } else {
      console.error('[ELECTRON] ❌ Error al imprimir:', printResult.failureReason);
      return {
        success: false,
        error: printResult.failureReason || 'Error desconocido al imprimir'
      };
    }
  } catch (error) {
    console.error('[ELECTRON] ❌ Error en print-html:', error);
    return {
      success: false,
      error: error.message,
      details: error.toString()
    };
  }
});

// ===== ACTUALIZACIONES AUTOMÁTICAS (electron-updater + GitHub Releases) =====
// Igual que admin-frontend-joanis: electron-updater lee latest.yml desde GitHub
// Releases y maneja check/descarga/instalación. El renderer solo pinta el modal
// a partir de los eventos reenviados por IPC (update-status / download-progress).

let updateInfo = null;
let updateDownloaded = false;

function safeSendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try { mainWindow.webContents.send(channel, payload); } catch (e) {
      console.error('[UPDATE] Error enviando IPC', channel, e.message);
    }
  }
}

function isNoReleasesError(message) {
  return !!message && (
    message.includes('404') ||
    message.includes('Not Found') ||
    message.includes('no published releases')
  );
}

function isNetworkError(message) {
  return !!message && (
    message.includes('net::') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT')
  );
}

ipcMain.handle('get-app-version', async () => ({
  version: app.getVersion(),
  name: app.getName(),
}));

// Verificar actualizaciones manualmente (lo invoca el modal del renderer)
ipcMain.handle('check-for-updates', async () => {
  if (isDev) {
    return {
      updateAvailable: false,
      currentVersion: app.getVersion(),
      message: 'Las actualizaciones no están disponibles en modo desarrollo',
    };
  }

  try {
    console.log('[UPDATE] Verificando actualizaciones...');
    const result = await autoUpdater.checkForUpdates();

    if (result && result.updateInfo) {
      updateInfo = result.updateInfo;
      const currentVersion = app.getVersion();
      const latestVersion = result.updateInfo.version;
      return {
        updateAvailable: latestVersion !== currentVersion,
        currentVersion,
        latestVersion,
        releaseDate: result.updateInfo.releaseDate,
        releaseNotes:
          typeof result.updateInfo.releaseNotes === 'string'
            ? result.updateInfo.releaseNotes
            : undefined,
        updateDownloaded,
      };
    }

    return { updateAvailable: false, currentVersion: app.getVersion() };
  } catch (error) {
    const message = (error && error.message) || String(error);
    console.error('[UPDATE] Error al verificar actualizaciones:', message);
    if (isNoReleasesError(message)) {
      return {
        updateAvailable: false,
        currentVersion: app.getVersion(),
        message: 'No hay releases publicados aún. ¡Ya tienes la versión más reciente!',
      };
    }
    if (isNetworkError(message)) {
      return {
        updateAvailable: false,
        currentVersion: app.getVersion(),
        message: 'No se pudo conectar al servidor de actualizaciones.',
      };
    }
    return { updateAvailable: false, currentVersion: app.getVersion(), error: message };
  }
});

// Descargar actualización (electron-updater)
ipcMain.handle('download-update', async () => {
  if (isDev) {
    return { success: false, message: 'No disponible en modo desarrollo' };
  }
  try {
    console.log('[UPDATE] Iniciando descarga de actualización...');
    safeSendToRenderer('update-status', { status: 'downloading' });
    await autoUpdater.downloadUpdate();
    return { success: true, message: 'Descarga iniciada' };
  } catch (error) {
    const message = (error && error.message) || String(error);
    console.error('[UPDATE] Error al descargar:', message);
    safeSendToRenderer('update-status', { status: 'error', error: message });
    return { success: false, error: message };
  }
});

// Instalar actualización descargada (electron-updater hace quitAndInstall)
ipcMain.handle('install-update', async () => {
  if (!updateDownloaded) {
    return { success: false, message: 'No hay actualización descargada' };
  }
  console.log('[UPDATE] Instalando actualización...');
  safeSendToRenderer('update-status', { status: 'installing' });
  // isSilent=false (mostrar progreso del NSIS), isForceRunAfter=true (reabrir app)
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return { success: true };
});

// Configurar eventos del auto-updater y arrancar verificación periódica
function setupAutoUpdater() {
  if (isDev) {
    console.log('[UPDATE] Auto-updater deshabilitado en modo desarrollo');
    return;
  }

  console.log('[UPDATE] Configurando auto-updater...');

  autoUpdater.on('update-available', (info) => {
    console.log('[UPDATE] Actualización disponible:', info.version);
    updateInfo = info;
    safeSendToRenderer('update-status', {
      status: 'available',
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[UPDATE] No hay actualizaciones disponibles');
    safeSendToRenderer('update-status', { status: 'up-to-date' });
  });

  autoUpdater.on('error', (err) => {
    const message = (err && err.message) || String(err);
    console.error('[UPDATE] Error en auto-updater:', message);
    // 404 / sin releases publicados → tratar como "al día" (no es un error real)
    if (isNoReleasesError(message)) {
      safeSendToRenderer('update-status', { status: 'up-to-date' });
      return;
    }
    // Errores de conexión: ignorar silenciosamente
    if (isNetworkError(message)) {
      return;
    }
    safeSendToRenderer('update-status', { status: 'error', error: message });
  });

  autoUpdater.on('download-progress', (progress) => {
    safeSendToRenderer('download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[UPDATE] Actualización descargada:', info.version);
    updateDownloaded = true;
    safeSendToRenderer('update-status', { status: 'downloaded', version: info.version });
  });

  // Verificar al iniciar (tras 5s) y luego cada 4 horas
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[UPDATE] Error en verificación inicial:', err.message);
    });
  }, 5000);

  setInterval(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[UPDATE] Error en verificación periódica:', err.message);
    });
  }, 4 * 60 * 60 * 1000);
}

app.on('ready', () => {
  // Inicializar isPackaged ahora que app está listo
  isPackaged = app.isPackaged;

  console.log('[ELECTRON] 🚀 App ready event triggered');
  console.log('[ELECTRON] 📦 Is packaged:', isPackaged);
  console.log('[ELECTRON] 🔧 Is dev:', isDev);

  // Configurar logging después de que la app esté lista
  const logFile = path.join(app.getPath('userData'), 'electron-server.log');

  // Rotación básica del log: si supera 5MB, mover a .1 antes de abrir
  try {
    const MAX_LOG_BYTES = 5 * 1024 * 1024;
    if (fs.existsSync(logFile)) {
      const { size } = fs.statSync(logFile);
      if (size > MAX_LOG_BYTES) {
        const rotated = logFile + '.1';
        try { if (fs.existsSync(rotated)) fs.unlinkSync(rotated); } catch (_) {}
        fs.renameSync(logFile, rotated);
      }
    }
  } catch (rotateErr) {
    console.error('[ELECTRON] ⚠️ No se pudo rotar el log:', rotateErr.message);
  }

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
    console.log('[ELECTRON] 🔎 isExplicitDev:', isExplicitDev, '| app.isPackaged:', app.isPackaged);
    createWindow(8081);
  } else {
    console.log('[ELECTRON] 🎯 Modo producción - creando servidor');
    createServer();
  }

  // Inicializar el sistema de actualizaciones (electron-updater + GitHub Releases)
  setupAutoUpdater();

  // Arrancar el bridge de OpenPay (proceso .NET local). Silencioso si el
  // binario no está compilado / instalado (comercios sin PinPad OpenPay).
  startOpenPayBridge();
});

app.on('before-quit', (event) => {
  console.log('Aplicación a punto de cerrarse');

  // Detener el bridge OpenPay antes de cerrar Electron.
  stopOpenPayBridge();

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
  console.error('Uncaught Exception:', error && error.stack ? error.stack : error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason && reason.stack ? reason.stack : reason);
});

// Diagnóstico: cualquier child-process (GPU, utility, etc.) que caiga queda registrado
app.on('child-process-gone', (event, details) => {
  console.error('[ELECTRON] 💥 child-process-gone:', JSON.stringify(details));
});

// Recibir reportes de errores desde el renderer (preload los reenvía vía IPC)
ipcMain.on('renderer-error', (_event, payload) => {
  try {
    console.error('[RENDERER] ' + (payload && payload.type ? payload.type : 'error') + ':',
      typeof payload === 'object' ? JSON.stringify(payload) : String(payload));
  } catch (e) {
    console.error('[RENDERER] error (no serializable)');
  }
});
