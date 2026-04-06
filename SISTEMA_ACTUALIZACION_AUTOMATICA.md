# Sistema de Actualización Automática - CajaGrit

## Índice

1. [Resumen General](#resumen-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Componentes Principales](#componentes-principales)
4. [Flujo de Publicación (Desarrollador)](#flujo-de-publicación-desarrollador)
5. [Flujo de Actualización (Cliente)](#flujo-de-actualización-cliente)
6. [Comunicación IPC (Inter-Process Communication)](#comunicación-ipc)
7. [Proceso de Reinicio e Instalación](#proceso-de-reinicio-e-instalación)
8. [Diagramas de Flujo](#diagramas-de-flujo)
9. [Configuración Técnica](#configuración-técnica)
10. [Troubleshooting](#troubleshooting)

---

## Resumen General

El sistema de actualización automática de CajaGrit utiliza **electron-updater** junto con **GitHub Releases** para distribuir actualizaciones a los usuarios de manera transparente. El sistema permite:

- ✅ Detección automática de nuevas versiones al iniciar la aplicación
- ✅ Verificación periódica cada 4 horas
- ✅ Verificación manual desde la interfaz de usuario
- ✅ Descarga en segundo plano con barra de progreso
- ✅ Instalación automática al cerrar la app o bajo demanda
- ✅ Reinicio automático después de la instalación

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARQUITECTURA GENERAL                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         ┌──────────────┐ │
│  │   DESARROLLADOR  │  ──►    │  GITHUB RELEASES │  ◄──    │   CLIENTE    │ │
│  │                  │  push   │                  │  check  │   (Electron) │ │
│  │  publish-update  │         │  - .exe          │         │              │ │
│  │      .ps1        │         │  - .yml (meta)   │         │  autoUpdater │ │
│  │                  │         │  - blockmap      │         │              │ │
│  └──────────────────┘         └──────────────────┘         └──────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Componentes del Sistema

| Componente | Ubicación | Función |
|------------|-----------|---------|
| `electron-updater` | Proceso Main | Biblioteca que maneja la verificación, descarga e instalación |
| `GitHub Releases` | Nube | Almacena los archivos de instalación y metadatos |
| `electron.js` | Proceso Main | Configura y gestiona los eventos del auto-updater |
| `preload.js` | Bridge | Expone APIs seguras al proceso Renderer |
| `POSDashboardScreen.tsx` | Proceso Renderer | UI para verificar/descargar/instalar actualizaciones |

---

## Componentes Principales

### 1. electron.js (Proceso Principal)

Este archivo contiene toda la lógica del sistema de actualizaciones:

#### Configuración Inicial (líneas 29-38)

```javascript
// Configurar auto-updater
autoUpdater.autoDownload = false;           // No descargar automáticamente
autoUpdater.autoInstallOnAppQuit = true;    // Instalar al cerrar la app
autoUpdater.allowDowngrade = false;          // No permitir downgrades
autoUpdater.allowPrerelease = false;         // No permitir pre-releases

// Configuración adicional para Windows
if (process.platform === 'win32') {
  autoUpdater.forceDevUpdateConfig = false;
}
```

#### Variables de Estado (líneas 577-578)

```javascript
let updateInfo = null;        // Información de la actualización disponible
let updateDownloaded = false; // Flag: actualización descargada y lista
```

#### Handlers IPC para Control Manual

| Handler | Función |
|---------|---------|
| `check-for-updates` | Verifica si hay actualizaciones disponibles |
| `download-update` | Inicia la descarga de la actualización |
| `install-update` | Instala la actualización descargada (reinicia) |
| `get-app-version` | Obtiene la versión actual de la app |

### 2. preload.js (Puente de Comunicación)

Expone las APIs de actualización al proceso Renderer de forma segura:

```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  // Obtener versión
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Control de actualizaciones
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // Escuchar eventos
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, status) => callback(status));
  },
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  }
});
```

### 3. POSDashboardScreen.tsx (Interfaz de Usuario)

La pestaña "Actualizaciones" en el modal de configuración permite:

- Ver la versión actual instalada
- Verificar actualizaciones manualmente
- Descargar actualizaciones
- Ver progreso de descarga
- Reiniciar para instalar

---

## Flujo de Publicación (Desarrollador)

### Diagrama de Publicación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUJO DE PUBLICACIÓN                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. PREPARAR                                                                 │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                            │
│  │  Modificar código / Corregir bugs           │                            │
│  │  Hacer commit y push                        │                            │
│  └─────────────────────────────────────────────┘                            │
│     │                                                                        │
│     ▼                                                                        │
│  2. PUBLICAR                                                                 │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                            │
│  │  .\publish-update.ps1 -Version "X.X.X"      │                            │
│  │                                             │                            │
│  │  Este script:                               │                            │
│  │  a) Actualiza version en package.json       │                            │
│  │  b) Ejecuta: npm run publish                │                            │
│  │     - expo export --platform web            │                            │
│  │     - electron-builder --publish always     │                            │
│  │  c) Sube archivos a GitHub Releases         │                            │
│  └─────────────────────────────────────────────┘                            │
│     │                                                                        │
│     ▼                                                                        │
│  3. GITHUB RELEASES                                                          │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                            │
│  │  Archivos generados en el release:          │                            │
│  │                                             │                            │
│  │  • CajaGrit Setup X.X.X.exe                 │ ← Instalador completo      │
│  │  • CajaGrit Setup X.X.X.exe.blockmap        │ ← Actualización diferencial│
│  │  • latest.yml                               │ ← Metadatos de versión     │
│  └─────────────────────────────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Contenido de latest.yml

```yaml
version: 0.0.49
files:
  - url: CajaGrit Setup 0.0.49.exe
    sha512: <hash_del_archivo>
    size: <tamaño_en_bytes>
path: CajaGrit Setup 0.0.49.exe
sha512: <hash_del_archivo>
releaseDate: '2024-01-15T10:30:00.000Z'
```

### Comando de Publicación

```powershell
# Configurar token (solo primera vez)
$env:GH_TOKEN = "tu_token_github"

# Publicar nueva versión
.\publish-update.ps1 -Version "0.0.50"

# O publicar como borrador (para testing)
.\publish-update.ps1 -Version "0.0.50" -Draft
```

---

## Flujo de Actualización (Cliente)

### Diagrama del Flujo Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     FLUJO DE ACTUALIZACIÓN EN CLIENTE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          1. VERIFICACIÓN                                │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│     ┌──────────────────────┐                                                │
│     │   App se inicia      │                                                │
│     │   (3 segundos delay) │                                                │
│     └──────────┬───────────┘                                                │
│                │                                                             │
│                ▼                                                             │
│     ┌──────────────────────┐     ┌──────────────────────┐                   │
│     │ autoUpdater          │────►│ GitHub Releases      │                   │
│     │ .checkForUpdates()   │◄────│ (latest.yml)         │                   │
│     └──────────┬───────────┘     └──────────────────────┘                   │
│                │                                                             │
│                ▼                                                             │
│     ┌──────────────────────────────────────────────────┐                    │
│     │  Comparar versiones:                             │                    │
│     │  current (package.json) vs latest (latest.yml)   │                    │
│     └──────────────────────┬───────────────────────────┘                    │
│                            │                                                 │
│           ┌────────────────┼────────────────┐                               │
│           │                │                │                               │
│           ▼                ▼                ▼                               │
│     ┌───────────┐    ┌───────────┐    ┌───────────┐                         │
│     │ Igual     │    │ Mayor     │    │ Menor     │                         │
│     │ No update │    │ UPDATE!   │    │ Downgrade │                         │
│     │           │    │ disponible│    │ bloqueado │                         │
│     └───────────┘    └─────┬─────┘    └───────────┘                         │
│                            │                                                 │
│  ┌─────────────────────────▼──────────────────────────────────────────────┐ │
│  │                          2. NOTIFICACIÓN                                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                            │                                                 │
│                            ▼                                                 │
│     ┌──────────────────────────────────────────────────┐                    │
│     │  Evento: 'update-available'                      │                    │
│     │                                                  │                    │
│     │  → Mostrar diálogo al usuario:                   │                    │
│     │    "Nueva versión X.X.X disponible"              │                    │
│     │    [Descargar] [Más tarde]                       │                    │
│     └──────────────────────┬───────────────────────────┘                    │
│                            │                                                 │
│                    Usuario elige "Descargar"                                │
│                            │                                                 │
│  ┌─────────────────────────▼──────────────────────────────────────────────┐ │
│  │                          3. DESCARGA                                    │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                            │                                                 │
│                            ▼                                                 │
│     ┌──────────────────────────────────────────────────┐                    │
│     │  autoUpdater.downloadUpdate()                    │                    │
│     │                                                  │                    │
│     │  → Descarga CajaGrit Setup X.X.X.exe             │                    │
│     │  → Usa blockmap para descarga diferencial        │                    │
│     │  → Almacena en: %LOCALAPPDATA%\CajaGrit-updater\ │                    │
│     └──────────────────────┬───────────────────────────┘                    │
│                            │                                                 │
│                            ▼                                                 │
│     ┌──────────────────────────────────────────────────┐                    │
│     │  Evento: 'download-progress'                     │                    │
│     │                                                  │                    │
│     │  → Enviar progreso al Renderer:                  │                    │
│     │    { percent, bytesPerSecond, transferred, total}│                    │
│     │  → UI muestra barra de progreso                  │                    │
│     └──────────────────────┬───────────────────────────┘                    │
│                            │                                                 │
│                     Descarga completa                                       │
│                            │                                                 │
│  ┌─────────────────────────▼──────────────────────────────────────────────┐ │
│  │                          4. INSTALACIÓN                                 │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                            │                                                 │
│                            ▼                                                 │
│     ┌──────────────────────────────────────────────────┐                    │
│     │  Evento: 'update-downloaded'                     │                    │
│     │  updateDownloaded = true                         │                    │
│     │                                                  │                    │
│     │  → Mostrar diálogo al usuario:                   │                    │
│     │    "Actualización lista para instalar"           │                    │
│     │    [Instalar Ahora] [Instalar al Cerrar]         │                    │
│     └──────────────────────┬───────────────────────────┘                    │
│                            │                                                 │
│                 Usuario elige "Instalar Ahora"                              │
│                            │                                                 │
│                            ▼                                                 │
│     ┌──────────────────────────────────────────────────┐                    │
│     │  autoUpdater.quitAndInstall(false, true)         │                    │
│     │                                                  │                    │
│     │  Parámetros:                                     │                    │
│     │  • isSilent = false (mostrar instalador)         │                    │
│     │  • isForceRunAfter = true (ejecutar después)     │                    │
│     │                                                  │                    │
│     │  Proceso:                                        │                    │
│     │  1. Cerrar servidor HTTP                         │                    │
│     │  2. Cerrar ventana principal                     │                    │
│     │  3. Ejecutar instalador NSIS                     │                    │
│     │  4. Reinstalar la aplicación                     │                    │
│     │  5. Reiniciar automáticamente                    │                    │
│     └──────────────────────────────────────────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Verificación Periódica

```javascript
// Verificar al iniciar (después de 3 segundos)
setTimeout(() => {
  autoUpdater.checkForUpdates();
}, 3000);

// Verificar cada 4 horas
setInterval(() => {
  autoUpdater.checkForUpdates();
}, 4 * 60 * 60 * 1000); // 14,400,000 ms = 4 horas
```

---

## Comunicación IPC

### Diagrama de Comunicación Entre Procesos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMUNICACIÓN IPC                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐  │
│  │  RENDERER       │    │    PRELOAD      │    │      MAIN PROCESS       │  │
│  │  (React/UI)     │    │   (Bridge)      │    │      (electron.js)      │  │
│  └────────┬────────┘    └────────┬────────┘    └────────────┬────────────┘  │
│           │                      │                          │               │
│           │  ═══════════════════════════════════════════════════════════    │
│           │         SOLICITUDES (Renderer → Main)                           │
│           │  ═══════════════════════════════════════════════════════════    │
│           │                      │                          │               │
│           │  checkForUpdates()   │                          │               │
│           │ ───────────────────► │  ipcRenderer.invoke()    │               │
│           │                      │ ────────────────────────►│               │
│           │                      │                          │ autoUpdater   │
│           │                      │                          │ .checkFor     │
│           │                      │  ◄────────────────────── │  Updates()    │
│           │ ◄─────────────────── │  Promise<UpdateInfo>     │               │
│           │  {updateAvailable,   │                          │               │
│           │   latestVersion,     │                          │               │
│           │   currentVersion}    │                          │               │
│           │                      │                          │               │
│           │  ═══════════════════════════════════════════════════════════    │
│           │         EVENTOS (Main → Renderer)                               │
│           │  ═══════════════════════════════════════════════════════════    │
│           │                      │                          │               │
│           │                      │                          │ autoUpdater   │
│           │                      │ ◄────────────────────────│ emit('update- │
│           │                      │ ipcMain sends event      │  downloaded') │
│           │  onUpdateStatus()    │                          │               │
│           │ ◄─────────────────── │                          │               │
│           │  callback({status:   │                          │               │
│           │   'downloaded',      │                          │               │
│           │   version: 'X.X.X'}) │                          │               │
│           │                      │                          │               │
│           │  ═══════════════════════════════════════════════════════════    │
│           │         PROGRESO DE DESCARGA                                    │
│           │  ═══════════════════════════════════════════════════════════    │
│           │                      │                          │               │
│           │                      │ ◄────────────────────────│ 'download-    │
│           │  onDownloadProgress()│ webContents.send()       │  progress'    │
│           │ ◄─────────────────── │                          │               │
│           │  callback({          │                          │               │
│           │   percent: 45,       │                          │               │
│           │   bytesPerSecond,    │                          │               │
│           │   transferred,       │                          │               │
│           │   total})            │                          │               │
│           │                      │                          │               │
└───────────┴──────────────────────┴──────────────────────────┴───────────────┘
```

### APIs Expuestas al Renderer

```typescript
interface ElectronAPI {
  // Información
  platform: string;
  versions: NodeJS.ProcessVersions;
  isElectron: boolean;

  // Actualizaciones
  getAppVersion(): Promise<{version: string, name: string}>;
  checkForUpdates(): Promise<UpdateInfo>;
  downloadUpdate(): Promise<{success: boolean, message?: string, error?: string}>;
  installUpdate(): Promise<{success: boolean, message?: string}>;

  // Event Listeners
  onUpdateStatus(callback: (status: UpdateStatus) => void): void;
  onDownloadProgress(callback: (progress: DownloadProgress) => void): void;
}

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseDate?: string;
  updateDownloaded?: boolean;
  error?: string;
  message?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}
```

---

## Proceso de Reinicio e Instalación

### Secuencia Detallada de quitAndInstall()

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROCESO DE REINICIO E INSTALACIÓN                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PASO 1: PREPARACIÓN                                                         │
│  ───────────────────                                                         │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                            │
│  │  // Cerrar servidor HTTP primero            │                            │
│  │  if (server) {                              │                            │
│  │    server.close(() => {                     │                            │
│  │      console.log('Servidor HTTP cerrado');  │                            │
│  │    });                                      │                            │
│  │  }                                          │                            │
│  └─────────────────────────────────────────────┘                            │
│     │                                                                        │
│     ▼                                                                        │
│  PASO 2: CERRAR VENTANAS                                                     │
│  ───────────────────────                                                     │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                            │
│  │  // Remover listeners para evitar prompts   │                            │
│  │  if (mainWindow) {                          │                            │
│  │    mainWindow.removeAllListeners('close');  │                            │
│  │    mainWindow.close();                      │                            │
│  │  }                                          │                            │
│  └─────────────────────────────────────────────┘                            │
│     │                                                                        │
│     ▼                                                                        │
│  PASO 3: ESPERAR Y EJECUTAR                                                  │
│  ──────────────────────────                                                  │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                            │
│  │  // Esperar 500ms para asegurar cierre      │                            │
│  │  setTimeout(() => {                         │                            │
│  │    autoUpdater.quitAndInstall(false, true); │                            │
│  │  }, 500);                                   │                            │
│  │                                             │                            │
│  │  Parámetros:                                │                            │
│  │  • isSilent = false                         │                            │
│  │    → Mostrar ventana del instalador NSIS   │                            │
│  │  • isForceRunAfter = true                   │                            │
│  │    → Ejecutar app después de instalar      │                            │
│  └─────────────────────────────────────────────┘                            │
│     │                                                                        │
│     ▼                                                                        │
│  PASO 4: INSTALADOR NSIS                                                     │
│  ───────────────────────                                                     │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                            │
│  │  El instalador NSIS:                        │                            │
│  │                                             │                            │
│  │  1. Cierra el proceso de Electron          │                            │
│  │  2. Descomprime nuevos archivos            │                            │
│  │  3. Reemplaza archivos en:                 │                            │
│  │     %LOCALAPPDATA%\Programs\CajaGrit\      │                            │
│  │  4. Actualiza accesos directos             │                            │
│  │  5. Ejecuta la nueva versión               │                            │
│  └─────────────────────────────────────────────┘                            │
│     │                                                                        │
│     ▼                                                                        │
│  PASO 5: REINICIO                                                            │
│  ────────────────                                                            │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────────────────────────┐                            │
│  │  ✅ Nueva versión ejecutándose              │                            │
│  │                                             │                            │
│  │  La app inicia con:                         │                            │
│  │  • Nueva versión en package.json           │                            │
│  │  • Archivos actualizados                   │                            │
│  │  • Configuración preservada                │                            │
│  └─────────────────────────────────────────────┘                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Ubicaciones de Archivos

| Tipo | Ubicación |
|------|-----------|
| Aplicación instalada | `%LOCALAPPDATA%\Programs\CajaGrit\` |
| Archivos de actualización | `%LOCALAPPDATA%\CajaGrit-updater\` |
| Archivos temporales | `%TEMP%\electron-updater\` |
| Logs de Electron | `%APPDATA%\CajaGrit\electron-server.log` |
| Datos de usuario | `%APPDATA%\CajaGrit\` |

---

## Diagramas de Flujo

### Flujo Completo (Vista General)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FLUJO COMPLETO DE ACTUALIZACIÓN                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    DESARROLLADOR                    GITHUB                    CLIENTE        │
│         │                              │                         │           │
│         │                              │                         │           │
│    ┌────┴────┐                         │                    ┌────┴────┐      │
│    │ Cambios │                         │                    │App Init │      │
│    │ en code │                         │                    │         │      │
│    └────┬────┘                         │                    └────┬────┘      │
│         │                              │                         │           │
│         ▼                              │                         │           │
│    ┌────────────┐                      │                         │           │
│    │ publish-   │                      │                         ▼           │
│    │ update.ps1 │                      │                    ┌─────────┐      │
│    │            │                      │                    │ 3 seg   │      │
│    │ -Version   │                      │                    │ delay   │      │
│    │ "X.X.X"    │                      │                    └────┬────┘      │
│    └────┬───────┘                      │                         │           │
│         │                              │                         ▼           │
│         │     npm run publish          │                    ┌─────────┐      │
│         │  ─────────────────────────►  │                    │ Check   │      │
│         │                              │  ◄─────────────────│ Updates │      │
│         │                         ┌────┴────┐               └────┬────┘      │
│         │                         │ Release │                    │           │
│         │                         │ v X.X.X │  ──────────────────┘           │
│         │                         │         │  latest.yml                    │
│         │                         │ • .exe  │                    │           │
│         │                         │ • .yml  │                    ▼           │
│         │                         │ • .map  │               ┌─────────┐      │
│         │                         └─────────┘               │ Update  │      │
│         │                              │                    │ Found?  │      │
│         │                              │                    └────┬────┘      │
│         │                              │                         │           │
│         │                              │              ┌──────────┴──────┐    │
│         │                              │              │ SÍ              │ NO │
│         │                              │              ▼                 ▼    │
│         │                              │         ┌─────────┐      ┌────────┐ │
│         │                              │         │ Dialog  │      │ Silent │ │
│         │                              │         │ ¿Descar-│      │ (nada) │ │
│         │                              │         │  gar?   │      └────────┘ │
│         │                              │         └────┬────┘                 │
│         │                              │              │                      │
│         │                              │    ┌─────────┴─────────┐            │
│         │                              │    │ SÍ                │ NO         │
│         │                              │    ▼                   ▼            │
│         │                              │ ┌─────────┐       ┌────────┐        │
│         │                              │ │Download │       │ Espera │        │
│         │                              │ │ Update  │       │ manual │        │
│         │                              │ └────┬────┘       └────────┘        │
│         │                              │      │                              │
│         │                         .exe │      │                              │
│         │                          ◄───┘      ▼                              │
│         │                              │ ┌──────────┐                        │
│         │                              │ │ Progress │                        │
│         │                              │ │ 0%→100%  │                        │
│         │                              │ └────┬─────┘                        │
│         │                              │      │                              │
│         │                              │      ▼                              │
│         │                              │ ┌──────────┐                        │
│         │                              │ │ Dialog   │                        │
│         │                              │ │ ¿Instal- │                        │
│         │                              │ │  ar?     │                        │
│         │                              │ └────┬─────┘                        │
│         │                              │      │                              │
│         │                              │    ┌─┴─────────────┐                │
│         │                              │    │ AHORA         │ AL CERRAR      │
│         │                              │    ▼               ▼                │
│         │                              │ ┌────────┐    ┌─────────┐           │
│         │                              │ │ Quit & │    │ Flag:   │           │
│         │                              │ │Install │    │ install │           │
│         │                              │ └───┬────┘    │ on quit │           │
│         │                              │     │         └─────────┘           │
│         │                              │     ▼                               │
│         │                              │ ┌────────────┐                      │
│         │                              │ │  NSIS      │                      │
│         │                              │ │  Instaler  │                      │
│         │                              │ └─────┬──────┘                      │
│         │                              │       │                             │
│         │                              │       ▼                             │
│         │                              │ ┌────────────┐                      │
│         │                              │ │ ✅ Nueva   │                      │
│         │                              │ │   versión  │                      │
│         │                              │ │   running  │                      │
│         │                              │ └────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuración Técnica

### electron-builder.json

```json
{
  "appId": "com.caja.grit",
  "productName": "CajaGrit",
  "directories": {
    "output": "dist"
  },
  "win": {
    "target": ["nsis"],
    "signAndEditExecutable": false
  },
  "nsis": {
    "oneClick": true,                        // Instalación con un clic
    "perMachine": false,                     // Instalar por usuario
    "allowElevation": true,                  // Permitir UAC si necesario
    "createDesktopShortcut": true,           // Crear acceso directo
    "createStartMenuShortcut": true,         // Crear en menú inicio
    "differentialPackage": true,             // Actualizaciones diferenciales
    "deleteAppDataOnUninstall": false,       // Preservar datos al desinstalar
    "runAfterFinish": true                   // Ejecutar después de instalar
  },
  "publish": {
    "provider": "github",
    "owner": "Aronis-web",
    "repo": "caja-frontend-joanis",
    "private": false
  }
}
```

### Eventos del Auto-Updater

| Evento | Cuándo se dispara | Acción |
|--------|-------------------|--------|
| `update-available` | Hay nueva versión | Mostrar diálogo, guardar info |
| `update-not-available` | No hay actualizaciones | Log silencioso |
| `error` | Error en verificación/descarga | Mostrar error al usuario |
| `download-progress` | Durante descarga | Enviar progreso a UI |
| `update-downloaded` | Descarga completada | Mostrar diálogo de instalación |

---

## Troubleshooting

### Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| No detecta actualizaciones | Cache de latest.yml | Limpiar `%LOCALAPPDATA%\CajaGrit-updater\` |
| Error de descarga | Conexión o permisos | Verificar firewall/antivirus |
| No se instala | Proceso bloqueado | Cerrar todas las instancias manualmente |
| Error al reiniciar | Permisos de escritura | Ejecutar como administrador |

### Limpiar Cache de Actualizaciones

```powershell
# Limpiar archivos de actualización
Remove-Item -Path "$env:LOCALAPPDATA\CajaGrit-updater" -Recurse -Force
Remove-Item -Path "$env:TEMP\electron-updater" -Recurse -Force
```

### Logs de Diagnóstico

Los logs se encuentran en:
```
%APPDATA%\CajaGrit\electron-server.log
```

Buscar entradas con:
- `[UPDATE]` - Operaciones de actualización
- `[ELECTRON]` - Eventos generales de Electron
- `Error en auto-updater` - Errores del sistema

---

## Resumen de Comandos

### Para el Desarrollador

```powershell
# Publicar nueva versión
.\publish-update.ps1 -Version "0.0.50"

# Publicar como borrador (testing)
.\publish-update.ps1 -Version "0.0.50" -Draft

# Build local sin publicar
npm run dist
```

### Para Testing

```powershell
# Verificar versión instalada
# La versión está en package.json y se muestra en la UI

# Ver releases disponibles
# https://github.com/Aronis-web/caja-frontend-joanis/releases
```

---

**Última actualización:** Enero 2025
**Versión del documento:** 1.0
