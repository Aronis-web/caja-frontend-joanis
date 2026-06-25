# 🏪 CajaGrit - Sistema POS

Sistema de Punto de Venta (POS) multiplataforma desarrollado con React Native, Expo y Electron.

## 🚀 Plataformas Soportadas

- 📱 **Android** - APK nativo
- 💻 **Windows** - Aplicación de escritorio con Electron
- 🌐 **Web** - Aplicación web progresiva

## 🛠️ Tecnologías

- **Frontend Framework**: React Native / Expo
- **Lenguaje**: TypeScript
- **Estado Global**: Zustand
- **Navegación**: React Navigation
- **Autenticación**: JWT con refresh tokens
- **Desktop**: Electron
- **Auto-Updates**: electron-updater

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm start
```

## 🔧 Desarrollo

### Modo Web
```bash
npm run web
```

### Modo Electron (Desktop)
```bash
npm run electron
```

### Android
```bash
npm run android
```

## 📱 Build Android

```bash
npx eas-cli build --platform android --profile production
```

## 💻 Build Windows Desktop

### Build Local
```bash
npm run dist
```

### Publicar Actualización Automática
```bash
.\publish-update.ps1 -Version "0.0.2"
```

## 🔄 Sistema de Actualizaciones Automáticas

La aplicación de escritorio incluye un sistema de actualizaciones automáticas:

- ✅ Verifica actualizaciones al iniciar
- ✅ Verifica cada 4 horas
- ✅ Notifica al usuario cuando hay actualizaciones
- ✅ Descarga e instala automáticamente

Ver [QUICK_UPDATE_GUIDE.md](QUICK_UPDATE_GUIDE.md) para más detalles.

## 📚 Documentación

- [QUICK_UPDATE_GUIDE.md](QUICK_UPDATE_GUIDE.md) - Guía rápida de actualizaciones
- [AUTO_UPDATE_GUIDE.md](AUTO_UPDATE_GUIDE.md) - Documentación completa de actualizaciones
- [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) - Instrucciones de build
- [SWEEP.md](SWEEP.md) - Configuración del proyecto

## 🧪 Testing y Validación

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Validación completa
npm run validate
```

## 📁 Estructura del Proyecto

```
src/
├── app/              # Punto de entrada
├── screens/          # Pantallas de la aplicación
├── navigation/       # Configuración de navegación
├── store/            # Estado global (Zustand)
├── services/         # Servicios (API, Auth)
├── utils/            # Utilidades
└── types/            # Tipos TypeScript
```

## 🔐 Variables de Entorno

Crear archivo `.env` en la raíz:

```env
EXPO_PUBLIC_API_URL=https://api.app-joanis-backend.com
EXPO_PUBLIC_PUBLIC_ASSETS_PREFIX=https://api.app-joanis-backend.com/public
EXPO_PUBLIC_ENV=production
EXPO_PUBLIC_APP_ID=tu-app-id
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y propietario.

## 🔗 Enlaces

- **Repositorio**: https://github.com/Aronis-web/caja-frontend-joanis
- **Releases**: https://github.com/Aronis-web/caja-frontend-joanis/releases
