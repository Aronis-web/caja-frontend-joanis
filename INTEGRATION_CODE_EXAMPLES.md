# 🔧 Ejemplos de Código de Integración

Ejemplos listos para copiar y pegar para integrar el sistema de actualización.

---

## 1️⃣ Integración en electron.js

### Paso 1: Agregar Imports (Al inicio del archivo)

```javascript
// Agregar estas líneas después de los otros requires
const { initializeUpdateService } = require('./src/services/UpdateService');
const { setupUpdateIpcHandlers } = require('./src/main/updateHandlers');
```

### Paso 2: Llamar setupUpdateIpcHandlers (En app.on('ready'))

Encuentra esta sección en tu `electron.js`:

```javascript
app.on('ready', () => {
  // ... código existente ...

  // Después de que createWindow(port) o createServer() se haya llamado
  // AGREGAR ESTAS LÍNEAS:
  
  if (mainWindow && mainWindow.webContents) {
    // Inicializar servicio de actualización
    const updateService = initializeUpdateService(app.getVersion());
    global.updateService = updateService;
    
    // Configurar handlers de actualización
    const updateManager = setupUpdateIpcHandlers(mainWindow, updateService, isDev);
    global.updateManager = updateManager;
    
    console.log('[UPDATE] ✅ Sistema de actualización inicializado');
  }
});
```

### Paso 3: Eliminar Handlers Viejos

Busca y ELIMINA estos bloques del código viejo:

```javascript
// ❌ ELIMINAR ESTO:

// Obtener versión de la app
ipcMain.handle('get-app-version', async () => { ... });

// Verificar actualizaciones manualmente
ipcMain.handle('check-for-updates', async () => { ... });

// Descargar actualización
ipcMain.handle('download-update', async () => { ... });

// Instalar actualización
ipcMain.handle('install-update', async () => { ... });

// Función setupAutoUpdater
function setupAutoUpdater() { ... }

// Todos los autoUpdater.on() listeners
autoUpdater.on('update-available', ...)
autoUpdater.on('update-not-available', ...)
autoUpdater.on('error', ...)
autoUpdater.on('download-progress', ...)
autoUpdater.on('update-downloaded', ...)
```

---

## 2️⃣ Integración en Pantalla de Settings

### Opción A: Pantalla Separada de Actualización

Crear `src/screens/Settings/UpdateSettingsScreen.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { UpdateModal } from '@/components/UpdateModal';

export const UpdateSettingsScreen = () => {
  const {
    updateStatus,
    showUpdateModal,
    isElectron,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdateModal
  } = useAppUpdater();

  if (!isElectron) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.message}>
            Las actualizaciones solo están disponibles en la versión de escritorio.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actualizaciones</Text>
          
          <View style={styles.versionInfo}>
            <Text style={styles.label}>Versión Instalada:</Text>
            <Text style={styles.value}>{updateStatus.currentVersion}</Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={checkForUpdates}
          >
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.buttonText}>Buscar Actualizaciones</Text>
          </TouchableOpacity>

          {updateStatus.updateAvailable && (
            <View style={styles.alert}>
              <Ionicons name="alert-circle" size={20} color="#FF9800" />
              <Text style={styles.alertText}>
                Actualización disponible: {updateStatus.latestVersion}
              </Text>
            </View>
          )}

          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#2196F3" />
            <Text style={styles.infoText}>
              Las actualizaciones se verifican automáticamente cada 4 horas.
            </Text>
          </View>
        </View>
      </ScrollView>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  content: {
    flex: 1,
    padding: 16
  },
  section: {
    marginBottom: 32
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000'
  },
  versionInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16
  },
  label: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000'
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  alert: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  alertText: {
    color: '#E65100',
    flex: 1,
    fontSize: 14
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  infoText: {
    color: '#1565C0',
    flex: 1,
    fontSize: 13,
    lineHeight: 20
  }
});
```

### Opción B: Botón en Settings Existente

Si ya tienes una pantalla de Settings, agrega:

```typescript
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { UpdateModal } from '@/components/UpdateModal';

export const SettingsScreen = () => {
  // ... estado existente ...
  
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
      {/* ... contenido existente ... */}

      {/* AGREGAR ESTA SECCIÓN */}
      <View style={styles.section}>
        <Text style={styles.title}>Sistema</Text>
        
        <TouchableOpacity 
          style={styles.option}
          onPress={checkForUpdates}
        >
          <Ionicons name="refresh" size={20} color="#2196F3" />
          <Text style={styles.optionText}>Buscar Actualizaciones</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </View>

      {/* AGREGAR ESTE MODAL */}
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

## 3️⃣ Obtener Información de Actualización

### En un Componente React

```typescript
// Hook en componente
const { updateStatus } = useAppUpdater();

// Acceder a información:
console.log('Versión actual:', updateStatus.currentVersion);
console.log('Actualización disponible:', updateStatus.updateAvailable);
console.log('Última versión:', updateStatus.latestVersion);
console.log('Estado:', updateStatus.status); // 'idle', 'checking', 'downloading', etc
```

### Obtener Estadísticas

```typescript
import { useEffect, useState } from 'react';

export const UpdateStatsComponent = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      const stats = await window.electronAPI?.getUpdateStats?.();
      setStats(stats);
    };
    fetchStats();
  }, []);

  if (!stats) return <Text>Cargando...</Text>;

  return (
    <View>
      <Text>Total de chequeos: {stats.totalChecks}</Text>
      <Text>Total de actualizaciones: {stats.totalUpdates}</Text>
      <Text>Crashes detectados: {stats.crashesDetected}</Text>
    </View>
  );
};
```

### Obtener Telemetría

```typescript
const handleGetTelemetry = async () => {
  const telemetry = await window.electronAPI?.getTelemetryData?.();
  console.log('Telemetría:', telemetry);
  // {
  //   stats: { ... },
  //   recentLogs: [ ... ],
  //   version: "0.0.51"
  // }
  
  // Enviar a servidor si lo deseas:
  // await fetch('https://tu-api.com/telemetry', {
  //   method: 'POST',
  //   body: JSON.stringify(telemetry)
  // });
};
```

---

## 4️⃣ Manejo Manual de Actualización

```typescript
// Verificar manualmente
const handleCheckUpdates = async () => {
  try {
    const result = await window.electronAPI.checkForUpdates();
    if (result.updateAvailable) {
      Alert.alert('Actualización disponible', `Nueva versión: ${result.latestVersion}`);
    } else {
      Alert.alert('Sin actualizaciones', 'Ya tienes la última versión');
    }
  } catch (error) {
    Alert.alert('Error', 'No se pudo verificar actualizaciones');
  }
};

// Descargar manualmente
const handleDownload = async () => {
  try {
    await window.electronAPI.downloadUpdate();
  } catch (error) {
    Alert.alert('Error', 'No se pudo descargar la actualización');
  }
};

// Instalar manualmente
const handleInstall = async () => {
  try {
    await window.electronAPI.installUpdate();
  } catch (error) {
    Alert.alert('Error', 'No se pudo instalar la actualización');
  }
};
```

---

## 5️⃣ Configurar Rutas de Navegación

Si quieres agregar la pantalla de actualización al menú:

```typescript
// src/navigation/index.tsx

import { UpdateSettingsScreen } from '@/screens/Settings/UpdateSettingsScreen';

export const RootNavigator = () => {
  return (
    <Stack.Navigator>
      {/* ... otras pantallas ... */}
      
      <Stack.Screen
        name="UpdateSettings"
        component={UpdateSettingsScreen}
        options={{
          title: 'Actualizaciones',
          headerBackTitle: 'Atrás'
        }}
      />
    </Stack.Navigator>
  );
};
```

Luego navegar así:

```typescript
const { navigate } = useNavigation();

<TouchableOpacity onPress={() => navigate('UpdateSettings')}>
  <Text>Ver Actualizaciones</Text>
</TouchableOpacity>
```

---

## 6️⃣ Testing Local

### Verificar que los logs se crean

```bash
# Windows
type %APPDATA%\CajaGrit\update-service.log

# macOS/Linux
cat ~/Library/Application\ Support/CajaGrit/update-service.log
```

### Ver contenido de logs

```bash
# Windows - últimas 20 líneas
powershell -Command "Get-Content $env:APPDATA\CajaGrit\update-service.log -Tail 20"

# Linux/macOS - últimas 20 líneas
tail -20 ~/.config/CajaGrit/update-service.log
```

### Verificar en consola

```javascript
// En DevTools (Ctrl+Shift+I):
const stats = await window.electronAPI.getUpdateStats();
console.log(stats);

const telemetry = await window.electronAPI.getTelemetryData();
console.log(telemetry);
```

---

## 7️⃣ Configurar GitHub para Releases

### En tu repositorio GitHub

1. Ve a Settings → Developer settings → Personal access tokens
2. Genera un token con permisos `repo` y `workflow`
3. Copia el token
4. En CI/CD, usa como `GH_TOKEN`

### En electron-builder.yml

```yaml
publish:
  provider: github
  owner: TU_USUARIO_GITHUB          # ← Cambiar
  repo: TU_NOMBRE_REPO              # ← Cambiar
```

---

## 8️⃣ Crear Primera Release

```bash
# 1. Bump versión
npm run version -- minor
# Responde preguntas, se actualiza package.json

# 2. Hacer commit
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.0.52"

# 3. Push con tags (IMPORTANTE: --tags)
git push origin main --tags

# 4. Compilar
npm run dist

# 5. Publicar
npm run publish:stable

# O para testing:
npm run publish:edge
```

---

## 9️⃣ Integración Avanzada - Notificaciones

Mostrar notificación cuando hay actualización disponible:

```typescript
import { useEffect } from 'react';
import { useAppUpdater } from '@/hooks/useAppUpdater';

export const UpdateNotifier = () => {
  const { updateStatus, showUpdateModal, setShowUpdateModal } = useAppUpdater();

  useEffect(() => {
    if (updateStatus.status === 'available' && !showUpdateModal) {
      // Opcional: mostrar toast o notificación
      console.log('Nueva actualización disponible:', updateStatus.latestVersion);
      
      // Auto-show modal después de 5 segundos si el usuario está en settings
      const timer = setTimeout(() => {
        // Aquí podrías setear un flag para mostrar el modal
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [updateStatus.status]);

  return null; // Solo efectos, no renderiza UI
};

// Usar en App.tsx
<>
  <RootNavigator />
  <UpdateNotifier />
</>
```

---

## 🔟 Configuración de Desarrollo

Si quieres permitir logs en desarrollo:

```typescript
// En src/services/UpdateService.ts, busca:

private setupAutoUpdater(): void {
  // Only verify updates in production
  if (isDev) {
    console.log('Auto-updater disabled in development');
    return;
  }
  
  // CAMBIAR A:
  if (isDev) {
    console.log('Auto-updater disabled in development');
    // Descomentar siguiente línea para debugging:
    // return; // Comentar para permitir logs en dev
  }
}
```

---

## 📋 Checklist de Integración

- [ ] Agregué imports en `electron.js`
- [ ] Llamé a `setupUpdateIpcHandlers()` en `app.on('ready')`
- [ ] Eliminé viejos handlers
- [ ] Importé `UpdateModal` en mi pantalla
- [ ] Importé `useAppUpdater` hook
- [ ] Agregué botón "Buscar Actualizaciones"
- [ ] Probé con `npm run electron`
- [ ] Verifiqué logs en `%APPDATA%\CajaGrit\`
- [ ] Sin errores en DevTools console
- [ ] Configuré electron-builder.yml (owner/repo)

---

## 🆘 Troubleshooting por Error

### Error: "Cannot find module './src/services/UpdateService'"

**Causa:** Ruta incorrecta

**Solución:**
```javascript
// Verificar que la ruta es relativa desde electron.js:
require('./src/services/UpdateService')  // ✓ Correcto
require('src/services/UpdateService')    // ✗ Incorrecto
```

### Error: "window.electronAPI is undefined"

**Causa:** Probablemente no estás en Electron

**Solución:**
```typescript
if (typeof window !== 'undefined' && window.electronAPI) {
  // Estás en Electron
} else {
  // Estás en web
}
```

### Logs no aparecen en update-service.log

**Causa:** Probablemente `isDev = true`

**Solución:** Logs solo en producción. Para testing:
```bash
NODE_ENV=production npm run electron
```

---

**¿Necesitas más ejemplos?** Revisa los archivos de ejemplo en:
- `src/main/electron-integration-example.js`
- `src/components/UpdateModal.tsx`
- `src/hooks/useAppUpdater.ts`
