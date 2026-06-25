# 🔧 Solución de Problemas - Actualizaciones Automáticas

## Problemas Comunes y Soluciones

### 1. ❌ Error: "No se puede verificar la firma digital"
**Causa:** El instalador no está firmado digitalmente.

**Solución:**
- Este es normal para aplicaciones sin certificado de firma de código
- Windows puede mostrar advertencias de seguridad
- Los usuarios deben hacer clic en "Más información" → "Ejecutar de todas formas"

**Solución permanente:** Obtener un certificado de firma de código (costo: ~$200-400/año)

---

### 2. ❌ Error: "Acceso denegado" o "Permisos insuficientes"
**Causa:** La aplicación no tiene permisos para escribir en la carpeta de instalación.

**Soluciones:**
1. **Ejecutar como administrador** (temporal):
   - Clic derecho en el instalador → "Ejecutar como administrador"

2. **Cambiar ubicación de instalación** (recomendado):
   - Durante la instalación, elegir una carpeta en el perfil del usuario
   - Ejemplo: `C:\Users\TuUsuario\AppData\Local\CajaGrit`

3. **Modificar configuración NSIS** (ya implementado):
   ```json
   "perMachine": false  // Instalar por usuario, no para toda la máquina
   ```

---

### 3. ❌ Error: "No se puede descargar la actualización"
**Causa:** Problemas de red o GitHub no accesible.

**Soluciones:**
1. Verificar conexión a internet
2. Verificar que GitHub esté accesible: https://github.com
3. Verificar que el release esté publicado (no en borrador)
4. Revisar logs en: `%APPDATA%\CajaGrit\logs\`

---

### 4. ❌ Error: "La actualización falló al instalarse"
**Causa:** Archivo corrupto o proceso interrumpido.

**Soluciones:**
1. Cerrar completamente la aplicación
2. Eliminar archivos temporales:
   - `%LOCALAPPDATA%\CajaGrit-updater\`
   - `%TEMP%\electron-updater\`
3. Reiniciar la aplicación para volver a descargar

---

### 5. ❌ Error: "No hay actualizaciones disponibles" (cuando sí las hay)
**Causa:** El release está en modo "Draft" (borrador).

**Solución:**
1. Ir a GitHub Releases: https://github.com/Aronis-web/caja-frontend-joanis/releases
2. Editar el release
3. Cambiar de "Draft" a "Published"

---

### 6. ❌ Error: "CajaGrit cannot be closed"
**Causa:** El instalador detecta que la aplicación todavía está corriendo en segundo plano.

**Soluciones:**

**Opción 1 - Script Automático (Recomendado):**
```powershell
.\kill-cajagrit.ps1
```
Este script cierra todos los procesos de CajaGrit automáticamente.

**Opción 2 - Manual:**
1. Abrir el Administrador de Tareas (Ctrl + Shift + Esc)
2. Buscar procesos llamados "CajaGrit" o "CajaGrit.exe"
3. Hacer clic derecho → "Finalizar tarea"
4. Ejecutar el instalador nuevamente

**Opción 3 - PowerShell:**
```powershell
Get-Process -Name "CajaGrit" -ErrorAction SilentlyContinue | Stop-Process -Force
```

**Prevención:**
- Esperar 2-3 segundos después de cerrar la app antes de ejecutar el instalador
- Usar el botón "Instalar Ahora" en lugar de cerrar manualmente

---

### 7. ❌ La aplicación se cierra pero no se actualiza
**Causa:** El instalador no se ejecuta automáticamente.

**Soluciones:**
1. Verificar que `autoInstallOnAppQuit = true` esté configurado
2. Buscar el instalador descargado en:
   - `%LOCALAPPDATA%\CajaGrit-updater\pending\`
3. Ejecutar manualmente el instalador encontrado

---

### 8. ❌ Error: "ENOENT: no such file or directory"
**Causa:** Archivos de actualización no encontrados.

**Solución:**
1. Verificar que el release en GitHub tenga todos los archivos:
   - `CajaGrit-Setup-X.X.X.exe`
   - `CajaGrit-Setup-X.X.X.exe.blockmap`
   - `latest.yml`
2. Volver a publicar si falta algún archivo

---

## 🔍 Cómo Diagnosticar Problemas

### Ver Logs de la Aplicación
Los logs se guardan en:
```
%APPDATA%\CajaGrit\electron-server.log
```

Para abrirlos:
1. Presiona `Win + R`
2. Escribe: `%APPDATA%\CajaGrit`
3. Abre el archivo `electron-server.log`

### Logs Importantes a Buscar:
- `Verificando actualizaciones...` - Inicio de verificación
- `Actualización disponible: X.X.X` - Actualización detectada
- `Error en auto-updater:` - Error durante el proceso
- `Actualización descargada: X.X.X` - Descarga completada

---

## 🛠️ Soluciones Avanzadas

### Reinstalar Completamente
Si nada funciona:

1. **Desinstalar la aplicación:**
   - Panel de Control → Programas → Desinstalar CajaGrit

2. **Limpiar archivos residuales:**
   ```powershell
   Remove-Item -Path "$env:APPDATA\CajaGrit" -Recurse -Force
   Remove-Item -Path "$env:LOCALAPPDATA\CajaGrit" -Recurse -Force
   Remove-Item -Path "$env:LOCALAPPDATA\CajaGrit-updater" -Recurse -Force
   ```

3. **Descargar e instalar la última versión:**
   - Ir a: https://github.com/Aronis-web/caja-frontend-joanis/releases/latest
   - Descargar `CajaGrit-Setup-X.X.X.exe`
   - Ejecutar el instalador

---

## 📞 Soporte

Si el problema persiste:

1. **Recopilar información:**
   - Versión actual de la aplicación
   - Mensaje de error exacto (captura de pantalla)
   - Logs de `%APPDATA%\CajaGrit\electron-server.log`

2. **Reportar el problema:**
   - Crear un issue en GitHub con la información recopilada
   - O contactar al equipo de desarrollo

---

## ✅ Verificar que Todo Funciona

### Prueba Manual de Actualización:

1. **Verificar versión actual:**
   - Abrir la aplicación
   - Ver la versión en la pantalla de login

2. **Forzar verificación de actualización:**
   - Esperar 3 segundos después de abrir la app
   - Revisar logs para ver si detecta actualizaciones

3. **Probar descarga:**
   - Si hay actualización disponible, hacer clic en "Descargar"
   - Verificar progreso en logs

4. **Probar instalación:**
   - Cuando termine la descarga, hacer clic en "Reiniciar Ahora"
   - La app debe cerrarse e instalarse automáticamente

---

## 🔐 Notas de Seguridad

### Advertencias de Windows Defender/SmartScreen
Es normal que Windows muestre advertencias para aplicaciones sin firma digital:

**Mensaje típico:** "Windows protegió tu PC"

**Cómo proceder:**
1. Hacer clic en "Más información"
2. Hacer clic en "Ejecutar de todas formas"

**Nota:** Esto es seguro si descargaste el instalador desde el repositorio oficial de GitHub.

---

## 📋 Checklist de Verificación

Antes de reportar un problema, verifica:

- [ ] Tienes conexión a internet
- [ ] La versión en GitHub es mayor que tu versión actual
- [ ] El release en GitHub está publicado (no en borrador)
- [ ] Tienes permisos de escritura en la carpeta de instalación
- [ ] No hay antivirus bloqueando la descarga
- [ ] Has revisado los logs en `%APPDATA%\CajaGrit\`

---

**Última actualización:** 2025-01-XX
**Versión del documento:** 1.0
