# Sistema de Actualización - CajaGrit

Documentación del sistema de actualizaciones automáticas de la app de escritorio.

> **Nota:** Desde la migración a `electron-updater`, CajaGrit usa el mismo esquema que
> `admin-frontend-joanis`: **electron-updater + GitHub Releases**. Ya **no** depende del
> endpoint HTTP `/api/app-updates` para el escritorio (eso quedó solo como ruta de
> respaldo para Android).

## 📋 Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Flujo de actualización](#flujo-de-actualización)
3. [Configuración](#configuración)
4. [Uso del sistema](#uso-del-sistema)
5. [Workflow de releases](#workflow-de-releases)
6. [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura

El sistema vive en cuatro piezas, sin servicios externos ni telemetría:

#### 1. `electron.js` (main process)
Configura y orquesta **`electron-updater`**:
- `setupAutoUpdater()` registra los eventos (`update-available`, `download-progress`,
  `update-downloaded`, `error`) y los reenvía al renderer por IPC.
- Handlers IPC: `get-app-version`, `check-for-updates`, `download-update`, `install-update`.
- Verifica al iniciar (5 s) y luego cada 4 horas.
- `autoDownload = false` (la descarga la dispara el usuario desde el modal) y
  `autoInstallOnAppQuit = true` (si quedó descargada, se instala al cerrar).
- Un `404`/"no published releases" se trata como **"estás al día"**, no como error.

#### 2. `preload.js`
Expone el API seguro en `window.electronAPI`:
`checkForUpdates()`, `downloadUpdate()`, `installUpdate()`, `getAppVersion()`,
`onUpdateStatus()`, `onDownloadProgress()`, `removeUpdateListeners()`.

#### 3. `src/hooks/useAppUpdater.ts`
Hook React que maneja el estado de actualización:
- **Electron:** usa los handlers IPC de `electron-updater` y reacciona a sus eventos.
- **Android:** check HTTP a svc-admin (`/api/app-updates`) y abre el APK con `Linking`.
- **iOS/Web:** solo informativo.

#### 4. `src/components/UpdateModal.tsx`
UI del modal: estados `checking | available | downloading | downloaded | error`,
barra de progreso, changelog y botones de descarga/instalación.

#### Configuración de build
`electron-builder.yml` (config activa) con el provider de publicación:

```yaml
publish:
  provider: github
  owner: Aronis-web
  repo: caja-frontend-joanis
```

Al compilar, electron-builder genera `latest.yml` junto al instalador NSIS; ese archivo
es el que `electron-updater` lee desde GitHub Releases para detectar nuevas versiones.

---

## 🔄 Flujo de actualización

```
1. La app arranca → setupAutoUpdater() verifica a los 5 s y cada 4 h.
2. electron-updater descarga latest.yml del último GitHub Release.
3. Si latest.yml.version > versión instalada → evento 'update-available'.
4. El main reenvía 'update-status: available' → el hook abre el UpdateModal.
5. El usuario pulsa "Descargar" → download-update → autoUpdater.downloadUpdate().
6. 'download-progress' alimenta la barra; al terminar → 'update-downloaded'.
7. El usuario pulsa "Instalar" → install-update → autoUpdater.quitAndInstall().
8. electron-updater valida sha512, cierra la app, corre el NSIS y la reabre.
```

La verificación de **checksum (sha512)** y la sustitución del binario las hace
`electron-updater`; no hay descarga ni validación manual en el código de la app.

---

## ⚙️ Configuración

### 1. Provider de releases (`electron-builder.yml`)

```yaml
publish:
  provider: github
  owner: Aronis-web         # propietario del repo
  repo: caja-frontend-joanis # nombre del repo
```

### 2. Token de GitHub (solo repos privados)

`electron-updater` lee releases públicos sin token. Para repos privados, exporta
`GH_TOKEN` (o `GITHUB_TOKEN`) antes de ejecutar/empaquetar; `electron.js` lo usa
automáticamente como `Authorization` header.

### 3. NSIS (`electron-builder.yml`)

```yaml
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

---

## 🚀 Uso del sistema

### En un componente

```typescript
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { UpdateModal } from '@/components/UpdateModal';

const {
  updateStatus,
  showUpdateModal,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  dismissUpdateModal,
} = useAppUpdater();

// ...
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
```

### IPC disponible (`window.electronAPI`)

```javascript
const { version } = await window.electronAPI.getAppVersion();

// { updateAvailable, currentVersion, latestVersion, releaseNotes, message?, error? }
const result = await window.electronAPI.checkForUpdates();

await window.electronAPI.downloadUpdate(); // progreso vía onDownloadProgress
await window.electronAPI.installUpdate();  // quitAndInstall

window.electronAPI.onUpdateStatus((s) => { /* available | downloading | downloaded | up-to-date | installing | error */ });
window.electronAPI.onDownloadProgress((p) => { /* { percent, transferred, total, bytesPerSecond } */ });
```

---

## 📦 Workflow de releases

```bash
# 1. Subir versión (actualiza package.json, CHANGELOG.md y crea el tag vX.Y.Z)
npm run version -- patch        # o minor | major | 1.2.3

# 2. Commit + tags
git add package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"
git push origin main --tags

# 3. Compilar y publicar a GitHub Releases (sube instalador + latest.yml)
npm run publish
```

`npm run publish` ejecuta `electron-builder ... --publish always` con la config de
`electron-builder.yml`. Requiere `GH_TOKEN` con permisos sobre el repo para subir el
release.

> Para generar el instalador **sin publicar** (pruebas locales), usa
> `npm run electron:build`. Genera el `.exe` y `latest.yml` en `dist/` sin tocar GitHub.

### Resultado en GitHub Releases
- ✅ `CajaGrit-X.Y.Z-setup.exe` (NSIS)
- ✅ `latest.yml` (metadata + sha512 que lee `electron-updater`)
- ✅ Notas del release

---

## 🔧 Troubleshooting

### La app no detecta actualizaciones
1. Verifica `owner`/`repo` en `electron-builder.yml`.
2. Confirma que existe un GitHub Release con tag `vX.Y.Z` y que incluye `latest.yml`.
3. La versión del release debe ser **mayor** que la instalada.
4. Revisa `%APPDATA%\erp-aio-electron\electron-server.log` (líneas `[UPDATE]`).

### Aparece 404 en el log y dice "estás al día"
Es esperado cuando **aún no hay releases** publicados (o el primero). El sistema lo
trata como "al día" a propósito; no es un error.

### No aparece el modal
1. `window.electronAPI` solo existe dentro de Electron (no en navegador).
2. En **modo desarrollo** el auto-updater está deshabilitado (`isDev`).
3. Revisa la consola del renderer (F12) por errores.

### Falla la publicación (`npm run publish`)
1. Exporta un `GH_TOKEN` válido con scope `repo`.
2. Verifica conectividad y que el tag no exista ya como release.

---

## 📚 Referencias

- [electron-updater](https://www.electron.build/auto-update)
- [electron-builder](https://www.electron.build)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)
