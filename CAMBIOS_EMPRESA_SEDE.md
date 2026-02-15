# Cambios: Selección de Empresa y Sede

## Fecha
Diciembre 2024

## Resumen
Se implementó la funcionalidad de selección de empresa y sede en el proyecto Caja Grit, siguiendo el mismo patrón del proyecto admin-frontend-joanis. Ahora la aplicación requiere que el usuario seleccione una empresa y una sede después del login, y estos datos se envían en los headers de todas las peticiones API.

## Archivos Modificados

### 1. Tipos y Configuración

#### `src/types/auth.ts`
- ✅ Agregados tipos `Company` y `Site`
- ✅ Company incluye: id, name, alias, ruc, isActive
- ✅ Site incluye: id, code, name, companyId, isActive

#### `src/utils/config.ts`
- ✅ Agregadas claves de storage:
  - `CURRENT_COMPANY: '@caja:current_company'`
  - `CURRENT_SITE: '@caja:current_site'`

#### `src/constants/routes.ts`
- ✅ Agregadas rutas de selección:
  - `COMPANY_SELECTION: 'CompanySelection'`
  - `SITE_SELECTION: 'SiteSelection'`

#### `src/types/navigation.ts`
- ✅ Agregado tipo `SelectionStackParamList`
- ✅ Incluye rutas de CompanySelection y SiteSelection

### 2. Store de Autenticación

#### `src/store/auth.ts`
- ✅ Agregados estados:
  - `currentCompany: Company | null`
  - `currentSite: Site | null`
- ✅ Agregadas acciones:
  - `setCurrentCompany(company)` - Guarda en AsyncStorage y sincroniza con AuthService
  - `setCurrentSite(site)` - Guarda en AsyncStorage y sincroniza con AuthService
- ✅ Modificado `loginWithCredentials`:
  - Limpia empresa/sede al hacer login
  - Inicializa currentCompany y currentSite en null
- ✅ Modificado `logout`:
  - Limpia empresa/sede de AsyncStorage
  - Resetea currentCompany y currentSite a null
- ✅ Modificado `initAuth`:
  - Restaura empresa/sede desde AsyncStorage
  - Sincroniza con AuthService
- ✅ Modificado `clearInvalidAuth`:
  - Limpia empresa/sede de AsyncStorage

### 3. Servicio de Autenticación

#### `src/services/AuthService.ts`
- ✅ Agregadas propiedades privadas:
  - `currentCompany: Company | null`
  - `currentSite: Site | null`
- ✅ Agregados métodos:
  - `setCurrentCompany(company)` - Establece empresa actual
  - `setCurrentSite(site)` - Establece sede actual
  - `getCurrentCompany()` - Obtiene empresa actual
  - `getCurrentSite()` - Obtiene sede actual
  - `makeAuthenticatedRequest<T>(endpoint, options)` - Método genérico para peticiones autenticadas
- ✅ Modificados todos los métodos para incluir headers:
  - `X-App-Id` - ID de la aplicación (siempre)
  - `X-Company-Id` - ID de la empresa (si está seleccionada)
  - `X-Site-Id` - ID de la sede (si está seleccionada)
  - `Authorization` - Bearer token (en peticiones autenticadas)
- ✅ Headers agregados en:
  - `login()` - Login con empresa/sede
  - `performTokenRefresh()` - Refresh token con contexto
  - `logout()` - Logout con contexto
  - `makeAuthenticatedRequest()` - Todas las peticiones autenticadas

### 4. Pantallas de Selección

#### `src/screens/Selection/CompanySelectionScreen.tsx` (NUEVO)
- ✅ Pantalla para seleccionar empresa
- ✅ Carga empresas desde `/companies`
- ✅ Muestra lista de empresas activas
- ✅ Muestra nombre, alias y RUC de cada empresa
- ✅ Al seleccionar empresa:
  - Guarda en store con `setCurrentCompany()`
  - Navega a SiteSelectionScreen
- ✅ Botón de cerrar sesión
- ✅ Manejo de estados: loading, error, lista vacía
- ✅ UI moderna con cards y sombras

#### `src/screens/Selection/SiteSelectionScreen.tsx` (NUEVO)
- ✅ Pantalla para seleccionar sede
- ✅ Carga sedes desde `/companies/{companyId}/sites`
- ✅ Muestra lista de sedes activas de la empresa seleccionada
- ✅ Muestra nombre y código de cada sede
- ✅ Al seleccionar sede:
  - Guarda en store con `setCurrentSite()`
  - Navega automáticamente a MainStack (Home)
- ✅ Botón "Atrás" para cambiar de empresa
- ✅ Manejo de estados: loading, error, lista vacía
- ✅ UI moderna con cards y sombras

### 5. Navegación

#### `src/navigation/index.tsx`
- ✅ Agregado `SelectionStack` con:
  - CompanySelectionScreen
  - SiteSelectionScreen
- ✅ Lógica de navegación condicional:
  1. **No autenticado** → AuthStack (Login)
  2. **Autenticado sin empresa** → SelectionStack (CompanySelection)
  3. **Autenticado con empresa pero sin sede** → SelectionStack (SiteSelection)
  4. **Autenticado con empresa y sede** → MainStack (Home)
- ✅ Navegación automática basada en estado del store

### 6. Pantalla Principal

#### `src/screens/Home/HomeScreen.tsx`
- ✅ Muestra información de empresa y sede actual
- ✅ Card de "Contexto Actual" con:
  - Empresa: nombre, RUC
  - Sede: nombre, código
- ✅ Botones para cambiar:
  - "Cambiar Empresa" - Limpia sede y empresa
  - "Cambiar Sede" - Solo limpia sede
- ✅ Confirmaciones con Alert antes de cambiar
- ✅ Área placeholder para contenido futuro
- ✅ Botón de cerrar sesión con confirmación

## Flujo de Usuario

### 1. Login
```
Usuario ingresa email/password
  ↓
Login exitoso
  ↓
currentCompany = null
currentSite = null
  ↓
Navega a CompanySelectionScreen
```

### 2. Selección de Empresa
```
CompanySelectionScreen carga empresas
  ↓
Usuario selecciona empresa
  ↓
setCurrentCompany(empresa)
  ↓
Navega a SiteSelectionScreen
```

### 3. Selección de Sede
```
SiteSelectionScreen carga sedes de la empresa
  ↓
Usuario selecciona sede
  ↓
setCurrentSite(sede)
  ↓
Navega automáticamente a HomeScreen
```

### 4. Uso de la Aplicación
```
HomeScreen muestra empresa y sede
  ↓
Todas las peticiones API incluyen headers:
- X-App-Id
- X-Company-Id
- X-Site-Id
- Authorization
```

### 5. Cambiar Empresa/Sede
```
Usuario presiona "Cambiar Empresa"
  ↓
Confirmación con Alert
  ↓
setCurrentSite(null)
setCurrentCompany(null)
  ↓
Navega a CompanySelectionScreen
```

### 6. Logout
```
Usuario presiona "Cerrar Sesión"
  ↓
Confirmación con Alert
  ↓
Limpia tokens, usuario, empresa y sede
  ↓
Navega a LoginScreen
```

## Persistencia

### AsyncStorage
- `@caja:current_company` - Empresa seleccionada (JSON)
- `@caja:current_site` - Sede seleccionada (JSON)

### Restauración al Iniciar
1. `initAuth()` carga tokens y usuario
2. Carga empresa y sede desde AsyncStorage
3. Sincroniza con AuthService
4. Navegación automática según estado

## Headers de API

Todas las peticiones autenticadas incluyen:

```typescript
{
  'Content-Type': 'application/json',
  'X-App-Id': 'e28208b8-89b4-4682-80dc-925059424b1f',
  'X-Company-Id': currentCompany?.id,  // Si está seleccionada
  'X-Site-Id': currentSite?.id,        // Si está seleccionada
  'Authorization': `Bearer ${accessToken}`
}
```

## Endpoints Utilizados

### Empresas
- `GET /companies` - Obtener lista de empresas

### Sedes
- `GET /companies/{companyId}/sites` - Obtener sedes de una empresa

## Validación

✅ TypeScript: Sin errores
✅ ESLint: 5 warnings menores (aceptables)
✅ Prettier: Formato correcto
✅ Compilación: Exitosa

## Commit

```
feat: Agregar selección de empresa y sede con headers en API

- Agregar tipos Company y Site en auth.ts
- Actualizar AuthStore con currentCompany y currentSite
- Implementar setCurrentCompany y setCurrentSite con persistencia
- Actualizar AuthService para enviar headers X-Company-Id, X-Site-Id y X-App-Id
- Crear CompanySelectionScreen para seleccionar empresa
- Crear SiteSelectionScreen para seleccionar sede
- Actualizar navegación con SelectionStack condicional
- Actualizar HomeScreen para mostrar empresa/sede actual
- Agregar botones para cambiar empresa y sede
- Limpiar selección de empresa/sede al hacer logout
- Restaurar empresa/sede desde AsyncStorage al inicializar
```

## Próximos Pasos

1. ✅ Implementar funcionalidad de selección de empresa y sede
2. ✅ Enviar headers en todas las peticiones API
3. ⏳ Implementar funcionalidades específicas de Caja (punto de venta)
4. ⏳ Agregar validaciones de permisos por empresa/sede
5. ⏳ Implementar sincronización offline

## Notas Técnicas

- La navegación es completamente automática basada en el estado
- No se requiere navegación manual entre pantallas
- El estado se sincroniza entre AuthStore y AuthService
- Los headers se agregan automáticamente en todas las peticiones
- La persistencia garantiza que la selección sobreviva reinicios de la app
