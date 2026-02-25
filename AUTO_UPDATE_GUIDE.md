# 🔄 Guía de Actualizaciones Automáticas

## ✅ Sistema Implementado

Se ha implementado **electron-updater** para gestionar actualizaciones automáticas de la aplicación de escritorio.

## 📋 Cómo Funciona

### Flujo de Actualización

1. **Al iniciar la app**: Verifica actualizaciones después de 3 segundos
2. **Verificación periódica**: Cada 4 horas busca nuevas versiones
3. **Notificación al usuario**: Muestra un diálogo cuando hay actualización disponible
4. **Descarga opcional**: El usuario decide si descargar ahora o más tarde
5. **Instalación**: Se puede instalar inmediatamente o al cerrar la app

### Características

- ✅ Verificación automática de actualizaciones
- ✅ Descarga en segundo plano
- ✅ Notificaciones al usuario
- ✅ Instalación al cerrar la app
- ✅ Solo funciona en producción (no en desarrollo)

## 🚀 Configuración Inicial

### 1. Configurar GitHub Repository

Edita `electron-builder.json` y actualiza estos valores:

```json
"publish": {
  "provider": "github",
  "owner": "TU_USUARIO_GITHUB",      // ← Cambiar
  "repo": "TU_REPOSITORIO",           // ← Cambiar
  "private": false                    // true si el repo es privado
}
```

**Ejemplo:**
```json
"publish": {
  "provider": "github",
  "owner": "miusuario",
  "repo": "caja-frontend-joanis",
  "private": false
}
```

### 2. Crear GitHub Token (si el repo es privado)

Si tu repositorio es privado, necesitas un token:

1. Ve a GitHub → Settings → Developer settings → Personal access tokens
2. Genera un nuevo token con permisos `repo`
3. Copia el token
4. Configura la variable de entorno:
   ```bash
   $env:GH_TOKEN="tu_token_aqui"
   ```

## 📦 Proceso de Publicación de Actualizaciones

### Paso 1: Actualizar la Versión

Edita `package.json` e incrementa la versión:

```json
{
  "version": "0.0.2"  // Incrementar: 0.0.1 → 0.0.2
}
```

### Paso 2: Generar el Build

```bash
npm run dist
```

Esto genera:
- `dist/CajaGrit Setup 0.0.2.exe` - Instalador
- `dist/latest.yml` - Archivo de metadatos para actualizaciones

### Paso 3: Crear GitHub Release

#### Opción A: Manualmente

1. Ve a tu repositorio en GitHub
2. Click en "Releases" → "Create a new release"
3. Tag version: `v0.0.2` (debe coincidir con package.json)
4. Release title: `v0.0.2`
5. Sube estos archivos:
   - `CajaGrit Setup 0.0.2.exe`
   - `latest.yml`
6. Publica el release

#### Opción B: Automáticamente con electron-builder

```bash
# Configurar token de GitHub
$env:GH_TOKEN="tu_token_aqui"

# Publicar automáticamente
npx electron-builder build --win --x64 --publish always
```

### Paso 4: Verificar

Las aplicaciones instaladas verificarán automáticamente y notificarán a los usuarios sobre la nueva versión.

## 🔧 Comandos Útiles

### Generar Build sin Publicar
```bash
npm run dist
```

### Generar y Publicar Automáticamente
```bash
$env:GH_TOKEN="tu_token"
npx electron-builder build --win --x64 --publish always
```

### Generar Draft Release (borrador)
```bash
$env:GH_TOKEN="tu_token"
npx electron-builder build --win --x64 --publish onTagOrDraft
```

## 📝 Versionado Semántico

Sigue este esquema para versiones:

- **MAJOR.MINOR.PATCH** (ejemplo: 1.2.3)
  - **MAJOR**: Cambios incompatibles (1.0.0 → 2.0.0)
  - **MINOR**: Nueva funcionalidad compatible (1.0.0 → 1.1.0)
  - **PATCH**: Correcciones de bugs (1.0.0 → 1.0.1)

## 🎯 Ejemplo Completo de Actualización

```bash
# 1. Hacer cambios en el código
# ... editar archivos ...

# 2. Actualizar versión en package.json
# "version": "0.0.1" → "0.0.2"

# 3. Generar build
npm run dist

# 4. Crear release en GitHub
# - Tag: v0.0.2
# - Subir: CajaGrit Setup 0.0.2.exe y latest.yml

# 5. Las apps instaladas recibirán la notificación automáticamente
```

## 🔍 Verificación de Actualizaciones

### Logs de Electron

Los logs se guardan en:
```
C:\Users\[USUARIO]\AppData\Roaming\CajaGrit\electron-server.log
```

Busca líneas como:
```
Verificando actualizaciones...
Actualización disponible: 0.0.2
Descargando actualización: 50%
Actualización descargada: 0.0.2
```

### Forzar Verificación Manual

Puedes agregar un botón en la UI para verificar manualmente (opcional):

```javascript
// En el código de Electron
ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});
```

## ⚠️ Notas Importantes

1. **Solo funciona en producción**: El auto-updater está deshabilitado en modo desarrollo
2. **Requiere GitHub Releases**: Los archivos deben estar en GitHub Releases
3. **Versión debe incrementar**: La nueva versión debe ser mayor que la actual
4. **latest.yml es crucial**: Siempre sube este archivo junto con el .exe
5. **Primera instalación**: Los usuarios deben instalar manualmente la primera versión

## 🐛 Solución de Problemas

### "No se detectan actualizaciones"

- Verifica que `latest.yml` esté en el release
- Confirma que la versión en GitHub sea mayor que la instalada
- Revisa los logs en `AppData\Roaming\CajaGrit\electron-server.log`

### "Error al descargar actualización"

- Verifica conexión a internet
- Si el repo es privado, configura `GH_TOKEN`
- Revisa que los archivos estén públicamente accesibles

### "La actualización no se instala"

- Verifica permisos de escritura
- Cierra completamente la app y vuelve a abrir
- Revisa que no haya antivirus bloqueando

## 📚 Recursos

- [electron-updater docs](https://www.electron.build/auto-update)
- [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)
