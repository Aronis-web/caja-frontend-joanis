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

console.log('[ELECTRON] ✅ Módulos básicos cargados');

const isExplicitDev = process.env.NODE_ENV === 'development';
const isDev = isExplicitDev || !app.isPackaged;
let isPackaged = false; // Se inicializará en app.whenReady()

console.log('[ELECTRON] 🎯 isDev:', isDev);

let mainWindow;
let server;
let logStream;


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

// ===== ACTUALIZACIONES DESDE EL SERVIDOR (svc-pos /api/pos/app-updates) =====
// El check lo hace el renderer vía HTTP. Aquí solo descargamos el binario,
// validamos checksum (sha256) opcional y lanzamos el instalador.

let activeDownload = null; // { req, filePath, aborted }
let downloadedUpdatePath = null;

function getUpdatesDir() {
  const dir = path.join(app.getPath('userData'), 'updates');
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); } catch (e) {
    console.error('[UPDATE] No se pudo crear updates dir:', e.message);
  }
  return dir;
}

function safeSendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    try { mainWindow.webContents.send(channel, payload); } catch (e) {
      console.error('[UPDATE] Error enviando IPC', channel, e.message);
    }
  }
}

function inferFilename(downloadUrl, version) {
  try {
    const u = new URL(downloadUrl);
    const base = path.basename(u.pathname);
    if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base;
  } catch (_) {}
  const ext = process.platform === 'win32' ? 'exe' : process.platform === 'darwin' ? 'dmg' : 'AppImage';
  return `CajaGrit-${version || Date.now()}-installer.${ext}`;
}

function parseChecksum(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.includes(':')) {
    const [algo, hex] = trimmed.split(':');
    return { algorithm: algo.toLowerCase(), expected: hex.toLowerCase() };
  }
  return { algorithm: 'sha256', expected: trimmed.toLowerCase() };
}

function httpGet(reqUrl, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(reqUrl); } catch (e) { return reject(e); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(reqUrl, { headers: { 'User-Agent': `CajaGrit/${app.getVersion()}` } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectsLeft <= 0) {
          res.resume();
          return reject(new Error('Demasiados redirects'));
        }
        const next = new URL(res.headers.location, reqUrl).toString();
        res.resume();
        httpGet(next, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (!res.statusCode || res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode || 'desconocido'} descargando ${reqUrl}`));
      }
      resolve({ res, req });
    });
    req.on('error', reject);
  });
}

ipcMain.handle('get-app-version', async () => ({
  version: app.getVersion(),
  name: app.getName(),
}));

ipcMain.handle('download-app-update', async (_event, args = {}) => {
  const { url: downloadUrl, version, expectedChecksum, expectedBytes, filename } = args;
  if (!downloadUrl || typeof downloadUrl !== 'string') {
    return { success: false, error: 'downloadUrl requerido' };
  }
  if (activeDownload) {
    return { success: false, error: 'Ya hay una descarga en curso' };
  }
  if (isDev) {
    console.warn('[UPDATE] Descarga real omitida en desarrollo');
    return { success: false, error: 'Descarga no disponible en modo desarrollo' };
  }

  const finalName = filename || inferFilename(downloadUrl, version);
  const filePath = path.join(getUpdatesDir(), finalName);
  const tmpPath = `${filePath}.part`;

  // Limpiar archivo previo si existe
  try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}

  const checksumSpec = parseChecksum(expectedChecksum);
  const hash = checksumSpec ? crypto.createHash(checksumSpec.algorithm) : null;

  console.log('[UPDATE] ⬇️ Descargando', downloadUrl, '->', filePath);
  safeSendToRenderer('update-status', { status: 'downloading', version });

  try {
    const { res, req } = await httpGet(downloadUrl);
    const total = expectedBytes && Number(expectedBytes) > 0
      ? Number(expectedBytes)
      : Number(res.headers['content-length']) || 0;

    activeDownload = { req, filePath: tmpPath, aborted: false };

    let transferred = 0;
    let lastTick = Date.now();
    let lastBytes = 0;
    const fileStream = fs.createWriteStream(tmpPath);

    await new Promise((resolve, reject) => {
      res.on('data', (chunk) => {
        transferred += chunk.length;
        if (hash) hash.update(chunk);
        const now = Date.now();
        if (now - lastTick >= 250) {
          const bytesPerSecond = ((transferred - lastBytes) * 1000) / (now - lastTick);
          lastTick = now;
          lastBytes = transferred;
          safeSendToRenderer('download-progress', {
            percent: total > 0 ? Math.min(100, (transferred / total) * 100) : 0,
            transferred,
            total,
            bytesPerSecond,
          });
        }
      });
      res.on('error', reject);
      fileStream.on('error', reject);
      fileStream.on('finish', resolve);
      res.pipe(fileStream);
    });

    if (activeDownload && activeDownload.aborted) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
      activeDownload = null;
      return { success: false, error: 'Descarga cancelada' };
    }

    if (checksumSpec && hash) {
      const actual = hash.digest('hex').toLowerCase();
      if (actual !== checksumSpec.expected) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        activeDownload = null;
        const msg = `Checksum ${checksumSpec.algorithm} no coincide (esperado ${checksumSpec.expected}, obtenido ${actual})`;
        console.error('[UPDATE] ❌', msg);
        safeSendToRenderer('update-status', { status: 'error', error: msg });
        return { success: false, error: msg };
      }
    }

    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
    fs.renameSync(tmpPath, filePath);
    downloadedUpdatePath = filePath;
    activeDownload = null;

    safeSendToRenderer('download-progress', {
      percent: 100, transferred, total: total || transferred, bytesPerSecond: 0,
    });
    safeSendToRenderer('update-status', { status: 'downloaded', version, filePath });

    console.log('[UPDATE] ✅ Descarga completada:', filePath);
    return { success: true, filePath };
  } catch (error) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch (_) {}
    activeDownload = null;
    const message = error && error.message ? error.message : String(error);
    console.error('[UPDATE] ❌ Error descargando:', message);
    safeSendToRenderer('update-status', { status: 'error', error: message });
    return { success: false, error: message };
  }
});

ipcMain.handle('cancel-app-update', async () => {
  if (!activeDownload) return { success: false, error: 'No hay descarga activa' };
  try {
    activeDownload.aborted = true;
    if (activeDownload.req && typeof activeDownload.req.destroy === 'function') {
      activeDownload.req.destroy(new Error('Cancelada por el usuario'));
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('install-app-update', async (_event, args = {}) => {
  const filePath = (args && args.filePath) || downloadedUpdatePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return { success: false, error: 'No hay actualización descargada' };
  }
  console.log('[UPDATE] ⚙️ Lanzando instalador:', filePath);
  safeSendToRenderer('update-status', { status: 'installing', filePath });

  try {
    if (server) { try { server.close(); } catch (_) {} }

    if (process.platform === 'win32') {
      const child = spawn(filePath, [], { detached: true, stdio: 'ignore' });
      child.unref();
    } else if (process.platform === 'darwin') {
      await shell.openPath(filePath);
    } else {
      try { fs.chmodSync(filePath, 0o755); } catch (_) {}
      const child = spawn(filePath, [], { detached: true, stdio: 'ignore' });
      child.unref();
    }

    setTimeout(() => {
      try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.removeAllListeners('close'); } catch (_) {}
      app.quit();
    }, 500);

    return { success: true };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error('[UPDATE] ❌ Error lanzando instalador:', message);
    safeSendToRenderer('update-status', { status: 'error', error: message });
    return { success: false, error: message };
  }
});

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
