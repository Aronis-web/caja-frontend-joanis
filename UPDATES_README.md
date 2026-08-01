# 📦 Sistema de Actualización - CajaGrit

Índice de documentación y recursos para el sistema de actualizaciones de Electron.

> ⚠️ **Estado actual (fuente de la verdad: [UPDATE_SYSTEM.md](./UPDATE_SYSTEM.md)).**
> El sistema usa **`electron-updater` + GitHub Releases** (igual que
> `admin-frontend-joanis`), cableado directamente en `electron.js`. Algunas partes
> históricas de este índice describen un diseño previo con `UpdateService.ts`,
> telemetría y canales beta/edge que **no están implementados**; ignóralas y guíate
> por `UPDATE_SYSTEM.md`.

---

## 🚀 Comienza Aquí

### Para Activar el Sistema (15 minutos)
📖 **[SETUP_UPDATES.md](./SETUP_UPDATES.md)**
- Guía paso a paso
- Integración en electron.js
- Testing local
- Checklist de verificación

### Para Entender la Arquitectura
📚 **[UPDATE_SYSTEM.md](./UPDATE_SYSTEM.md)**
- Componentes del sistema
- Configuración detallada
- Workflow de releases
- Monitoreo y telemetría
- Troubleshooting

### Para Ver Lo Implementado
✨ **[UPDATES_IMPLEMENTATION_SUMMARY.md](./UPDATES_IMPLEMENTATION_SUMMARY.md)**
- Objetivos completados
- Archivos creados
- Arquitectura visual
- Flujos de funcionamiento
- Características clave

---

## 📁 Estructura de Archivos

### Configuración Principal
```
├── electron-builder.yml          ← Config del instalador + publish github
├── CHANGELOG.md                  ← Historial de cambios
└── UPDATE_SYSTEM.md              ← Documentación técnica (fuente de la verdad)
```

### Código Fuente (implementación real)

**Main process (Electron):**
```
electron.js                      ← electron-updater: setupAutoUpdater() + IPC
preload.js                       ← expone window.electronAPI (check/download/install)
```

**Componentes React:**
```
src/components/
└── UpdateModal.tsx              ← UI modal para actualizaciones

src/hooks/
└── useAppUpdater.ts             ← Hook (Electron por IPC; Android por HTTP)
```

**Scripts de Desarrollo:**
```
scripts/
└── version-manager.js           ← Manejo automático de versiones (npm run version)
```

---

## 🎯 Guías Rápidas por Rol

### 👨‍💻 Desarrollador Frontend
1. Leer: **[SETUP_UPDATES.md](./SETUP_UPDATES.md)** - Paso 3
2. Integrar `UpdateModal` en pantalla de Settings
3. Probar con `npm run electron`

**Código necesario:**
```typescript
import { useAppUpdater } from '@/hooks/useAppUpdater';
import { UpdateModal } from '@/components/UpdateModal';

const { updateStatus, showUpdateModal, ... } = useAppUpdater();
```

### 🏗️ Arquitecto de Sistemas
1. Leer: **[UPDATE_SYSTEM.md](./UPDATE_SYSTEM.md)** - Sección Arquitectura
2. Revisar: **[UPDATES_IMPLEMENTATION_SUMMARY.md](./UPDATES_IMPLEMENTATION_SUMMARY.md)** - Diagramas
3. Configurar: `electron-builder.yml` con tus parámetros GitHub

### 🚀 DevOps / Release Manager
1. Leer: **[UPDATE_SYSTEM.md](./UPDATE_SYSTEM.md)** - Workflow de Releases
2. Configurar: GitHub token para CI/CD
3. Usar comandos:
   - `npm run version -- major|minor|patch`
   - `npm run publish:stable|beta|edge`

### 📖 Technical Writer / QA
1. Consultar: **[CHANGELOG.md](./CHANGELOG.md)** para notas de release
2. Revisar: **[UPDATE_SYSTEM.md](./UPDATE_SYSTEM.md)** - Sección Monitoreo
3. Trackear: Logs en `%APPDATA%\CajaGrit\update-service.log`

---

## 🔑 Características Principales

### ✅ Para Usuarios
- Actualizaciones automáticas sin intervención
- Modal visual con progreso
- Opción de instalar ahora o al cerrar
- Historial de cambios integrado
- Rollback automático si algo falla

### ✅ Para Desarrolladores
- Versionado automático (`npm run version`)
- Publicación con 1 comando (`npm run publish:stable`)
- Logging centralizado en JSON
- Telemetría agregada
- Multi-canal (stable, beta, edge)

### ✅ Para DevOps
- CI/CD con GitHub Actions
- Checksums automáticos (SHA256, SHA512)
- Firma de código en Windows
- Delta updates para descargas pequeñas

---

## 📊 Métricas & Monitoreo

### Estadísticas Disponibles
```javascript
// En cualquier componente React
const stats = await window.electronAPI.getUpdateStats();
// Retorna:
// {
//   totalChecks: 10,
//   totalUpdates: 1,
//   updateAttempts: 0,
//   crashesDetected: 0,
//   lastUpdate: "2026-04-25T10:30:45Z"
// }
```

### Logs Centralizados
```
%APPDATA%\CajaGrit\update-service.log

Formato JSON, eventos:
- check
- available
- download_start
- download_progress
- download_complete
- install
- rollback
- crash_detected
- error
```

### Telemetría
```javascript
const telemetry = await window.electronAPI.getTelemetryData();
// Retorna: { stats, recentLogs[], version }
```

---

## 🛠️ Checklist de Setup

### 1️⃣ Configuración
- [ ] Editar `electron-builder.yml` (owner/repo)
- [ ] Crear GitHub token (si usas CI/CD)
- [ ] Configurar `updateConfig.ts` si necesario

### 2️⃣ Integración Código
- [ ] Agregar imports en `electron.js`
- [ ] Llamar a `setupUpdateIpcHandlers()`
- [ ] Eliminar viejos handlers de update
- [ ] Integrar `UpdateModal` en UI

### 3️⃣ Testing
- [ ] Ejecutar `npm run electron`
- [ ] Revisar logs en `%APPDATA%\CajaGrit\`
- [ ] Verificar que no hay errores en console

### 4️⃣ Primera Release
- [ ] `npm run version -- patch`
- [ ] Editar CHANGELOG.md
- [ ] `git push --tags`
- [ ] `npm run dist`
- [ ] `npm run publish:edge` (para testing)

### 5️⃣ Producción
- [ ] Validar con usuarios beta
- [ ] `npm run publish:stable`
- [ ] Monitorear logs de usuarios
- [ ] Recopilar feedback

---

## 🐛 Troubleshooting Rápido

| Problema | Causa | Solución |
|----------|-------|----------|
| Logs no aparecen | Modo dev activo | Ver `isDev` en `electron.js` |
| Modal no se muestra | API no disponible | Verificar `window.electronAPI` |
| Descarga lenta | Delta updates | Comprime assets en build |
| Crash post-update | Bug en código | Revisa logs, reporta issue |
| GitHub no reconoce repo | owner/repo mal | Edita `electron-builder.yml` |

Ver **[UPDATE_SYSTEM.md](./UPDATE_SYSTEM.md)** Sección Troubleshooting para más detalles.

---

## 📚 Documentación Relacionada

### Archivos de Ejemplo
- **[src/main/electron-integration-example.js](./src/main/electron-integration-example.js)** - Código de integración
- **electron-builder.yml** - Configuración NSIS

### Documentación Oficial
- [electron-updater](https://www.electron.build/auto-update)
- [electron-builder](https://www.electron.build/)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)

---

## 🎓 Flujos de Trabajo

### Flujo de Desarrollo Regular
```
1. npm run electron          ← Desarrollo local
2. Hacer cambios
3. npm run lint
4. npm run format
5. Hacer commit
6. git push
```

### Flujo de Release
```
1. npm run version -- minor  ← Bump versión
2. Editar CHANGELOG.md
3. git commit + git push --tags
4. npm run dist              ← Compilar
5. npm run publish:stable    ← Publicar
```

### Flujo de Testing Beta
```
1. npm run version -- patch
2. git push --tags
3. npm run dist
4. npm run publish:beta      ← Pre-release
5. Compartir con beta testers
6. Recopilar feedback
7. npm run publish:stable    ← Cuando esté listo
```

---

## 🎯 Próximas Mejoras (Roadmap)

- [ ] Dashboard web de estadísticas de updates
- [ ] Notificaciones push para updates críticas
- [ ] Soporte para actualizaciones rollback manual desde UI
- [ ] Integración con servidor para telemetría
- [ ] Soporte para macOS y Linux
- [ ] Auto-update silencioso fuera de horario laboral

---

## 💬 Preguntas Frecuentes

**P: ¿Necesito hacer algo especial para que los usuarios reciban updates?**
R: No. Una vez publicado en GitHub Releases, la app automáticamente lo detectará cada 4 horas.

**P: ¿Puedo testear updates sin publicar?**
R: Sí, usa `npm run publish:edge` para crear draft releases invisibles.

**P: ¿Qué pasa si el usuario no instala la actualización?**
R: Nada. La app sigue funcionando. Se le preguntará nuevamente en el próximo reinicio.

**P: ¿Cómo revertir una actualización mala?**
R: El sistema hace rollback automático después de 2 fallos. O puedes publicar una versión anterior.

**P: ¿Se pueden incluir archivos muy grandes en updates?**
R: Sí, pero usa delta updates en `electron-builder.yml` para reducir tamaño de descarga.

---

## 📞 Contacto & Soporte

Para problemas:
1. Consulta **[UPDATE_SYSTEM.md](./UPDATE_SYSTEM.md)** Troubleshooting
2. Comparte logs de `%APPDATA%\CajaGrit\update-service.log`
3. Abre issue en GitHub con telemetría de `getTelemetryData()`

---

## 🎉 ¡Listo para Empezar!

**Primer paso:** Lee **[SETUP_UPDATES.md](./SETUP_UPDATES.md)** en 15 minutos.

**Segundo paso:** Integra en tu `electron.js`.

**Tercer paso:** Prueba localmente.

**Cuarto paso:** ¡A producción! 🚀

---

**Última actualización:** 25 Abril 2026  
**Versión del sistema:** 1.0.0  
**Compatible con:** CajaGrit v0.0.51+
