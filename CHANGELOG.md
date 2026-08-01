## [0.0.61] - 2026-06-27

### Added
- 

### Changed
- 

### Fixed
- 

## [0.0.60] - 2026-06-27

### Added
- 

### Changed
- 

### Fixed
- 

## [0.0.59] - 2026-06-27

### Added
- 

### Changed
- 

### Fixed
- 

## [0.0.52] - 2026-04-27

### Added
- 

### Changed
- 

### Fixed
- 

# Changelog

Todos los cambios importantes de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Sistema mejorado de actualizaciones con rollback automático
- Detección de crashes post-actualización
- Modal mejorado con progress visual
- Telemetría centralizada de actualizaciones
- Logging JSON de eventos de actualización
- Scripts de versionado automático (npm run version)
- Scripts de publicación multi-canal (stable, beta, edge)
- Documentación completa del sistema UPDATE_SYSTEM.md
- electron-builder.yml con configuración optimizada
- Hook useAppUpdater para integración en React

### Changed
- Actualización de electron.js con manejo mejorado de updates
- Mejorado UX de diálogos de actualización con opciones flexibles

### Fixed
- Sincronización de versiones en crashes
- Logs de actualización con timestamp centralizado

---

## [0.0.51] - 2026-04-25

### Added
- Componentes de colecciones de efectivo (CashStatusCard, CashProgressBar, CashAlertBadge)
- Pantalla de colecciones (CashCollectionScreen)
- Servicio de colecciones (CollectionsService)
- Store de colecciones con Zustand
- Tipos para manejo de estado de efectivo

### Changed
- Mejoradas rutas de navegación
- Actualizado POSService con soporte para colecciones
- Mejorado sistema de autenticación

### Fixed
- Sincronización de datos offline
- Errores en validación de sesión

---

## [0.0.50] - 2026-04-20

### Added
- Sistema offline mejorado
- Database SQL.js para almacenamiento local
- Sincronización automática

### Changed
- Actualizado React y dependencias

---

## Notas de Versiones Anteriores

Consulta el historial de git para cambios anteriores a la versión 0.0.50.

---

## Instrucciones para Reportar Issues

Si encuentras un bug o tienes una sugerencia:

1. **Revisa** si ya existe un issue similar
2. **Incluye**:
   - Versión de CajaGrit (`npm run version`)
   - Sistema operativo y versión
   - Pasos para reproducir
   - Logs relevantes (`%APPDATA%\CajaGrit\update-service.log`)
3. **Abre** un issue en el repositorio

---

## Instrucciones para Desarrolladores

Para crear una nueva versión:

```bash
# 1. Actualizar versión (major|minor|patch)
npm run version -- minor

# 2. Editar este archivo (CHANGELOG.md) con los cambios
# Cambiar "Unreleased" por "[X.Y.Z] - YYYY-MM-DD"

# 3. Hacer commit
git add package.json CHANGELOG.md
git commit -m "chore: bump version to X.Y.Z"

# 4. Push con tags
git push origin main --tags

# 5. Compilar
npm run dist

# 6. Publicar
npm run publish:stable  # o publish:beta, publish:edge
```
