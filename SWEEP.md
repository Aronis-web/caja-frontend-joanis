# Project-Level Rules
# SWEEP.md - Reglas y Configuración del Proyecto

## Reglas de Git

### Commits y Push
- **IMPORTANTE**: Después de cada cambio realizado, debes hacer commit y push inmediatamente.
- No acumules cambios sin hacer commit.
- Cada modificación debe ser versionada de inmediato.

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

#### Generar APK de Producción
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
- `src/components/` - Componentes reutilizables
- `src/navigation/` - Configuración de navegación
- `src/store/` - Estado global (Zustand)
- `src/services/` - Servicios (API, Auth)
- `src/utils/` - Utilidades
- `src/theme/` - Tema y estilos
- `src/types/` - Tipos TypeScript
