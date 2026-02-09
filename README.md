# Caja Frontend Joanis

Aplicación móvil desarrollada con React Native y Expo.

## 🚀 Características

- ✅ Autenticación completa con JWT
- ✅ Navegación con React Navigation
- ✅ Gestión de estado con Zustand
- ✅ Almacenamiento seguro con Expo Secure Store
- ✅ Manejo de errores con Sentry
- ✅ TypeScript para type safety
- ✅ Diseño responsive (móvil y tablet)

## 📋 Requisitos Previos

- Node.js (v16 o superior)
- npm o yarn
- Expo CLI
- Android Studio (para desarrollo Android) o Xcode (para desarrollo iOS)

## 🛠️ Instalación

1. Clonar el repositorio
2. Instalar dependencias:

```bash
npm install
```

3. Configurar variables de entorno:

Copiar `.env.example` a `.env` y configurar las variables:

```bash
cp .env.example .env
```

## 🏃‍♂️ Ejecución

### Desarrollo

```bash
npm start
```

### Android

```bash
npm run android
```

### iOS

```bash
npm run ios
```

### Web

```bash
npm run web
```

## 📦 Build

### Generar APK de Producción

```bash
npx eas-cli build --platform android --profile production
```

## 🧪 Testing

```bash
npm run typecheck
npm run lint
npm run validate
```

## 📁 Estructura del Proyecto

```
src/
├── app/              # Punto de entrada de la aplicación
├── components/       # Componentes reutilizables
│   └── common/      # Componentes comunes
├── config/          # Configuración (Sentry, etc.)
├── constants/       # Constantes (rutas, etc.)
├── hooks/           # Custom hooks
├── navigation/      # Configuración de navegación
├── providers/       # Providers (React Query, etc.)
├── screens/         # Pantallas de la aplicación
│   ├── Auth/       # Pantallas de autenticación
│   └── Home/       # Pantalla principal
├── services/        # Servicios (API, Auth, etc.)
├── store/           # Estado global (Zustand)
├── theme/           # Tema y estilos
├── types/           # Tipos TypeScript
└── utils/           # Utilidades
```

## 🔐 Autenticación

La aplicación utiliza JWT para autenticación:

- Login con email y password
- Refresh token automático
- Almacenamiento seguro de tokens
- Sesión persistente con "Recordarme"

## 🎨 Tema

El tema de la aplicación está centralizado en `src/theme/`:

- Colores
- Espaciado
- Tipografía
- Sombras

## 📱 Pantallas

### Login
- Autenticación con email y password
- Opción "Recordarme"
- Validación de campos
- Manejo de errores

### Home
- Pantalla principal en blanco
- Información del usuario
- Botón de logout

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial.
