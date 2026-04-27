# 🚀 Setup Rápido - Sistema de Actualización

Guía paso a paso para activar el sistema mejorado de actualizaciones.

## ⏱️ Tiempo Estimado: 15 minutos

---

## Paso 1: Configurar electron-builder.yml (2 min)

El archivo `electron-builder.yml` ya está creado. Solo necesitas actualizar:

```yaml
# 📝 Edita electron-builder.yml

publish:
  provider: github
  owner: aronis-web              # ← Cambiar a tu usuario GitHub
  repo: caja-frontend-joanis     # ← Cambiar a tu nombre de repo
```

**Verificar:**
```bash
# Tu repo debe estar en: https://github.com/aronis-web/caja-frontend-joanis
# Si es diferente, actualiza estos valores
```

---

## Paso 2: Integrar en electron.js (5 min)

1. **Abre** `electron.js`

2. **Reemplaza** los viejos manejadores de actualización:
   - Busca: `ipcMain.handle('get-app-version'`
   - Busca: `ipcMain.handle('check-for-updates'`
   - Busca: `ipcMain.handle('download-update'`
   - Busca: `ipcMain.handle('install-update'`
   - Busca: `function setupAutoUpdater()`
   - Busca: `autoUpdater.on('update-available'`

3. **Elimina todos esos bloques**

4. **Agrega al inicio del archivo (después de otros requires):**
```javascript
const { initializeUpdateService } = require('./src/services/UpdateService');
const { setupUpdateIpcHandlers } = require('./src/main/updateHandlers');
```

5. **En la función `app.on('ready', ...)`**, después de `createWindow()`:
```javascript
// Inicializar servicio de actualización
const updateService = initializeUpdateService(app.getVersion());

// Configurar handlers IPC
if (mainWindow && mainWindow.webContents) {
  setupUpdateIpcHandlers(mainWindow, updateService, isDev);
}
```

**Verificar:** No debería haber errores al iniciar: `npm run electron`

---

## Paso 3: Agregar Componentes UI (5 min)

1. **En tu pantalla de configuración/settings**, importa:

```typescript
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { UpdateModal } from '@/components/UpdateModal';
```

2. **Usa el hook:**

```typescript
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
      <Button 
        title="Buscar Actualizaciones" 
        onPress={checkForUpdates}
      />
      
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

## Paso 4: Probar Localmente (3 min)

```bash
# 1. Iniciar en modo desarrollo
npm run electron

# 2. Abre DevTools (Ctrl+Shift+I en Windows)

# 3. Revisa los logs en:
# Windows: %APPDATA%\CajaGrit\update-service.log

# 4. Verifica que aparecen eventos de "check" cada 5 segundos
```

---

## Paso 5: Crear Primera Release (Opcional, para testing)

Si quieres probar el flujo completo:

```bash
# 1. Actualizar versión
npm run version -- patch
# Responde preguntas del script

# 2. Push con tags
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.0.52"
git push origin main --tags

# 3. Compilar
npm run dist

# 4. Publicar (edge = invisible para usuarios, perfecto para testing)
npm run publish:edge

# La release aparecerá en GitHub pero las users no la verán
```

---

## ✅ Checklist de Verificación

- [ ] `electron-builder.yml` tiene `owner` y `repo` correctos
- [ ] `electron.js` importa `initializeUpdateService` y `setupUpdateIpcHandlers`
- [ ] Se llamó a `setupUpdateIpcHandlers()` en `app.on('ready')`
- [ ] Los viejos handlers fueron eliminados
- [ ] `UpdateModal` y `useAppUpdater` están importados en tu pantalla
- [ ] No hay errores de console al iniciar
- [ ] Logs aparecen en `%APPDATA%\CajaGrit\update-service.log`

---

## 📊 Qué Pasa Automáticamente

Una vez activado, el sistema:

✅ **Verifica actualizaciones cada 4 horas**
✅ **Detecta si la app crashea tras actualizar**
✅ **Hace rollback automático después de 2 fallos**
✅ **Loguea todos los eventos en JSON**
✅ **Muestra modal visual con progreso**
✅ **Permite instalar ahora o al cerrar**

---

## 🐛 Troubleshooting

### "No veo logs en update-service.log"

**Causa:** Probablemente `isDev = true`

**Solución:** Los logs solo se crean en producción. Para testing:
```javascript
// En UpdateService.ts, comenta:
// if (isDev) return; // Descomentar esta línea en setupAutoUpdater()
```

### "Electron no inicia - error en requires"

**Causa:** Rutas incorrectas en el `require()`

**Solución:** Verifica que las rutas sean relativas:
```javascript
// Correcto:
require('./src/services/UpdateService')
require('./src/main/updateHandlers')

// Incorrecto:
require('src/services/UpdateService')
require('./services/UpdateService')
```

### "El modal no aparece"

**Causa:** Probablemente `window.electronAPI` no está disponible

**Solución:** Verifica en preload.js que expone la API

---

## 📚 Documentación Completa

Ver `UPDATE_SYSTEM.md` para:
- Arquitectura detallada
- Todos los handlers IPC disponibles
- Workflow de releases profesional
- Telemetría y monitoreo
- Casos de uso avanzados

---

## 🎯 Próximos Pasos

1. **Ahora**: Prueba localmente (`npm run electron`)
2. **Luego**: Integra en tu pantalla de settings
3. **Cuando esté listo**: Haz bump de versión (`npm run version -- minor`)
4. **Final**: Crea release (`npm run publish:stable`)

---

## 💬 Preguntas Frecuentes

**P: ¿Qué pasa si la descarga se interrumpe?**
R: Electron-updater reintenta automáticamente. Los logs registran todos los intentos.

**P: ¿Se pueden instalar actualizaciones en background?**
R: Sí. El usuario elige "Instalar al Cerrar" en el modal.

**P: ¿Qué pasa si falla la instalación?**
R: Después de 2 fallos, se hace rollback automático a versión anterior.

**P: ¿Cómo reporto bugs de actualización?**
R: Comparte el archivo `%APPDATA%\CajaGrit\update-service.log`

---

**¿Stuck?** Revisa `UPDATE_SYSTEM.md` o abre un issue en GitHub con los logs.

Happy updating! 🚀
