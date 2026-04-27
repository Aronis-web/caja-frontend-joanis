# Sistema de Actualización - CajaGrit

Documentación completa del sistema de actualizaciones mejorado de la aplicación.

## 📋 Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Características](#características)
3. [Configuración](#configuración)
4. [Uso del Sistema](#uso-del-sistema)
5. [Workflow de Releases](#workflow-de-releases)
6. [Monitoreo y Telemetría](#monitoreo-y-telemetría)
7. [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura

### Componentes Principales

#### 1. **UpdateService** (`src/services/UpdateService.ts`)
Servicio Node.js para manejo centralizado de actualizaciones:
- Logging centralizado de eventos de actualización
- Detección de crashes post-actualización
- Rollback automático en caso de fallos repetidos
- Estadísticas y telemetría
- Gestión de estado de versiones

#### 2. **UpdateHandlers** (`src/main/updateHandlers.js`)
Handlers IPC y configuración de electron-updater:
- Intercepta eventos de electron-updater
- Calcula progreso de descarga detallado
- Envía eventos al renderer process
- Maneja dialogs de usuario

#### 3. **useAppUpdater Hook** (`src/hooks/useAppUpdater.ts`)
Hook React para componentes de UI:
- Manejo de estado de actualización
- Integración con Electron API
- Métodos para checkear, descargar, instalar

#### 4. **UpdateModal Component** (`src/components/UpdateModal.tsx`)
Componente UI para mostrar estado:
- Modal con diferentes estados
- Progress bar con estimación de tiempo
- Changelog integrado
- Opciones de instalación flexible

#### 5. **electron-builder.yml**
Configuración del instalador NSIS:
- Firma digital de código
- Delta updates
- Publicación en GitHub
- Mensajes en español

---

## ✨ Características

### Detección de Crashes y Rollback Automático
```
Flujo:
1. Detecta si la app arranca tras una actualización
2. Si falla dentro del timeout (60s), incrementa contador
3. Después de 2 fallos consecutivos → rollback automático
4. Todos los eventos quedan registrados
```

### Logging Centralizado
```
Formato JSON por línea:
{
  "timestamp": "2026-04-25T10:30:45.123Z",
  "event": "download_progress",
  "details": {
    "percent": 50,
    "mbDownloaded": "25.50",
    "mbTotal": "51.00"
  }
}
```

### Telemetría
```
Datos recopilados:
- Total de chequeos de actualización
- Total de actualizaciones completadas
- Número de crashes detectados
- Últimos 50 eventos de actualización
- Versión actual de la app
```

### Progress Visual Mejorado
- Barra de progreso visual (%)
- Datos transferidos / Total
- Velocidad de descarga (MB/s)
- Tiempo estimado restante
- Estados visuales diferenciados

---

## ⚙️ Configuración

### 1. Configuración del Updater (electron-builder.yml)

```yaml
# Proveedor de distribución
publish:
  provider: github
  owner: aronis-web        # ← Cambiar al propietario del repo
  repo: caja-frontend-joanis # ← Cambiar al nombre del repo

# Instalador NSIS
nsis:
  oneClick: false                    # Permitir elegir carpeta
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  language: 1034                     # Español
```

### 2. Variables de Entorno

```bash
# No requeridas, usa defaults si no están definidas
# Pero puedes customizar estos si necesitas:
CAJAVGRIT_UPDATE_CHANNEL=stable  # stable, beta, edge
```

### 3. Configuración de UpdateService

Edita `src/config/updateConfig.ts`:

```typescript
export const updateConfig = {
  // Intervalo de chequeo al iniciar
  checkIntervalOnStartup: 5000,      // 5 segundos
  
  // Intervalo periódico
  checkIntervalPeriodic: 4 * 60 * 60 * 1000, // 4 horas
  
  // Tolerancia de crashes
  maxCrashAttempts: 2,
  crashDetectionTimeout: 60000,      // 1 minuto
  
  // Telemetría
  telemetry: {
    enabled: true,
    endpoint: 'https://pos-erp-aio.com',
    path: '/api/telemetry/updates'
  }
};
```

---

## 🚀 Uso del Sistema

### En la Aplicación

#### 1. Usar el Hook en tu componente
```typescript
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { UpdateModal } from '@/components/UpdateModal';

export const SettingsScreen = () => {
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
```

#### 2. IPC Handlers Disponibles

```javascript
// En cualquier componente con acceso a window.electronAPI:

// Obtener versión actual
const { version, name } = await window.electronAPI.getAppVersion();

// Verificar actualizaciones
const result = await window.electronAPI.checkForUpdates();
// Retorna: { updateAvailable, currentVersion, latestVersion, releaseNotes }

// Descargar
await window.electronAPI.downloadUpdate();

// Instalar
await window.electronAPI.installUpdate();

// Obtener progreso
const progress = await window.electronAPI.getDownloadProgress();
// Retorna: { percent, transferred, total, estimatedTimeRemaining }

// Estadísticas
const stats = await window.electronAPI.getUpdateStats();
// Retorna: { totalChecks, totalUpdates, lastUpdate, crashesDetected }

// Telemetría
const telemetry = await window.electronAPI.getTelemetryData();
// Retorna: { stats, recentLogs, version }
```

---

## 📦 Workflow de Releases

### Paso 1: Preparar Release

```bash
# Opción A: Bump automático
npm run version -- major|minor|patch
# npm run version -- 1.2.3 (para versión específica)

# Esto:
# - Actualiza package.json
# - Crea entrada en CHANGELOG.md
# - Crea git tag (v1.2.3)
```

### Paso 2: Completar Cambios

```bash
# 1. Editar CHANGELOG.md con los cambios
nano CHANGELOG.md

# 2. Hacer commit
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 1.2.3"

# 3. Push con tags
git push origin main --tags
```

### Paso 3: Compilar

```bash
# Compilar ejecutables
npm run dist
# o especificar canal:
npm run electron:build
```

### Paso 4: Publicar

```bash
# Opción A: Canal stable (release normal)
npm run publish:stable

# Opción B: Canal beta (pre-release)
npm run publish:beta

# Opción C: Canal edge (draft, invisible para usuarios)
npm run publish:edge
```

### Resultado

El script generará:
- ✅ Ejecutables firmados (.exe)
- ✅ Instalador NSIS
- ✅ Checksums (SHA256, SHA512)
- ✅ Metadata JSON
- ✅ Release en GitHub con notas

---

## 📊 Monitoreo y Telemetría

### Logs Locales

Los logs se guardan en:
- **Windows**: `%APPDATA%\CajaGrit\update-service.log`
- **macOS**: `~/Library/Application Support/CajaGrit/update-service.log`
- **Linux**: `~/.config/CajaGrit/update-service.log`

Formato JSON, una entrada por línea:
```json
{"timestamp":"2026-04-25T10:30:45Z","event":"download_progress","details":{"percent":50}}
```

### Eventos Loguados

| Evento | Descripción |
|--------|-------------|
| `check` | Verificación de actualizaciones |
| `available` | Actualización disponible |
| `download_start` | Inicio de descarga |
| `download_progress` | Progreso (cada 10%) |
| `download_complete` | Descarga completada |
| `install` | Instalación iniciada |
| `rollback` | Rollback automático |
| `error` | Error durante actualización |
| `crash_detected` | Crash post-actualización |

### Telemetría Remota (Opcional)

Para enviar telemetría al servidor, integra en tu API:

```typescript
// Endpoint: POST /api/telemetry/updates
interface TelemetryPayload {
  stats: {
    totalChecks: number;
    totalUpdates: number;
    lastUpdate?: string;
    updateAttempts: number;
    crashesDetected: number;
  };
  recentLogs: UpdateLog[];
  version: string;
}
```

---

## 🔧 Troubleshooting

### Problema: La app no detecta actualizaciones

**Solución:**
1. Verifica que `owner` y `repo` en `electron-builder.yml` sean correctos
2. Verifica que existe release en GitHub con tag `vX.Y.Z`
3. Revisa logs: `%APPDATA%\CajaGrit\update-service.log`

### Problema: Descarga muy lenta

**Solución:**
1. Las delta updates pueden ser lentas en primera descarga
2. Comprueba velocidad de internet
3. Considera comprimir archivos en build

### Problema: Crash después de actualizar

**Solución:**
1. El sistema detectará automáticamente 2 fallos
2. En el tercer intento hará rollback automático
3. Revisa logs para identificar causa del crash
4. Considera agregar error boundaries en componentes críticos

### Problema: No aparece el modal de actualización

**Solución:**
1. Verifica que `window.electronAPI` está disponible (solo en Electron)
2. Verifica que el hook está integrado en la pantalla correcta
3. Revisa consola del browser (Ctrl+Shift+I) por errores
4. En desarrollo, las actualizaciones están deshabilitadas

### Problema: El instalador NSIS es muy grande

**Solución:**
1. Activa delta updates en `electron-builder.yml`
2. Minimiza archivos de `web-build` (elimina sources maps)
3. Comprime recursos no utilizados
4. Considera comprimir PDF y otros assets

---

## 📚 Referencias

- [electron-updater docs](https://www.electron.build/auto-update)
- [electron-builder docs](https://www.electron.build)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)

---

## 🤝 Soporte

Para reportar issues o sugerencias:
1. Revisa los logs locales
2. Copia telemetría con `getUpdateStats()`
3. Abre issue en el repositorio con logs adjuntos
