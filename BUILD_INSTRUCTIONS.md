# Instrucciones para Generar el Ejecutable .EXE

## ✅ Ejecutable Generado Exitosamente

**Ubicación**: `dist/CajaGrit-0.0.1-Portable.exe`
**Tamaño**: 117.21 MB
**Tipo**: Ejecutable portable (no requiere instalación)

## Requisitos Previos
- Node.js instalado (versión 16 o superior)
- Windows 10/11
- Conexión a internet para la primera compilación

## Pasos para Generar el .EXE

### 1. Preparar el Proyecto
Asegúrate de que todas las dependencias estén instaladas:
```bash
npm install
```

### 2. Configurar la URL del API
Edita el archivo `.env` y configura la URL de tu backend:
```
API_URL=https://tu-api-backend.com
```

### 3. Generar el Ejecutable
Ejecuta el siguiente comando para compilar y generar el ejecutable:
```bash
npm run dist
```

Este comando hará lo siguiente:
- Compilará la aplicación web con Expo
- Empaquetará todo con Electron
- Generará el ejecutable portable .exe en la carpeta `dist/`

### 4. Ubicación del Ejecutable
El ejecutable portable se generará en:
```
dist/CajaGrit-0.0.1-Portable.exe
```

## Desarrollo con Electron

Para probar la aplicación en modo desarrollo con Electron:
```bash
npm run electron
```

Esto abrirá la aplicación en una ventana de escritorio nativa.

## Características del Ejecutable

- **Tamaño de ventana**: 1280x800 (mínimo 1024x768)
- **Tipo**: Ejecutable portable (no requiere instalación)
- **Arquitectura**: x64 (64 bits)
- **Tamaño**: ~117 MB
- **Icono**: Usa el icono predeterminado de Electron

## Distribución

El archivo `CajaGrit-0.0.1-Portable.exe` es un ejecutable portable que:
- **NO requiere instalación** - Solo ejecutar el .exe
- Se puede copiar a cualquier carpeta o USB
- No modifica el registro de Windows
- Todos los datos se guardan en la carpeta del usuario
- No requiere dependencias adicionales

## Cómo Usar el Ejecutable

1. Copia `CajaGrit-0.0.1-Portable.exe` a cualquier ubicación
2. Haz doble clic para ejecutar
3. La aplicación se abrirá en una ventana de escritorio
4. Configura la URL del API en la primera ejecución (si es necesario)

## Solución de Problemas

### Error: "Cannot find module 'electron'"
```bash
npm install
```

### Error durante la compilación web
```bash
npx expo install --fix
npm run web
```

### El .exe no se genera
Verifica que tienes permisos de escritura en la carpeta del proyecto y que no hay antivirus bloqueando electron-builder.

### Windows SmartScreen bloquea la aplicación
Esto es normal para aplicaciones sin firma digital. Haz clic en "Más información" y luego "Ejecutar de todas formas".

## Actualizar la Versión

Para generar una nueva versión:
1. Actualiza el campo `version` en `package.json`
2. Ejecuta `npm run dist`
3. El nuevo ejecutable tendrá el número de versión actualizado

## Notas Importantes

- La primera compilación puede tardar varios minutos
- El ejecutable generado es portable y puede distribuirse libremente
- La aplicación requiere conexión a internet para comunicarse con el backend
- El ejecutable NO está firmado digitalmente (puede mostrar advertencias de Windows)
- Para producción, se recomienda obtener un certificado de firma de código
