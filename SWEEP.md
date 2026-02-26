# SWEEP.md - Reglas y Configuración del Proyecto

## Reglas de Git

### Commits y Push
- **IMPORTANTE**: Después de cada cambio realizado, debes hacer commit y push inmediatamente.
- No acumules cambios sin hacer commit.
- Cada modificación debe ser versionada de inmediato.

### Versionado y Builds
- **IMPORTANTE**: Después de cada modificación funcional, se debe generar una nueva versión del instalador.
- Incrementar la versión en `package.json` (seguir Semantic Versioning: MAJOR.MINOR.PATCH)
- Generar el nuevo instalador con `npm run dist`
- Esto asegura que los usuarios siempre tengan la última versión con las correcciones

## Reglas de Documentación

### Archivos de Documentación
- **NO crear archivos de documentación** a menos que se solicite explícitamente.
- No generar archivos README, guías, resúmenes o documentación técnica sin autorización.
- Enfocarse en el código funcional, no en documentación adicional.

## Comandos Útiles

### Desarrollo

```bash
cd C:/Users/aaron/IdeaProjects/admin-frontend-joanis/caja-frontend-joanis
npm start
```

### Build

#### Generar APK de Producción (Android)
Para generar el APK del proyecto usando EAS Build:

```bash
cd C:/Users/aaron/IdeaProjects/admin-frontend-joanis/caja-frontend-joanis
npx eas-cli build --platform android --profile production
```

**Notas:**
- El comando incrementa automáticamente el versionCode
- El APK se genera en la nube usando EAS Build
- Al finalizar, se proporciona un enlace de descarga del APK
- El proceso toma aproximadamente 10-20 minutos
- Requiere cuenta de Expo configurada

#### Generar Ejecutable de Escritorio (Windows)

**Build Local (sin publicar):**
```bash
npm run dist
```
Genera el instalador en `dist/CajaGrit Setup X.X.X.exe`

**Publicar Actualización Automática:**
```powershell
# Configurar token de GitHub (solo primera vez)
$env:GH_TOKEN="tu_token_github"

# Publicar nueva versión
.\publish-update.ps1 -Version "0.0.2"
```

**Notas:**
- Requiere configurar GitHub Releases (ver `QUICK_UPDATE_GUIDE.md`)
- Las apps instaladas se actualizan automáticamente
- El sistema verifica actualizaciones al iniciar y cada 4 horas
- Usa Semantic Versioning (MAJOR.MINOR.PATCH)

### Test

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

### Validación Completa

```bash
npm run validate
```

## Estilo de Código

### Convenciones
- Seguir las convenciones existentes en el proyecto
- Mantener consistencia con el código actual
- Usar TypeScript para type safety
- Componentes funcionales con hooks

## Estructura del Proyecto

### Información General
- Proyecto: caja-frontend-joanis
- Framework: React Native / Expo
- Lenguaje: TypeScript
- Estado: Zustand
- Navegación: React Navigation
- Autenticación: JWT con refresh tokens

### Arquitectura
- `src/app/` - Punto de entrada
- `src/screens/` - Pantallas de la aplicación
- `src/navigation/` - Configuración de navegación
- `src/store/` - Estado global (Zustand)
- `src/services/` - Servicios (API, Auth)
- `src/utils/` - Utilidades
- `src/types/` - Tipos TypeScript
