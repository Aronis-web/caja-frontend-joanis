# 🚀 Guía Rápida de Actualización

## Proceso Simplificado para Publicar Actualizaciones

### ⚙️ Configuración Inicial (Solo una vez)

#### 1. Configurar GitHub Repository

Edita `electron-builder.json` líneas 27-31:

```json
"publish": {
  "provider": "github",
  "owner": "TU_USUARIO_GITHUB",      // ← Cambiar por tu usuario
  "repo": "TU_REPOSITORIO",           // ← Cambiar por tu repositorio
  "private": false
}
```

#### 2. Crear Token de GitHub

1. Ve a: https://github.com/settings/tokens
2. Click en "Generate new token (classic)"
3. Nombre: `CajaGrit Auto Update`
4. Permisos: Marca `repo` (todos los sub-permisos)
5. Click en "Generate token"
6. **COPIA EL TOKEN** (solo se muestra una vez)

#### 3. Configurar Token en tu Sistema

```powershell
# Configurar para la sesión actual
$env:GH_TOKEN="tu_token_aqui"

# O configurar permanentemente (recomendado)
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'tu_token_aqui', 'User')
```

---

## 📦 Publicar una Actualización

### Método 1: Script Automático (Recomendado)

```powershell
# Publicar versión 0.0.2
.\publish-update.ps1 -Version "0.0.2"

# O publicar como borrador (draft)
.\publish-update.ps1 -Version "0.0.2" -Draft
```

El script hace todo automáticamente:
- ✅ Actualiza la versión en `package.json`
- ✅ Genera el build
- ✅ Publica en GitHub Releases
- ✅ Sube los archivos necesarios

### Método 2: Manual

#### Paso 1: Actualizar Versión
Edita `package.json`:
```json
{
  "version": "0.0.2"  // Incrementar versión
}
```

#### Paso 2: Generar y Publicar
```powershell
# Asegúrate de tener el token configurado
$env:GH_TOKEN="tu_token"

# Publicar
npm run publish
```

---

## 🔄 Flujo Completo de Actualización

```
1. Hacer cambios en el código
   ↓
2. Probar localmente: npm run electron
   ↓
3. Incrementar versión en package.json
   ↓
4. Ejecutar: .\publish-update.ps1 -Version "X.X.X"
   ↓
5. ✓ Las apps instaladas se actualizan automáticamente
```

---

## 📊 Versionado

Usa **Semantic Versioning** (MAJOR.MINOR.PATCH):

- **0.0.1 → 0.0.2**: Corrección de bugs (PATCH)
- **0.0.2 → 0.1.0**: Nueva funcionalidad (MINOR)
- **0.1.0 → 1.0.0**: Cambios importantes (MAJOR)

---

## ✅ Verificación

### Después de Publicar

1. Ve a tu repositorio en GitHub
2. Click en "Releases"
3. Deberías ver la nueva versión publicada
4. Verifica que estén estos archivos:
   - `CajaGrit Setup X.X.X.exe`
   - `latest.yml`

### En la Aplicación

Las apps instaladas:
- Verifican actualizaciones al iniciar (después de 3 segundos)
- Verifican cada 4 horas
- Muestran un diálogo cuando hay actualización disponible

---

## 🐛 Solución de Problemas

### "Error: GitHub token not found"
```powershell
# Configurar token
$env:GH_TOKEN="tu_token_aqui"
```

### "Error: Repository not found"
- Verifica que `electron-builder.json` tenga el owner y repo correctos
- Asegúrate de que el repositorio existe en GitHub

### "Las apps no detectan la actualización"
- Verifica que `latest.yml` esté en el release
- Confirma que la nueva versión sea mayor que la instalada
- Revisa los logs en: `C:\Users\[USUARIO]\AppData\Roaming\CajaGrit\electron-server.log`

---

## 📝 Comandos Disponibles

```powershell
# Desarrollo
npm run electron              # Ejecutar en modo desarrollo

# Build local (sin publicar)
npm run dist                  # Generar .exe localmente

# Publicar actualizaciones
npm run publish               # Publicar release público
npm run publish:draft         # Publicar como borrador

# Con script
.\publish-update.ps1 -Version "0.0.2"           # Publicar
.\publish-update.ps1 -Version "0.0.2" -Draft    # Borrador
```

---

## 🎯 Ejemplo Completo

```powershell
# 1. Hacer cambios en el código
# ... editar archivos ...

# 2. Probar localmente
npm run electron

# 3. Publicar actualización
.\publish-update.ps1 -Version "0.0.2"

# Salida esperada:
# ========================================
#   Publicación de Actualización
# ========================================
#
# 1. Actualizando versión en package.json...
#    Versión actualizada: 0.0.1 -> 0.0.2
#
# 2. Generando build...
#    [proceso de build...]
#
# ========================================
#   ✓ Actualización publicada exitosamente
# ========================================
#
# Versión: 0.0.2
# Release: https://github.com/usuario/repo/releases
```

---

## 💡 Consejos

1. **Siempre prueba localmente** antes de publicar
2. **Incrementa la versión correctamente** según los cambios
3. **Documenta los cambios** en el release de GitHub
4. **Mantén el token seguro** - no lo compartas ni lo subas al repositorio
5. **Verifica el release** en GitHub después de publicar

---

## 📚 Más Información

Para detalles completos, consulta: `AUTO_UPDATE_GUIDE.md`
