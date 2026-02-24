# Módulo POS - Terminal de Venta

## 📋 Descripción

Sistema completo de Punto de Venta (POS) integrado con el backend para gestión de cajas registradoras, sesiones, ventas y documentos fiscales (Boletas/Facturas).

## 🎯 Características Principales

### 1. Gestión de Cajas Registradoras
- Selección de caja registradora por sede
- Visualización de estado (abierta/cerrada)
- Información de punto de emisión asociado

### 2. Gestión de Sesiones
- **Apertura de Sesión**: Registro de balance inicial
- **Sesión Activa**: Monitoreo en tiempo real de:
  - Balance actual
  - Total de ventas
  - Número de transacciones
  - Usuario y hora de apertura
- **Cierre de Sesión**:
  - Resumen completo del día
  - Cálculo automático de diferencias
  - Registro de balance final

### 3. Ventas
- **Búsqueda de Productos**: Búsqueda en tiempo real
- **Carrito de Compras**:
  - Agregar/eliminar productos
  - Ajustar cantidades
  - Cálculo automático de subtotal, IGV y total
- **Tipos de Documento**:
  - Boleta (03): Para consumidor final
  - Factura (01): Requiere selección de cliente con RUC
- **Métodos de Pago**:
  - Múltiples métodos de pago por venta
  - Efectivo, tarjeta, transferencia, Yape, etc.
- **Generación de Documentos**:
  - Procesamiento asíncrono
  - Polling automático para verificar estado
  - Descarga de PDF oficial

### 4. Transacciones de Efectivo
- **Ingreso de Efectivo (Cash In)**: Registro de ingresos adicionales
- **Retiro de Efectivo (Cash Out)**: Registro de retiros
- Vista previa del nuevo balance antes de confirmar

## 🏗️ Arquitectura

### Estructura de Archivos

```
src/
├── types/
│   └── pos.ts                    # Tipos TypeScript del módulo POS
├── services/
│   └── POSService.ts             # Servicio de API para POS
├── store/
│   └── pos.ts                    # Estado global con Zustand
├── screens/
│   └── POS/
│       ├── CashRegisterSelectionScreen.tsx
│       ├── POSDashboardScreen.tsx
│       ├── OpenSessionScreen.tsx
│       ├── CloseSessionScreen.tsx
│       ├── NewSaleScreen.tsx
│       ├── SaleDetailScreen.tsx
│       ├── CashTransactionScreen.tsx
│       └── index.ts
└── navigation/
    └── index.tsx                 # Navegación integrada
```

### Flujo de Navegación

```
Login → Selección Empresa → Selección Sede → Selección Caja → Dashboard POS
                                                                      ↓
                                                    ┌─────────────────┴─────────────────┐
                                                    ↓                                   ↓
                                            Abrir Sesión                        (Sin sesión activa)
                                                    ↓
                                            ┌───────┴───────┐
                                            ↓               ↓
                                      Nueva Venta    Transacciones
                                            ↓               ↓
                                      Detalle Venta   Cash In/Out
                                                            ↓
                                                    Cerrar Sesión
```

## 🔌 Integración con Backend

### Endpoints Utilizados

#### Cajas Registradoras
- `GET /api/pos/cash-registers/site/:siteId` - Listar cajas por sede
- `GET /api/pos/cash-registers/payment-methods` - Listar métodos de pago

#### Sesiones
- `POST /api/pos/sessions/open` - Abrir sesión
- `GET /api/pos/sessions/active/:cashRegisterId` - Obtener sesión activa
- `GET /api/pos/sessions/:sessionId/summary` - Obtener resumen de sesión
- `POST /api/pos/sessions/:sessionId/close` - Cerrar sesión

#### Transacciones
- `POST /api/pos/transactions/cash-in` - Registrar ingreso
- `POST /api/pos/transactions/cash-out` - Registrar retiro

#### Ventas
- `POST /api/pos/sales/:sessionId` - Crear venta
- `GET /api/pos/sales/info/:saleId` - Consultar estado de venta
- `GET /api/sales/:saleId/documents/:documentId/pdf` - Descargar PDF

#### Productos y Clientes
- `GET /api/products/search?q=query` - Buscar productos
- `GET /api/customers/search?q=query` - Buscar clientes

## 💾 Gestión de Estado

### Store Principal (Zustand)

```typescript
interface POSState {
  // Estado actual
  selectedCashRegister: CashRegister | null;
  currentSession: Session | null;
  paymentMethods: PaymentMethod[];

  // Carrito
  cartItems: SaleItem[];
  cartPayments: SalePayment[];

  // Acciones
  openSession: (cashRegisterId, userId, openingBalance, notes?) => Promise<Session>;
  closeSession: (sessionId, closingBalance, notes?) => Promise<Session>;
  createSale: (customerId?, documentType?, notes?) => Promise<{saleId, message}>;
  // ... más acciones
}
```

### Persistencia

- **Caja Seleccionada**: AsyncStorage (`@caja:selected_cash_register`)
- **Sesión Activa**: Se carga desde el servidor al seleccionar caja
- **Carrito**: Solo en memoria (se limpia al completar venta)

## 🎨 Diseño UI

### Principios de Diseño

1. **Optimizado para Desktop**: Diseño horizontal para pantallas grandes
2. **Información Clara**: Visualización prominente de balances y totales
3. **Feedback Visual**: Estados claros (abierto/cerrado, procesando/completado)
4. **Confirmaciones**: Alertas antes de acciones críticas (abrir/cerrar sesión)

### Paleta de Colores

- **Primario**: `#007AFF` (Azul) - Acciones principales
- **Éxito**: `#4CAF50` (Verde) - Ventas, sesión abierta
- **Advertencia**: `#FF9800` (Naranja) - Transacciones, procesando
- **Peligro**: `#F44336` (Rojo) - Cerrar sesión, eliminar
- **Neutral**: `#9E9E9E` (Gris) - Sesión cerrada, inactivo

## 🔄 Flujo de Trabajo Diario

### 1. Inicio del Día

```
1. Login → Seleccionar Empresa → Seleccionar Sede → Seleccionar Caja
2. Dashboard muestra "No hay sesión activa"
3. Click en "Abrir Caja"
4. Ingresar balance inicial (ej: S/ 200.00)
5. Confirmar apertura
```

### 2. Durante el Día

```
VENTAS:
1. Click en "Nueva Venta"
2. Buscar y agregar productos al carrito
3. Seleccionar tipo de documento (Boleta/Factura)
4. Si es Factura, seleccionar cliente
5. Click en "Procesar Venta"
6. Seleccionar métodos de pago
7. Confirmar venta
8. Esperar generación de documento
9. Descargar PDF

TRANSACCIONES:
- Ingreso: Click en "Ingreso" → Ingresar monto y motivo
- Retiro: Click en "Retiro" → Ingresar monto y motivo
```

### 3. Fin del Día

```
1. Click en "Cerrar Caja"
2. Revisar resumen del día:
   - Balance inicial
   - Total ventas
   - Ingresos
   - Retiros
   - Balance esperado
3. Contar efectivo e ingresar balance real
4. Sistema calcula diferencia automáticamente
5. Confirmar cierre
```

## 🔒 Validaciones

### Apertura de Sesión
- ✅ Caja debe existir y estar activa
- ✅ No debe haber sesión abierta en la caja
- ✅ Balance de apertura >= 0

### Crear Venta
- ✅ Sesión debe estar abierta
- ✅ Carrito no puede estar vacío
- ✅ Productos deben tener stock
- ✅ Total de pagos = Total de venta
- ✅ Factura requiere cliente con RUC

### Cierre de Sesión
- ✅ Sesión debe estar abierta
- ✅ Balance de cierre >= 0
- ✅ Se registra diferencia automáticamente

## 📱 Características Técnicas

### Optimizaciones

1. **Polling Inteligente**:
   - Verifica estado de documentos cada 5 segundos
   - Se detiene automáticamente cuando el documento está listo
   - Timeout de 2 minutos

2. **Actualización Automática**:
   - Sesión se actualiza cada 30 segundos en el dashboard
   - Balance se actualiza después de cada transacción

3. **Manejo de Errores**:
   - Mensajes claros y específicos
   - Reintentos automáticos en caso de fallo de red
   - Validaciones en frontend y backend

### Compatibilidad

- ✅ React Native / Expo
- ✅ TypeScript
- ✅ Zustand para estado global
- ✅ React Navigation
- ✅ AsyncStorage para persistencia

## 🚀 Próximas Mejoras

- [ ] Historial de ventas del día
- [ ] Reportes de cierre de caja
- [ ] Búsqueda de productos por código de barras
- [ ] Impresión de tickets
- [ ] Modo offline con sincronización
- [ ] Descuentos por producto
- [ ] Notas de crédito
- [ ] Múltiples cajas simultáneas

## 📞 Soporte

Para dudas o problemas:
1. Revisar logs del servidor
2. Verificar conectividad con el backend
3. Consultar documentación del API en Swagger UI

---

**Versión**: 1.0.0
**Última actualización**: Enero 2025
