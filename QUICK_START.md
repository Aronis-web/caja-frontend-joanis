# 🚀 Quick Start - Sistema de Actualización

**⏱️ Tiempo total: 20 minutos**

---

## 3 Pasos para Activar

### PASO 1: Configurar (2 min)

**Editar:** `electron-builder.yml` (líneas 39-42)

```yaml
publish:
  provider: github
  owner: TU_USUARIO_GITHUB        ← CAMBIAR
  repo: TU_NOMBRE_REPO            ← CAMBIAR
```

Ejemplo:
```yaml
publish:
  provider: github
  owner: aronis-web
  repo: caja-frontend-joanis
```

---

### PASO 2: Integrar (10 min)

**Editar:** `electron.js`

**2.1** Agregar al inicio (con otros requires):
```javascript
const { initializeUpdateService } = require('./src/services/UpdateService');
const { setupUpdateIpcHandlers } = require('./src/main/updateHandlers');
```

**2.2** En `app.on('ready')`, después de `createWindow()`:
```javascript
if (mainWindow && mainWindow.webContents) {
  const updateService = initializeUpdateService(app.getVersion());
  global.updateService = updateService;
  setupUpdateIpcHandlers(mainWindow, updateService, isDev);
  console.log('[UPDATE] ✅ Sistema inicializado');
}
```

**2.3** Eliminar todos los handlers viejos que contengan:
- `ipcMain.handle('get-app-version'`
- `ipcMain.handle('check-for-updates'`
- `ipcMain.handle('download-update'`
- `ipcMain.handle('install-update'`
- `function setupAutoUpdater()`
- `autoUpdater.on('update-available'`
- `autoUpdater.on('update-not-available'`
- `autoUpdater.on('error'`
- `autoUpdater.on('download-progress'`
- `autoUpdater.on('update-downloaded'`

---

### PASO 3: Usar (8 min)

**En tu pantalla de Settings**, agregar:

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
    <View>
      {/* Tu contenido */}
      
      <Button title="Buscar Actualizaciones" onPress={checkForUpdates} />
      
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
    </View>
  );
};
```

---

## ✅ Verificar que Funciona

```bash
# Iniciar
npm run electron

# En DevTools (Ctrl+Shift+I):
const stats = await window.electronAPI.getUpdateStats();
console.log(stats);
```

Deberías ver logs en: `%APPDATA%\CajaGrit\update-service.log`

---

## 📊 Eso es Todo

Ahora el sistema automáticamente:
- ✅ Verifica actualizaciones cada 4 horas
- ✅ Muestra modal visual cuando hay actualización
- ✅ Detecta crashes y hace rollback
- ✅ Loguea todo en JSON
- ✅ Permite instalar ahora o al cerrar

---

## 🎯 Próximo: Primera Release

```bash
npm run version -- patch     # Bump versión
# Editar CHANGELOG.md si quieres
git add package.json CHANGELOG.md
git commit -m "chore: version bump"
git push origin main --tags  # ← Importante: --tags
npm run dist                 # Compilar
npm run publish:edge         # Publicar (testing)
# Luego cuando esté listo:
# npm run publish:stable
```

---

## 📚 Documentación Completa

- **SETUP_UPDATES.md** - Guía detallada (15 min)
- **UPDATE_SYSTEM.md** - Técnico/referencia
- **INTEGRATION_CODE_EXAMPLES.md** - Código copy-paste
- **UPDATES_IMPLEMENTATION_SUMMARY.md** - Qué se implementó

---

## 💬 FAQ Rápido

**P: ¿Qué pasa si no hago nada después de activarlo?**
R: Funcionará automáticamente. Verificará updates cada 4 horas.

**P: ¿Cómo publico la primera actualización?**
R: `npm run version -- patch` → `npm run dist` → `npm run publish:stable`

**P: ¿Puedo testear sin publicar?**
R: Sí, usa `npm run publish:edge` para drafts invisibles.

**P: ¿Qué pasa si crashea la app?**
R: Detecta automáticamente y hace rollback después de 2 fallos.

**P: ¿Dónde están los logs?**
R: `%APPDATA%\CajaGrit\update-service.log`

---

**¿Stuck?** Vuelve atrás a los 3 pasos o lee SETUP_UPDATES.md completo.

**¡Listo! 🎉**
