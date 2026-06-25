# 🏧 PLAN DE INTEGRACIÓN - PinPad Verifone P400

---

## ✅ ESTADO ACTUAL (Actualizado: 11/04/2026)

### Infraestructura Completada
| Componente | Estado | Detalles |
|------------|--------|----------|
| Gateway Instalado | ✅ | `C:\Program Files (x86)\Caja Windows APIREST - PinPad - 6.4\` |
| Servicio HGATEWAY | ✅ | Puerto 4137 escuchando |
| Servicio HGATEWAY_API_REST | ✅ | Puerto 9090 funcionando |
| Java (Temurin 25) | ✅ | Instalado y configurado en PATH |
| Drivers Verifone | ✅ | PinPad detectado en COM9 |
| Login API | ✅ | `POST /API_PPAD/login` funciona |
| Test Conexión | ✅ | `POST /API_PPAD/test` → `response_code: "00"` |
| TypeScript Types | ✅ | `src/types/pinpad.ts` creado |
| PinPadService | ✅ | `src/services/PinPadService.ts` creado |
| Zustand Store | ✅ | `src/store/pinpad.ts` creado |

### 🎉 Comunicación Verificada
```
✅ API REST (9090) → Gateway (4137) → COM9 → PinPad P400
   ¡CONEXIÓN EXITOSA! El PinPad responde correctamente.
```

### ✅ RESUELTO: Comercio Registrado
El PinPad **ya responde a comandos** correctamente.
- Test de conexión: `response_code: "00"` (APROBADO)

### Configuración Corregida
- ✅ Archivo `ptotcpsch001.xml`: Corregido `Tipo="TCP"` → `tipo="TCP"`
- ✅ Conflicto COM9 Bluetooth: Resuelto (dispositivo deshabilitado)
- ✅ Java instalado: Temurin JDK 25.0.2 en PATH

### Credenciales API REST
```json
{
  "ecr_usuario": "izipay",
  "ecr_password": "izipay"
}
```
- **IMPORTANTE**: Los campos son `ecr_usuario` y `ecr_password` (no `usuario`/`password`)
- Token JWT: Se obtiene con `POST /API_PPAD/login`
- Token válido por 12 horas (43200 segundos)

### Endpoints Disponibles
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/API_PPAD/login` | POST | Obtener token JWT |
| `/API_PPAD/test` | POST | Probar conexión con PinPad |
| `/API_PPAD/procesarTransaccion` | POST | Procesar transacciones |
| `/v2/api-docs` | GET | Documentación Swagger |

### Comandos para Iniciar Servicios
```powershell
# Iniciar servicios (requiere Admin)
net start HGATEWAY
net start HGATEWAY_API_REST

# Verificar estado
Get-Service -Name "HGATEWAY", "HGATEWAY_API_REST"
```

### Próximos Pasos
1. ✅ ~~Registrar comercio en QA con Izipay~~ (COMPLETADO)
2. ✅ ~~Probar `/API_PPAD/test` exitosamente~~ (COMPLETADO)
3. ⏳ Probar compra con `/API_PPAD/procesarTransaccion`
4. ✅ ~~Integrar en flujo de pagos de CajaGrit~~ (COMPLETADO)
5. ⏳ Configurar Electron IPC handlers
6. ⏳ Actualizar instalador NSIS

### ✅ Integración en Flujo de Pagos (11/04/2026)
- **El método de pago IZIPAY ahora usa el PinPad Verifone P400**
- Cuando el usuario selecciona Izipay, se activa automáticamente el flujo del PinPad
- Archivos modificados:
  - `src/screens/POS/NewSaleScreen.tsx` - Flujo de pago con PinPad
  - `src/types/pos.ts` - `isIzipay` indica pago con tarjeta via PinPad
- El PinPad muestra modal con estado de la transacción
- Soporta: conexión automática, proceso de venta, manejo de errores

### ⚠️ Pendiente: Configuración Host Izipay (11/04/2026)
**Estado**: La integración técnica está completa, pero las transacciones de prueba son rechazadas por el host.

**Respuesta del Host:**
```json
{
  "resp_host": "77",
  "response_code": "89",
  "message": "RESERVADO",
  "merchant_id": "29999979",
  "card": "529206******7935"
}
```

**Código 89** = Error de seguridad (según documentación Izipay)

**Acción requerida**: Contactar a Izipay para:
1. Verificar que el merchant `29999979` esté habilitado para pruebas
2. Confirmar que la tarjeta de prueba `529206******7935` esté vinculada
3. Solicitar información sobre `resp_host: 77`

---

## 📋 Resumen Ejecutivo

Este documento detalla el plan completo para integrar el PinPad Verifone P400 con la aplicación CajaGrit, siguiendo el modelo ya implementado con Izipay pero con comunicación directa al dispositivo físico.

**Objetivo**: Permitir pagos con tarjeta de crédito/débito directamente desde el PinPad P400, con instalación automática de componentes y configuración desde la aplicación.

---

## 🏗️ ARQUITECTURA DE LA SOLUCIÓN

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARQUITECTURA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐     HTTP      ┌──────────────────┐     USB/COM        │
│  │                  │    REST       │                  │                    │
│  │   CajaGrit App   │ ───────────►  │  Gateway P400    │ ───────────────►   │
│  │   (Electron)     │               │  (localhost)     │                    │
│  │                  │ ◄───────────  │                  │ ◄───────────────   │
│  └──────────────────┘   JSON        └──────────────────┘    Serial          │
│          │                                   │                     │        │
│          │                                   │              ┌──────▼──────┐ │
│          ▼                                   ▼              │   PinPad    │ │
│  ┌──────────────────┐             ┌──────────────────┐      │  P400       │ │
│  │  PinPadService   │             │  Windows Service │      │  (Verifone) │ │
│  │  (TypeScript)    │             │  (Java Runtime)  │      └─────────────┘ │
│  └──────────────────┘             └──────────────────┘                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 COMPONENTES A EMPAQUETAR

| Componente | Tamaño Aprox. | Instalación |
|------------|---------------|-------------|
| Gateway Desarrollo | ~15 MB | Automática con app |
| Gateway Producción | ~15 MB | Automática con app |
| JRE Portable 32-bit | ~60 MB | Automática con app |
| Drivers Verifone | ~25 MB | Manual con UAC |
| **Total** | **~115 MB** | |

---

## 📅 FASES DE IMPLEMENTACIÓN

### FASE 1: Preparación de Componentes (1-2 horas)
### FASE 2: Servicio PinPad en TypeScript (2-3 horas)
### FASE 3: Integración con Electron (1-2 horas)
### FASE 4: UI de Configuración (2-3 horas)
### FASE 5: Integración con Flujo de Pagos (2-3 horas)
### FASE 6: Instalador y Distribución (1-2 horas)
### FASE 7: Pruebas y Certificación (Variable)

**Total Estimado: 10-16 horas de desarrollo**

---

## 📁 FASE 1: Preparación de Componentes

### 1.1 Crear Estructura de Carpetas

```
C:/Users/Aaron/IdeaProjects/caja-frontend-joanis/
├── pinpad-gateway/                          # ← CREAR
│   ├── desarrollo/
│   │   └── CajaWindowsPinPadApiRest.exe
│   ├── produccion/
│   │   └── CajaWindowsPinPadApiRest.exe
│   ├── jre/                                 # JRE 1.8 32-bit portable
│   │   └── bin/
│   │       └── java.exe
│   ├── drivers/
│   │   └── VerifoneUnifiedDriverInstaller.exe
│   └── config/
│       └── gateway.properties
```

### 1.2 Comandos para Preparar

```powershell
# Crear estructura de carpetas
$basePath = "C:\Users\Aaron\IdeaProjects\caja-frontend-joanis\pinpad-gateway"
New-Item -ItemType Directory -Force -Path "$basePath\desarrollo"
New-Item -ItemType Directory -Force -Path "$basePath\produccion"
New-Item -ItemType Directory -Force -Path "$basePath\drivers"
New-Item -ItemType Directory -Force -Path "$basePath\config"
New-Item -ItemType Directory -Force -Path "$basePath\jre"

# Copiar archivos del CD de integración
$cdPath = "C:\Users\Aaron\IdeaProjects\caja-frontend-joanis\temp_integracion\CD INTEGRACION PPD P400 API REST ( Window´s)"

Copy-Item "$cdPath\CajaWindowsPinPadApiRest-1_0_0_2_Desarrollo.exe" "$basePath\desarrollo\gateway.exe"
Copy-Item "$cdPath\CajaWindowsPinPadApiRest-1_0_0_2_Producción.exe" "$basePath\produccion\gateway.exe"

# Extraer drivers
Expand-Archive "$cdPath\VerifoneUnifiedDriverInstaller-5.0.5.2-B4 -  Win11.zip" "$basePath\drivers" -Force
```

### 1.3 Descargar JRE Portable

Descargar de: https://www.oracle.com/java/technologies/javase/javase8-archive-downloads.html
- Versión: JRE 8u202 Windows x86 (32-bit)
- Extraer en: `pinpad-gateway/jre/`

---

## 🔧 FASE 2: Servicio PinPad en TypeScript

### 2.1 Crear Tipos (`src/types/pinpad.ts`)

```typescript
/**
 * PinPad Types - Verifone P400 API REST
 * Basado en PMP-API Rest_Especificaciones_Tecnicas_v2_3.pdf
 */

// ============ CONFIGURACIÓN ============

export interface PinPadConfig {
  environment: 'DESARROLLO' | 'PRODUCCION';
  gatewayHost: string;      // localhost
  gatewayPort: number;      // 8090 default
  timeout: number;          // ms
  commerceCode: string;     // Código de comercio (6 dígitos para clave)
  autoStartGateway: boolean;
}

export const DEFAULT_PINPAD_CONFIG: PinPadConfig = {
  environment: 'DESARROLLO',
  gatewayHost: 'localhost',
  gatewayPort: 8090,
  timeout: 120000,  // 2 minutos (transacciones pueden tardar)
  commerceCode: '',
  autoStartGateway: true,
};

// ============ ESTADOS ============

export type PinPadConnectionStatus =
  | 'DISCONNECTED'      // Gateway no iniciado
  | 'CONNECTING'        // Intentando conectar
  | 'GATEWAY_READY'     // Gateway OK, PinPad no detectado
  | 'PINPAD_READY'      // Todo listo para transacciones
  | 'BUSY'              // Procesando transacción
  | 'ERROR';            // Error de conexión

export type TransactionStatus =
  | 'PENDING'           // Esperando respuesta del PinPad
  | 'CARD_READING'      // Leyendo tarjeta
  | 'PIN_ENTRY'         // Ingresando PIN
  | 'PROCESSING'        // Procesando en Host
  | 'APPROVED'          // Aprobada
  | 'DECLINED'          // Rechazada
  | 'CANCELLED'         // Cancelada por usuario
  | 'TIMEOUT'           // Timeout
  | 'ERROR';            // Error

// ============ TRANSACCIONES ============

export type TransactionType =
  | 'TEST'              // 00 - Prueba de conectividad
  | 'SALE'              // 01 - Venta
  | 'SALE_WITH_BIN'     // 02 - Venta con BIN
  | 'VOID'              // 03 - Anulación
  | 'REPRINT'           // 04 - Reimpresión
  | 'DETAIL_REPORT'     // 05 - Reporte detallado
  | 'TOTALS_REPORT'     // 06 - Reporte de totales
  | 'CLOSE_BATCH';      // 07 - Cierre de lote

export type CardReadType =
  | 'CHIP'              // Lectura con chip
  | 'CONTACTLESS'       // CTLS / NFC
  | 'SWIPE';            // Banda magnética

// ============ REQUEST/RESPONSE ============

export interface PinPadRequest {
  transactionType: TransactionType;
  amountCents?: number;           // Monto en centavos
  ticketNumber?: string;          // Número de ticket para anulación/reimpresión
  originalTransactionId?: string; // ID transacción original para anulación
}

export interface PinPadResponse {
  success: boolean;
  transactionId?: string;         // ID único de la transacción
  authorizationCode?: string;     // Código de autorización
  referenceNumber?: string;       // Número de referencia

  // Datos de tarjeta (enmascarados)
  cardBrand?: string;             // VISA, MASTERCARD, etc.
  cardType?: string;              // CREDITO, DEBITO
  cardLastFour?: string;          // Últimos 4 dígitos
  cardBin?: string;               // BIN (solo si se solicitó)
  cardReadType?: CardReadType;    // Tipo de lectura

  // Respuesta del host
  responseCode?: string;          // Código de respuesta (00 = aprobado)
  responseMessage?: string;       // Mensaje de respuesta
  hostMessage?: string;           // Mensaje del host

  // Datos para impresión
  printData?: PinPadPrintData;    // Datos del voucher

  // Premiación/Promociones
  promotionMessage?: string;      // Mensaje de premiación
  multiResponseData?: string[];   // Datos de multirespuesta

  // Errores
  errorCode?: string;
  errorMessage?: string;

  // Metadata
  transactionDate?: string;
  transactionTime?: string;
  terminalId?: string;
  merchantId?: string;
}

export interface PinPadPrintData {
  merchantCopy: string[];         // Líneas para copia comercio
  customerCopy: string[];         // Líneas para copia cliente
  additionalLines?: string[];     // Líneas adicionales (premiación, etc.)
}

// ============ CIERRE DE LOTE ============

export interface BatchCloseResult {
  success: boolean;
  batchNumber?: string;
  totalTransactions?: number;
  totalAmountCents?: number;
  visaCount?: number;
  visaAmountCents?: number;
  mastercardCount?: number;
  mastercardAmountCents?: number;
  otherCount?: number;
  otherAmountCents?: number;
  closeDate?: string;
  closeTime?: string;
  hostMessage?: string;
}

// ============ REPORTES ============

export interface TransactionDetail {
  transactionId: string;
  transactionType: 'SALE' | 'VOID';
  amountCents: number;
  cardBrand: string;
  cardLastFour: string;
  authorizationCode: string;
  transactionDate: string;
  transactionTime: string;
  status: 'APPROVED' | 'VOIDED';
}

export interface BatchReport {
  reportType: 'DETAIL' | 'TOTALS';
  batchNumber: string;
  transactions?: TransactionDetail[];  // Solo en DETAIL
  totals?: {
    totalCount: number;
    totalAmountCents: number;
    byBrand: {
      [brand: string]: {
        count: number;
        amountCents: number;
      };
    };
  };
  generatedAt: string;
}

// ============ EVENTOS ============

export interface PinPadEvent {
  type:
    | 'STATUS_CHANGE'       // Cambio de estado de conexión
    | 'TRANSACTION_UPDATE'  // Actualización durante transacción
    | 'DISPLAY_MESSAGE'     // Mensaje para mostrar al usuario
    | 'CARD_INSERTED'       // Tarjeta insertada
    | 'CARD_REMOVED'        // Tarjeta retirada
    | 'PIN_REQUIRED'        // Se requiere PIN
    | 'PROCESSING'          // Procesando
    | 'PRINT_REQUIRED';     // Imprimir voucher

  data: any;
  timestamp: string;
}

// ============ ESTADO DEL STORE ============

export interface PinPadState {
  // Configuración
  config: PinPadConfig;

  // Estado de conexión
  connectionStatus: PinPadConnectionStatus;
  gatewayRunning: boolean;
  pinpadDetected: boolean;
  pinpadSerialNumber?: string;
  pinpadModel?: string;
  driverVersion?: string;

  // Instalación
  driversInstalled: boolean;
  gatewayInstalled: boolean;
  jreInstalled: boolean;

  // Transacción actual
  currentTransaction?: {
    id: string;
    type: TransactionType;
    status: TransactionStatus;
    startedAt: string;
    amountCents?: number;
    displayMessage?: string;
  };

  // Último resultado
  lastTransactionResult?: PinPadResponse;

  // Historial del día (para cierre)
  todayTransactions: TransactionDetail[];

  // Errores
  lastError?: string;
  lastErrorAt?: string;
}

// ============ CÓDIGOS DE RESPUESTA ============

export const RESPONSE_CODES: { [code: string]: string } = {
  '00': 'APROBADA',
  '01': 'REFERIR AL EMISOR',
  '02': 'REFERIR AL EMISOR',
  '03': 'COMERCIO INVÁLIDO',
  '04': 'RETENER TARJETA',
  '05': 'DENEGADA',
  '06': 'ERROR',
  '07': 'RETENER TARJETA',
  '12': 'TRANSACCIÓN INVÁLIDA',
  '13': 'MONTO INVÁLIDO',
  '14': 'TARJETA INVÁLIDA',
  '19': 'REINTENTAR',
  '25': 'NO SE ENCUENTRA',
  '30': 'ERROR DE FORMATO',
  '41': 'TARJETA PERDIDA',
  '43': 'TARJETA ROBADA',
  '51': 'FONDOS INSUFICIENTES',
  '54': 'TARJETA VENCIDA',
  '55': 'PIN INCORRECTO',
  '57': 'TRANSACCIÓN NO PERMITIDA',
  '58': 'TRANSACCIÓN NO PERMITIDA',
  '61': 'EXCEDE LÍMITE',
  '62': 'TARJETA RESTRINGIDA',
  '63': 'VIOLACIÓN DE SEGURIDAD',
  '65': 'EXCEDE LÍMITE DE FRECUENCIA',
  '75': 'PIN BLOQUEADO',
  '76': 'NO EXISTE CUENTA',
  '77': 'CUENTA INCORRECTA',
  '78': 'CUENTA INEXISTENTE',
  '80': 'ERROR DE RED',
  '81': 'PIN INVÁLIDO',
  '82': 'ERROR CVV',
  '83': 'NO SE PUEDE VERIFICAR PIN',
  '84': 'PIN INVÁLIDO',
  '85': 'RECHAZADA POR CVV',
  '86': 'NO SE PUEDE VERIFICAR PIN',
  '89': 'RECHAZADA',
  '91': 'EMISOR NO DISPONIBLE',
  '94': 'DUPLICADA',
  '96': 'ERROR DE SISTEMA',
  'TO': 'TIMEOUT',
  'CE': 'ERROR DE CONEXIÓN',
};

// ============ MONTOS DE PRUEBA ============

export const TEST_AMOUNTS = {
  // Aprobadas
  APPROVED_VISA_MAX: 1099,        // <= S/ 10.99 Visa
  APPROVED_MC_MIN: 1100,          // > S/ 11.00 Mastercard
  APPROVED_MC_MAX: 2000,          // <= S/ 20.00 Mastercard

  // Premiación
  PROMOTION_MIN: 2001,            // >= S/ 20.01
  PROMOTION_MAX: 5000,            // <= S/ 50.00

  // Rechazadas
  DECLINED_MIN: 5001,             // >= S/ 50.01
  DECLINED_MAX: 5500,             // <= S/ 55.00

  // Emisor no responde
  NO_RESPONSE_MIN: 5501,          // >= S/ 55.01
  NO_RESPONSE_MAX: 6000,          // <= S/ 60.00

  // Multirespuesta
  MULTI_VISA_MIN: 6000,           // >= S/ 60.00 Visa
  MULTI_VISA_MAX: 7999,           // <= S/ 79.99 Visa
  MULTI_MC_MIN: 8000,             // >= S/ 80.00 Mastercard
  MULTI_MC_MAX: 9999,             // <= S/ 99.99 Mastercard
};
```

### 2.2 Crear Servicio (`src/services/PinPadService.ts`)

```typescript
/**
 * PinPad Service
 * Comunicación con Gateway API REST del PinPad Verifone P400
 */

import type {
  PinPadConfig,
  PinPadResponse,
  PinPadRequest,
  TransactionType,
  PinPadConnectionStatus,
  BatchCloseResult,
  BatchReport,
  RESPONSE_CODES,
} from '@/types/pinpad';

class PinPadServiceClass {
  private config: PinPadConfig | null = null;
  private baseUrl: string = '';
  private isElectron: boolean = false;

  constructor() {
    // Detectar si estamos en Electron
    this.isElectron = !!(window as any).electronAPI;
  }

  /**
   * Inicializar el servicio con configuración
   */
  initialize(config: PinPadConfig): void {
    this.config = config;
    this.baseUrl = `http://${config.gatewayHost}:${config.gatewayPort}`;
    console.log('[PinPad] Servicio inicializado:', this.baseUrl);
  }

  /**
   * Verificar si el servicio está configurado
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  // ============ GESTIÓN DEL GATEWAY ============

  /**
   * Iniciar el Gateway (solo funciona en Electron)
   */
  async startGateway(): Promise<boolean> {
    if (!this.isElectron) {
      console.warn('[PinPad] startGateway solo disponible en Electron');
      return false;
    }

    try {
      const result = await (window as any).electronAPI.startPinPadGateway(
        this.config?.environment || 'DESARROLLO'
      );
      console.log('[PinPad] Gateway iniciado:', result);
      return result.success;
    } catch (error) {
      console.error('[PinPad] Error iniciando Gateway:', error);
      return false;
    }
  }

  /**
   * Detener el Gateway
   */
  async stopGateway(): Promise<boolean> {
    if (!this.isElectron) return false;

    try {
      const result = await (window as any).electronAPI.stopPinPadGateway();
      return result.success;
    } catch (error) {
      console.error('[PinPad] Error deteniendo Gateway:', error);
      return false;
    }
  }

  /**
   * Verificar estado del Gateway
   */
  async checkGatewayStatus(): Promise<PinPadConnectionStatus> {
    try {
      const response = await this.sendRequest('TEST');

      if (response.success) {
        return 'PINPAD_READY';
      } else if (response.errorCode === 'PINPAD_NOT_FOUND') {
        return 'GATEWAY_READY';
      } else {
        return 'ERROR';
      }
    } catch (error) {
      return 'DISCONNECTED';
    }
  }

  // ============ TRANSACCIONES ============

  /**
   * Realizar transacción de prueba (TEST)
   */
  async testConnection(): Promise<PinPadResponse> {
    return this.sendRequest('TEST');
  }

  /**
   * Realizar venta con tarjeta
   */
  async sale(amountCents: number, withBin: boolean = false): Promise<PinPadResponse> {
    const transactionType: TransactionType = withBin ? 'SALE_WITH_BIN' : 'SALE';

    return this.sendRequest(transactionType, {
      amountCents,
    });
  }

  /**
   * Anular transacción
   */
  async void(
    ticketNumber: string,
    originalTransactionId: string,
    amountCents: number
  ): Promise<PinPadResponse> {
    return this.sendRequest('VOID', {
      ticketNumber,
      originalTransactionId,
      amountCents,
    });
  }

  /**
   * Reimprimir voucher
   */
  async reprint(ticketNumber: string): Promise<PinPadResponse> {
    return this.sendRequest('REPRINT', {
      ticketNumber,
    });
  }

  /**
   * Obtener reporte detallado
   */
  async getDetailReport(): Promise<BatchReport> {
    const response = await this.sendRequest('DETAIL_REPORT');

    return {
      reportType: 'DETAIL',
      batchNumber: response.referenceNumber || '',
      transactions: [], // Parsear de response
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Obtener reporte de totales
   */
  async getTotalsReport(): Promise<BatchReport> {
    const response = await this.sendRequest('TOTALS_REPORT');

    return {
      reportType: 'TOTALS',
      batchNumber: response.referenceNumber || '',
      totals: {
        totalCount: 0, // Parsear de response
        totalAmountCents: 0,
        byBrand: {},
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Realizar cierre de lote
   */
  async closeBatch(): Promise<BatchCloseResult> {
    const response = await this.sendRequest('CLOSE_BATCH');

    return {
      success: response.success,
      batchNumber: response.referenceNumber,
      hostMessage: response.hostMessage,
      closeDate: response.transactionDate,
      closeTime: response.transactionTime,
    };
  }

  // ============ COMUNICACIÓN HTTP ============

  /**
   * Enviar request al Gateway
   */
  private async sendRequest(
    transactionType: TransactionType,
    data?: Partial<PinPadRequest>
  ): Promise<PinPadResponse> {
    if (!this.config) {
      throw new Error('PinPad Service no inicializado');
    }

    const request: PinPadRequest = {
      transactionType,
      ...data,
    };

    console.log(`[PinPad] Enviando ${transactionType}:`, request);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout
      );

      // Construir body según especificaciones del Gateway
      const body = this.buildRequestBody(request);

      const response = await fetch(`${this.baseUrl}/api/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return this.parseResponse(result);

    } catch (error: any) {
      console.error(`[PinPad] Error en ${transactionType}:`, error);

      if (error.name === 'AbortError') {
        return {
          success: false,
          errorCode: 'TO',
          errorMessage: 'Timeout: No se recibió respuesta del PinPad',
        };
      }

      return {
        success: false,
        errorCode: 'CE',
        errorMessage: error.message || 'Error de conexión con el Gateway',
      };
    }
  }

  /**
   * Construir body del request según especificaciones
   */
  private buildRequestBody(request: PinPadRequest): any {
    // TODO: Implementar según PMP-API Rest_Especificaciones_Tecnicas_v2_3.pdf
    // Este formato dependerá de las especificaciones exactas del Gateway

    const body: any = {
      operationType: this.getOperationCode(request.transactionType),
    };

    if (request.amountCents !== undefined) {
      // El Gateway puede requerir el monto en formato específico
      body.amount = request.amountCents;
    }

    if (request.ticketNumber) {
      body.ticketNumber = request.ticketNumber;
    }

    if (request.originalTransactionId) {
      body.originalTransactionId = request.originalTransactionId;
    }

    return body;
  }

  /**
   * Obtener código de operación según especificaciones
   */
  private getOperationCode(type: TransactionType): string {
    const codes: { [key in TransactionType]: string } = {
      'TEST': '00',
      'SALE': '01',
      'SALE_WITH_BIN': '02',
      'VOID': '03',
      'REPRINT': '04',
      'DETAIL_REPORT': '05',
      'TOTALS_REPORT': '06',
      'CLOSE_BATCH': '07',
    };
    return codes[type];
  }

  /**
   * Parsear respuesta del Gateway
   */
  private parseResponse(raw: any): PinPadResponse {
    // TODO: Implementar según formato real de respuesta del Gateway
    // Esto dependerá de las especificaciones exactas

    const responseCode = raw.responseCode || raw.codigo || '';
    const isApproved = responseCode === '00';

    return {
      success: isApproved,
      transactionId: raw.transactionId || raw.idTransaccion,
      authorizationCode: raw.authorizationCode || raw.codigoAutorizacion,
      referenceNumber: raw.referenceNumber || raw.numeroReferencia,

      cardBrand: raw.cardBrand || raw.marca,
      cardType: raw.cardType || raw.tipoTarjeta,
      cardLastFour: raw.cardLastFour || raw.ultimos4,
      cardBin: raw.cardBin || raw.bin,
      cardReadType: raw.cardReadType || raw.tipoLectura,

      responseCode,
      responseMessage: RESPONSE_CODES[responseCode] || raw.responseMessage || raw.mensaje,
      hostMessage: raw.hostMessage || raw.mensajeHost,

      printData: raw.printData ? {
        merchantCopy: raw.printData.merchantCopy || [],
        customerCopy: raw.printData.customerCopy || [],
        additionalLines: raw.printData.additionalLines || [],
      } : undefined,

      promotionMessage: raw.promotionMessage || raw.mensajePromocion,

      transactionDate: raw.transactionDate || raw.fecha,
      transactionTime: raw.transactionTime || raw.hora,
      terminalId: raw.terminalId || raw.terminal,
      merchantId: raw.merchantId || raw.comercio,

      errorCode: isApproved ? undefined : responseCode,
      errorMessage: isApproved ? undefined : (RESPONSE_CODES[responseCode] || raw.mensaje),
    };
  }

  // ============ INSTALACIÓN ============

  /**
   * Verificar si los drivers están instalados
   */
  async checkDriversInstalled(): Promise<boolean> {
    if (!this.isElectron) return false;

    try {
      const result = await (window as any).electronAPI.checkPinPadDrivers();
      return result.installed;
    } catch {
      return false;
    }
  }

  /**
   * Instalar drivers (requiere UAC)
   */
  async installDrivers(): Promise<boolean> {
    if (!this.isElectron) {
      console.warn('[PinPad] installDrivers solo disponible en Electron');
      return false;
    }

    try {
      const result = await (window as any).electronAPI.installPinPadDrivers();
      return result.success;
    } catch (error) {
      console.error('[PinPad] Error instalando drivers:', error);
      return false;
    }
  }

  /**
   * Abrir carpeta de configuración del Gateway
   */
  async openConfigFolder(): Promise<void> {
    if (!this.isElectron) return;

    try {
      await (window as any).electronAPI.openPinPadConfigFolder();
    } catch (error) {
      console.error('[PinPad] Error abriendo carpeta:', error);
    }
  }
}

// Singleton
export const pinPadService = new PinPadServiceClass();
export default pinPadService;
```

### 2.3 Crear Store (`src/store/pinpad.ts`)

```typescript
/**
 * PinPad Store
 * Estado global para el PinPad usando Zustand
 */

import { create } from 'zustand';
import { pinPadService } from '@/services/PinPadService';
import type {
  PinPadConfig,
  PinPadState,
  PinPadConnectionStatus,
  PinPadResponse,
  TransactionType,
  TransactionDetail,
  BatchCloseResult,
  DEFAULT_PINPAD_CONFIG,
} from '@/types/pinpad';

interface PinPadStoreActions {
  // Configuración
  setConfig: (config: Partial<PinPadConfig>) => void;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;

  // Gateway
  startGateway: () => Promise<boolean>;
  stopGateway: () => Promise<boolean>;
  checkStatus: () => Promise<PinPadConnectionStatus>;

  // Transacciones
  testConnection: () => Promise<PinPadResponse>;
  processSale: (amountCents: number, withBin?: boolean) => Promise<PinPadResponse>;
  processVoid: (ticketNumber: string, transactionId: string, amountCents: number) => Promise<PinPadResponse>;
  closeBatch: () => Promise<BatchCloseResult>;

  // Instalación
  checkInstallation: () => Promise<void>;
  installDrivers: () => Promise<boolean>;

  // Estado
  setConnectionStatus: (status: PinPadConnectionStatus) => void;
  clearError: () => void;
  reset: () => void;
}

type PinPadStore = PinPadState & PinPadStoreActions;

const STORAGE_KEY = '@caja:pinpad_config';

export const usePinPadStore = create<PinPadStore>((set, get) => ({
  // Estado inicial
  config: { ...DEFAULT_PINPAD_CONFIG },
  connectionStatus: 'DISCONNECTED',
  gatewayRunning: false,
  pinpadDetected: false,
  driversInstalled: false,
  gatewayInstalled: false,
  jreInstalled: false,
  todayTransactions: [],

  // ============ CONFIGURACIÓN ============

  setConfig: (partialConfig) => {
    const currentConfig = get().config;
    const newConfig = { ...currentConfig, ...partialConfig };
    set({ config: newConfig });

    // Reinicializar servicio con nueva config
    pinPadService.initialize(newConfig);
  },

  loadConfig: async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored) as PinPadConfig;
        set({ config });
        pinPadService.initialize(config);
      }
    } catch (error) {
      console.error('[PinPad Store] Error cargando config:', error);
    }
  },

  saveConfig: async () => {
    try {
      const { config } = get();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      console.log('[PinPad Store] Configuración guardada');
    } catch (error) {
      console.error('[PinPad Store] Error guardando config:', error);
    }
  },

  // ============ GATEWAY ============

  startGateway: async () => {
    set({ connectionStatus: 'CONNECTING' });

    try {
      const success = await pinPadService.startGateway();

      if (success) {
        set({ gatewayRunning: true });

        // Verificar estado completo
        const status = await get().checkStatus();
        return status === 'PINPAD_READY' || status === 'GATEWAY_READY';
      }

      set({
        connectionStatus: 'ERROR',
        lastError: 'No se pudo iniciar el Gateway',
        lastErrorAt: new Date().toISOString(),
      });
      return false;
    } catch (error) {
      set({
        connectionStatus: 'ERROR',
        lastError: error instanceof Error ? error.message : 'Error desconocido',
        lastErrorAt: new Date().toISOString(),
      });
      return false;
    }
  },

  stopGateway: async () => {
    try {
      const success = await pinPadService.stopGateway();
      set({
        gatewayRunning: false,
        connectionStatus: 'DISCONNECTED',
        pinpadDetected: false,
      });
      return success;
    } catch (error) {
      return false;
    }
  },

  checkStatus: async () => {
    try {
      const status = await pinPadService.checkGatewayStatus();

      set({
        connectionStatus: status,
        pinpadDetected: status === 'PINPAD_READY',
        gatewayRunning: status !== 'DISCONNECTED' && status !== 'ERROR',
      });

      return status;
    } catch (error) {
      set({ connectionStatus: 'ERROR' });
      return 'ERROR';
    }
  },

  // ============ TRANSACCIONES ============

  testConnection: async () => {
    set({
      connectionStatus: 'BUSY',
      currentTransaction: {
        id: `TEST-${Date.now()}`,
        type: 'TEST',
        status: 'PENDING',
        startedAt: new Date().toISOString(),
        displayMessage: 'Probando conexión...',
      },
    });

    try {
      const response = await pinPadService.testConnection();

      set({
        connectionStatus: response.success ? 'PINPAD_READY' : 'ERROR',
        pinpadDetected: response.success,
        currentTransaction: undefined,
        lastTransactionResult: response,
      });

      return response;
    } catch (error) {
      const errorResponse: PinPadResponse = {
        success: false,
        errorCode: 'CE',
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
      };

      set({
        connectionStatus: 'ERROR',
        currentTransaction: undefined,
        lastTransactionResult: errorResponse,
        lastError: errorResponse.errorMessage,
        lastErrorAt: new Date().toISOString(),
      });

      return errorResponse;
    }
  },

  processSale: async (amountCents, withBin = false) => {
    const transactionId = `SALE-${Date.now()}`;

    set({
      connectionStatus: 'BUSY',
      currentTransaction: {
        id: transactionId,
        type: withBin ? 'SALE_WITH_BIN' : 'SALE',
        status: 'PENDING',
        startedAt: new Date().toISOString(),
        amountCents,
        displayMessage: 'Esperando tarjeta...',
      },
    });

    try {
      const response = await pinPadService.sale(amountCents, withBin);

      // Agregar a transacciones del día si fue aprobada
      if (response.success) {
        const detail: TransactionDetail = {
          transactionId: response.transactionId || transactionId,
          transactionType: 'SALE',
          amountCents,
          cardBrand: response.cardBrand || 'UNKNOWN',
          cardLastFour: response.cardLastFour || '****',
          authorizationCode: response.authorizationCode || '',
          transactionDate: response.transactionDate || new Date().toISOString().split('T')[0],
          transactionTime: response.transactionTime || new Date().toISOString().split('T')[1].split('.')[0],
          status: 'APPROVED',
        };

        set((state) => ({
          todayTransactions: [...state.todayTransactions, detail],
        }));
      }

      set({
        connectionStatus: 'PINPAD_READY',
        currentTransaction: undefined,
        lastTransactionResult: response,
      });

      return response;
    } catch (error) {
      const errorResponse: PinPadResponse = {
        success: false,
        errorCode: 'CE',
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
      };

      set({
        connectionStatus: 'ERROR',
        currentTransaction: undefined,
        lastTransactionResult: errorResponse,
        lastError: errorResponse.errorMessage,
        lastErrorAt: new Date().toISOString(),
      });

      return errorResponse;
    }
  },

  processVoid: async (ticketNumber, transactionId, amountCents) => {
    set({
      connectionStatus: 'BUSY',
      currentTransaction: {
        id: `VOID-${Date.now()}`,
        type: 'VOID',
        status: 'PENDING',
        startedAt: new Date().toISOString(),
        amountCents,
        displayMessage: 'Procesando anulación...',
      },
    });

    try {
      const response = await pinPadService.void(ticketNumber, transactionId, amountCents);

      // Marcar transacción original como anulada
      if (response.success) {
        set((state) => ({
          todayTransactions: state.todayTransactions.map(t =>
            t.transactionId === transactionId
              ? { ...t, status: 'VOIDED' as const }
              : t
          ),
        }));
      }

      set({
        connectionStatus: 'PINPAD_READY',
        currentTransaction: undefined,
        lastTransactionResult: response,
      });

      return response;
    } catch (error) {
      const errorResponse: PinPadResponse = {
        success: false,
        errorCode: 'CE',
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
      };

      set({
        connectionStatus: 'ERROR',
        currentTransaction: undefined,
        lastTransactionResult: errorResponse,
      });

      return errorResponse;
    }
  },

  closeBatch: async () => {
    set({
      connectionStatus: 'BUSY',
      currentTransaction: {
        id: `CLOSE-${Date.now()}`,
        type: 'CLOSE_BATCH',
        status: 'PENDING',
        startedAt: new Date().toISOString(),
        displayMessage: 'Cerrando lote...',
      },
    });

    try {
      const result = await pinPadService.closeBatch();

      // Limpiar transacciones del día si fue exitoso
      if (result.success) {
        set({ todayTransactions: [] });
      }

      set({
        connectionStatus: 'PINPAD_READY',
        currentTransaction: undefined,
      });

      return result;
    } catch (error) {
      set({
        connectionStatus: 'ERROR',
        currentTransaction: undefined,
      });

      return {
        success: false,
        hostMessage: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  // ============ INSTALACIÓN ============

  checkInstallation: async () => {
    try {
      const driversInstalled = await pinPadService.checkDriversInstalled();

      // TODO: Verificar gateway y JRE
      const gatewayInstalled = true; // Se empaqueta con la app
      const jreInstalled = true; // Se empaqueta con la app

      set({
        driversInstalled,
        gatewayInstalled,
        jreInstalled,
      });
    } catch (error) {
      console.error('[PinPad Store] Error verificando instalación:', error);
    }
  },

  installDrivers: async () => {
    try {
      const success = await pinPadService.installDrivers();
      if (success) {
        set({ driversInstalled: true });
      }
      return success;
    } catch (error) {
      return false;
    }
  },

  // ============ ESTADO ============

  setConnectionStatus: (status) => {
    set({ connectionStatus: status });
  },

  clearError: () => {
    set({ lastError: undefined, lastErrorAt: undefined });
  },

  reset: () => {
    set({
      connectionStatus: 'DISCONNECTED',
      gatewayRunning: false,
      pinpadDetected: false,
      currentTransaction: undefined,
      lastTransactionResult: undefined,
      todayTransactions: [],
      lastError: undefined,
      lastErrorAt: undefined,
    });
  },
}));
```

---

## ⚡ FASE 3: Integración con Electron

### 3.1 Modificar `electron.js`

Agregar al final del archivo, antes de `app.on('ready', ...)`:

```javascript
// ===== HANDLERS IPC PARA PINPAD =====

const { spawn, exec } = require('child_process');

let pinpadGatewayProcess = null;

// Iniciar Gateway del PinPad
ipcMain.handle('start-pinpad-gateway', async (event, environment) => {
  try {
    console.log('[ELECTRON] 🏧 Iniciando Gateway PinPad:', environment);

    const gatewayPath = path.join(
      process.resourcesPath,
      'pinpad',
      environment === 'PRODUCCION' ? 'produccion' : 'desarrollo',
      'gateway.exe'
    );

    // Verificar que existe
    if (!fs.existsSync(gatewayPath)) {
      return { success: false, error: 'Gateway no encontrado: ' + gatewayPath };
    }

    // Si ya está corriendo, detenerlo primero
    if (pinpadGatewayProcess) {
      pinpadGatewayProcess.kill();
      pinpadGatewayProcess = null;
    }

    // Iniciar el Gateway
    pinpadGatewayProcess = spawn(gatewayPath, [], {
      detached: false,
      stdio: 'pipe',
      cwd: path.dirname(gatewayPath),
    });

    pinpadGatewayProcess.stdout.on('data', (data) => {
      console.log('[PINPAD GATEWAY]', data.toString());
    });

    pinpadGatewayProcess.stderr.on('data', (data) => {
      console.error('[PINPAD GATEWAY ERROR]', data.toString());
    });

    pinpadGatewayProcess.on('close', (code) => {
      console.log('[PINPAD GATEWAY] Proceso terminado con código:', code);
      pinpadGatewayProcess = null;
    });

    // Esperar un momento para que inicie
    await new Promise(resolve => setTimeout(resolve, 2000));

    return { success: true };
  } catch (error) {
    console.error('[ELECTRON] Error iniciando Gateway:', error);
    return { success: false, error: error.message };
  }
});

// Detener Gateway del PinPad
ipcMain.handle('stop-pinpad-gateway', async () => {
  try {
    if (pinpadGatewayProcess) {
      pinpadGatewayProcess.kill();
      pinpadGatewayProcess = null;
    }

    // También intentar matar por nombre
    exec('taskkill /F /IM gateway.exe /T', () => {});

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Verificar drivers instalados
ipcMain.handle('check-pinpad-drivers', async () => {
  try {
    // Buscar en registro de Windows
    const regPath = 'HKLM\\SOFTWARE\\Verifone\\UnifiedDriver';

    return new Promise((resolve) => {
      exec(`reg query "${regPath}" /v Version`, (error, stdout) => {
        if (error) {
          resolve({ installed: false });
        } else {
          const match = stdout.match(/Version\s+REG_SZ\s+(.+)/);
          resolve({
            installed: true,
            version: match ? match[1].trim() : 'unknown'
          });
        }
      });
    });
  } catch (error) {
    return { installed: false };
  }
});

// Instalar drivers (con UAC)
ipcMain.handle('install-pinpad-drivers', async () => {
  try {
    const driverPath = path.join(
      process.resourcesPath,
      'pinpad',
      'drivers',
      'VerifoneUnifiedDriverInstaller.exe'
    );

    if (!fs.existsSync(driverPath)) {
      return { success: false, error: 'Instalador de drivers no encontrado' };
    }

    // Ejecutar con elevación (UAC)
    return new Promise((resolve) => {
      exec(
        `powershell -Command "Start-Process '${driverPath}' -Verb RunAs -Wait"`,
        (error) => {
          if (error) {
            resolve({ success: false, error: error.message });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Abrir carpeta de configuración
ipcMain.handle('open-pinpad-config-folder', async () => {
  const configPath = path.join(process.resourcesPath, 'pinpad');

  exec(`explorer "${configPath}"`);
  return { success: true };
});

// ===== Limpiar al cerrar =====

app.on('before-quit', () => {
  // Detener Gateway si está corriendo
  if (pinpadGatewayProcess) {
    console.log('[ELECTRON] Deteniendo Gateway PinPad...');
    pinpadGatewayProcess.kill();
  }
});
```

### 3.2 Modificar `preload.js`

Agregar las nuevas APIs:

```javascript
// ... código existente ...

// PinPad APIs
startPinPadGateway: (environment) => ipcRenderer.invoke('start-pinpad-gateway', environment),
stopPinPadGateway: () => ipcRenderer.invoke('stop-pinpad-gateway'),
checkPinPadDrivers: () => ipcRenderer.invoke('check-pinpad-drivers'),
installPinPadDrivers: () => ipcRenderer.invoke('install-pinpad-drivers'),
openPinPadConfigFolder: () => ipcRenderer.invoke('open-pinpad-config-folder'),
```

### 3.3 Modificar `electron-builder.json`

Agregar los recursos del PinPad:

```json
{
  "extraResources": [
    {
      "from": "web-build",
      "to": "web-build",
      "filter": ["**/*"]
    },
    {
      "from": "node_modules/sql.js/dist/sql-wasm.wasm",
      "to": "sql-wasm.wasm"
    },
    {
      "from": "pinpad-gateway",
      "to": "pinpad",
      "filter": ["**/*"]
    }
  ]
}
```

---

## 🎨 FASE 4: UI de Configuración

### 4.1 Crear Pantalla de Configuración (`src/screens/POS/PinPadConfigScreen.tsx`)

```typescript
/**
 * Pantalla de Configuración del PinPad
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { usePinPadStore } from '@/store/pinpad';

export default function PinPadConfigScreen() {
  const {
    config,
    connectionStatus,
    gatewayRunning,
    pinpadDetected,
    driversInstalled,
    currentTransaction,
    lastTransactionResult,
    setConfig,
    saveConfig,
    startGateway,
    stopGateway,
    checkStatus,
    testConnection,
    checkInstallation,
    installDrivers,
  } = usePinPadStore();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkInstallation();
  }, []);

  const handleStartGateway = async () => {
    setLoading(true);
    const success = await startGateway();
    setLoading(false);

    if (!success) {
      Alert.alert('Error', 'No se pudo iniciar el Gateway del PinPad');
    }
  };

  const handleStopGateway = async () => {
    setLoading(true);
    await stopGateway();
    setLoading(false);
  };

  const handleTestConnection = async () => {
    setLoading(true);
    const result = await testConnection();
    setLoading(false);

    if (result.success) {
      Alert.alert('✅ Conexión Exitosa', 'El PinPad está listo para transacciones');
    } else {
      Alert.alert('❌ Error', result.errorMessage || 'No se pudo conectar');
    }
  };

  const handleInstallDrivers = async () => {
    Alert.alert(
      'Instalar Drivers',
      'Se abrirá el instalador de drivers de Verifone. Necesitará permisos de administrador.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Instalar',
          onPress: async () => {
            setLoading(true);
            const success = await installDrivers();
            setLoading(false);

            if (success) {
              Alert.alert('✅ Éxito', 'Drivers instalados correctamente');
              checkInstallation();
            } else {
              Alert.alert('❌ Error', 'No se pudieron instalar los drivers');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'PINPAD_READY':
        return '#4CAF50';
      case 'GATEWAY_READY':
        return '#FF9800';
      case 'CONNECTING':
      case 'BUSY':
        return '#2196F3';
      case 'ERROR':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'PINPAD_READY':
        return '✅ PinPad Listo';
      case 'GATEWAY_READY':
        return '⚠️ Gateway OK - PinPad no detectado';
      case 'CONNECTING':
        return '🔄 Conectando...';
      case 'BUSY':
        return '⏳ Procesando transacción...';
      case 'ERROR':
        return '❌ Error de conexión';
      default:
        return '⭕ Desconectado';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🏧 Configuración PinPad</Text>

      {/* Estado de Conexión */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado de Conexión</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {currentTransaction && (
          <View style={styles.transactionStatus}>
            <ActivityIndicator size="small" color="#2196F3" />
            <Text style={styles.transactionMessage}>
              {currentTransaction.displayMessage}
            </Text>
          </View>
        )}
      </View>

      {/* Estado de Instalación */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado de Componentes</Text>

        <View style={styles.componentRow}>
          <Text style={styles.componentName}>Drivers Verifone</Text>
          <Text style={[styles.componentStatus, { color: driversInstalled ? '#4CAF50' : '#F44336' }]}>
            {driversInstalled ? '✅ Instalado' : '❌ No instalado'}
          </Text>
          {!driversInstalled && (
            <TouchableOpacity style={styles.installButton} onPress={handleInstallDrivers}>
              <Text style={styles.installButtonText}>Instalar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.componentRow}>
          <Text style={styles.componentName}>Gateway API</Text>
          <Text style={[styles.componentStatus, { color: gatewayRunning ? '#4CAF50' : '#9E9E9E' }]}>
            {gatewayRunning ? '🟢 Ejecutando' : '⭕ Detenido'}
          </Text>
        </View>

        <View style={styles.componentRow}>
          <Text style={styles.componentName}>PinPad P400</Text>
          <Text style={[styles.componentStatus, { color: pinpadDetected ? '#4CAF50' : '#9E9E9E' }]}>
            {pinpadDetected ? '🟢 Conectado' : '⭕ No detectado'}
          </Text>
        </View>
      </View>

      {/* Configuración de Ambiente */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ambiente</Text>

        <View style={styles.environmentSelector}>
          <TouchableOpacity
            style={[
              styles.environmentOption,
              config.environment === 'DESARROLLO' && styles.environmentOptionActive,
            ]}
            onPress={() => {
              setConfig({ environment: 'DESARROLLO' });
              saveConfig();
            }}
          >
            <Text
              style={[
                styles.environmentText,
                config.environment === 'DESARROLLO' && styles.environmentTextActive,
              ]}
            >
              🧪 Desarrollo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.environmentOption,
              config.environment === 'PRODUCCION' && styles.environmentOptionActive,
            ]}
            onPress={() => {
              setConfig({ environment: 'PRODUCCION' });
              saveConfig();
            }}
          >
            <Text
              style={[
                styles.environmentText,
                config.environment === 'PRODUCCION' && styles.environmentTextActive,
              ]}
            >
              🚀 Producción
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.autoStartRow}>
          <Text style={styles.autoStartLabel}>Iniciar Gateway automáticamente</Text>
          <Switch
            value={config.autoStartGateway}
            onValueChange={(value) => {
              setConfig({ autoStartGateway: value });
              saveConfig();
            }}
          />
        </View>
      </View>

      {/* Acciones */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Acciones</Text>

        <View style={styles.actionsRow}>
          {!gatewayRunning ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              onPress={handleStartGateway}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionButtonText}>▶️ Iniciar Gateway</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={handleStopGateway}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>⏹️ Detener Gateway</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={handleTestConnection}
            disabled={loading || !gatewayRunning}
          >
            <Text style={styles.actionButtonTextSecondary}>🔌 Probar Conexión</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonOutline]}
          onPress={() => checkStatus()}
        >
          <Text style={styles.actionButtonTextOutline}>🔄 Actualizar Estado</Text>
        </TouchableOpacity>
      </View>

      {/* Último Resultado */}
      {lastTransactionResult && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Última Transacción</Text>
          <View style={styles.resultContainer}>
            <Text style={styles.resultText}>
              Estado: {lastTransactionResult.success ? '✅ Aprobada' : '❌ Rechazada'}
            </Text>
            {lastTransactionResult.authorizationCode && (
              <Text style={styles.resultText}>
                Autorización: {lastTransactionResult.authorizationCode}
              </Text>
            )}
            {lastTransactionResult.cardBrand && (
              <Text style={styles.resultText}>
                Tarjeta: {lastTransactionResult.cardBrand} ****{lastTransactionResult.cardLastFour}
              </Text>
            )}
            {lastTransactionResult.errorMessage && (
              <Text style={styles.resultTextError}>
                Error: {lastTransactionResult.errorMessage}
              </Text>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  statusBadge: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  transactionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  transactionMessage: {
    marginLeft: 8,
    color: '#1976D2',
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  componentName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  componentStatus: {
    fontSize: 14,
    fontWeight: '500',
  },
  installButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  installButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  environmentSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  environmentOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  environmentOptionActive: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  environmentText: {
    fontSize: 14,
    color: '#666',
  },
  environmentTextActive: {
    color: '#2196F3',
    fontWeight: '600',
  },
  autoStartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  autoStartLabel: {
    fontSize: 14,
    color: '#333',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonPrimary: {
    backgroundColor: '#4CAF50',
  },
  actionButtonDanger: {
    backgroundColor: '#F44336',
  },
  actionButtonSecondary: {
    backgroundColor: '#2196F3',
  },
  actionButtonOutline: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#2196F3',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextSecondary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextOutline: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  resultContainer: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  resultTextError: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 4,
  },
});
```

---

## 💳 FASE 5: Integración con Flujo de Pagos

### 5.1 Modificar `src/types/pos.ts`

Agregar flag para PinPad:

```typescript
export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  description?: string;
  requiresReference?: boolean;
  isActive: boolean;
  displayOrder?: number;
  parentId?: string | null;
  submethods?: PaymentMethod[];
  createdAt?: string;
  // Campos para identificar tipos de pago
  isIzipay?: boolean;
  isCash?: boolean;
  isPinPad?: boolean;  // ← NUEVO: Para PinPad P400
}
```

### 5.2 Modificar Flujo de Pago en `NewSaleScreen.tsx`

El flujo será similar a Izipay pero con integración al PinPad:

```typescript
// En el handleAddPayment o donde se procesa el pago

const isPinPad = selectedMethod?.code?.includes('PINPAD') || selectedMethod?.isPinPad;

if (isPinPad) {
  // Verificar que el PinPad esté listo
  const { connectionStatus, processSale } = usePinPadStore.getState();

  if (connectionStatus !== 'PINPAD_READY') {
    Alert.alert(
      'PinPad no disponible',
      'El PinPad no está conectado. ¿Desea configurarlo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Configurar', onPress: () => navigation.navigate('PinPadConfig') },
      ]
    );
    return;
  }

  // Procesar pago con PinPad
  setProcessingPinPad(true);
  const amountCents = Math.round(amount * 100);

  const result = await processSale(amountCents);

  setProcessingPinPad(false);

  if (result.success) {
    // Agregar el pago con los datos del PinPad
    addPaymentToCart(methodToUse, amount, {
      referenceNumber: result.authorizationCode,
      cardBrand: result.cardBrand,
      cardLastFour: result.cardLastFour,
      transactionId: result.transactionId,
    });

    // Guardar datos del voucher para imprimir
    setPinPadPrintData(result.printData);

  } else {
    Alert.alert(
      'Transacción Rechazada',
      result.errorMessage || 'La transacción no fue aprobada',
      [{ text: 'OK' }]
    );
  }
  return;
}
```

### 5.3 Modal de Procesamiento PinPad

Crear componente para mostrar estado durante la transacción:

```typescript
// src/components/PinPadProcessingModal.tsx

const PinPadProcessingModal = () => {
  const { currentTransaction, connectionStatus } = usePinPadStore();

  if (!currentTransaction) return null;

  return (
    <Modal visible={connectionStatus === 'BUSY'} transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.title}>Procesando Pago</Text>
          <Text style={styles.message}>{currentTransaction.displayMessage}</Text>

          {currentTransaction.amountCents && (
            <Text style={styles.amount}>
              S/ {(currentTransaction.amountCents / 100).toFixed(2)}
            </Text>
          )}

          <Text style={styles.instruction}>
            Siga las instrucciones en el PinPad
          </Text>
        </View>
      </View>
    </Modal>
  );
};
```

---

## 📦 FASE 6: Instalador y Distribución

### 6.1 Modificar `build/installer.nsh`

```nsi
!macro customInit
  ; Cerrar la aplicación si está ejecutándose
  DetailPrint "Cerrando CajaGrit si está en ejecución..."
  nsExec::Exec 'taskkill /F /IM CajaGrit.exe /T'
  Pop $0
  Sleep 1000
  nsExec::Exec 'taskkill /F /IM electron.exe /T'
  Pop $0
  Sleep 1000

  ; Detener Gateway PinPad si está corriendo
  DetailPrint "Deteniendo Gateway PinPad..."
  nsExec::Exec 'taskkill /F /IM gateway.exe /T'
  Pop $0
  Sleep 500
!macroend

!macro customInstall
  ; Limpiar archivos antiguos
  DetailPrint "Limpiando archivos antiguos..."

  ${If} ${FileExists} "$LOCALAPPDATA\Programs\CajaGrit\CajaGrit.exe"
    ${If} "$INSTDIR" != "$LOCALAPPDATA\Programs\CajaGrit"
      RMDir /r "$LOCALAPPDATA\Programs\CajaGrit"
    ${EndIf}
  ${EndIf}

  ; ===== VERIFICAR E INSTALAR DRIVERS PINPAD =====
  DetailPrint "Verificando drivers de PinPad..."

  ; Verificar si ya están instalados
  ReadRegStr $0 HKLM "SOFTWARE\Verifone\UnifiedDriver" "Version"
  StrCmp $0 "" 0 drivers_installed

  ; Preguntar al usuario si desea instalar los drivers
  MessageBox MB_YESNO|MB_ICONQUESTION "Se detectó que los drivers del PinPad Verifone no están instalados.$\n$\n¿Desea instalarlos ahora?$\n$\n(Esto es necesario solo si va a usar PinPad para pagos con tarjeta)" IDNO skip_drivers

  ; Instalar drivers
  DetailPrint "Instalando drivers de PinPad Verifone..."

  ; Buscar el instalador
  ${If} ${FileExists} "$INSTDIR\resources\pinpad\drivers\VerifoneUnifiedDriverInstaller.exe"
    ExecWait '"$INSTDIR\resources\pinpad\drivers\VerifoneUnifiedDriverInstaller.exe"'
  ${EndIf}

  Goto drivers_done

  drivers_installed:
    DetailPrint "Drivers de PinPad ya instalados (versión: $0)"
    Goto drivers_done

  skip_drivers:
    DetailPrint "Instalación de drivers omitida por el usuario"

  drivers_done:

  ; ===== CREAR ACCESO DIRECTO PARA CONFIGURAR PINPAD =====
  CreateShortCut "$SMPROGRAMS\CajaGrit\Configurar PinPad.lnk" "$INSTDIR\resources\pinpad\config\MCCenter.exe"
!macroend

!macro customUnInstall
  ; Detener Gateway PinPad
  nsExec::Exec 'taskkill /F /IM gateway.exe /T'
  Pop $0

  ; Eliminar configuración del PinPad
  RMDir /r "$LOCALAPPDATA\CajaGrit\PinPad"
!macroend
```

### 6.2 Actualizar `package.json`

Incrementar versión y agregar script de preparación:

```json
{
  "version": "0.0.52",
  "scripts": {
    "prepare:pinpad": "node scripts/prepare-pinpad.js",
    "dist": "npm run prepare:pinpad && npm run electron:build"
  }
}
```

### 6.3 Crear Script de Preparación (`scripts/prepare-pinpad.js`)

```javascript
/**
 * Preparar archivos del PinPad para distribución
 */

const fs = require('fs-extra');
const path = require('path');

const SOURCE_PATH = path.join(__dirname, '..', 'temp_integracion', 'CD INTEGRACION PPD P400 API REST ( Window´s)');
const DEST_PATH = path.join(__dirname, '..', 'pinpad-gateway');

async function preparePinPad() {
  console.log('📦 Preparando archivos del PinPad...');

  // Crear estructura de carpetas
  await fs.ensureDir(path.join(DEST_PATH, 'desarrollo'));
  await fs.ensureDir(path.join(DEST_PATH, 'produccion'));
  await fs.ensureDir(path.join(DEST_PATH, 'drivers'));
  await fs.ensureDir(path.join(DEST_PATH, 'config'));

  // Copiar Gateway de Desarrollo
  const devSource = path.join(SOURCE_PATH, 'CajaWindowsPinPadApiRest-1_0_0_2_Desarrollo.exe');
  const devDest = path.join(DEST_PATH, 'desarrollo', 'gateway.exe');

  if (await fs.pathExists(devSource)) {
    await fs.copy(devSource, devDest);
    console.log('✅ Gateway Desarrollo copiado');
  } else {
    console.warn('⚠️ Gateway Desarrollo no encontrado');
  }

  // Copiar Gateway de Producción
  const prodSource = path.join(SOURCE_PATH, 'CajaWindowsPinPadApiRest-1_0_0_2_Producción.exe');
  const prodDest = path.join(DEST_PATH, 'produccion', 'gateway.exe');

  if (await fs.pathExists(prodSource)) {
    await fs.copy(prodSource, prodDest);
    console.log('✅ Gateway Producción copiado');
  } else {
    console.warn('⚠️ Gateway Producción no encontrado');
  }

  // Extraer y copiar drivers
  const driversZip = path.join(SOURCE_PATH, 'VerifoneUnifiedDriverInstaller-5.0.5.2-B4 -  Win11.zip');
  const driversDest = path.join(DEST_PATH, 'drivers');

  if (await fs.pathExists(driversZip)) {
    // El ZIP ya debería estar extraído en temp_integracion
    const extractedPath = driversZip.replace('.zip', '');
    if (await fs.pathExists(extractedPath)) {
      await fs.copy(extractedPath, driversDest);
      console.log('✅ Drivers copiados');
    }
  }

  console.log('📦 Preparación del PinPad completada');
}

preparePinPad().catch(console.error);
```

---

## ✅ FASE 7: Pruebas y Certificación

### 7.1 Checklist de Pruebas

```markdown
## Checklist de Certificación PinPad P400

### INSTALACIÓN
- [ ] Hardware preparado igual a producción
- [ ] Gateway habilitado y ejecutándose
- [ ] Drivers Verifone instalados
- [ ] Transacción TEST aprobada

### COMPRA
- [ ] Compra con chip ≤ S/ 20.00
- [ ] Compra con CTLS ≤ S/ 20.00
- [ ] Compra con banda ≤ S/ 20.00
- [ ] PPD retorna a reposo después de transacción
- [ ] Cancelación en PPD no bloquea la app
- [ ] Transacción rechazada manejada correctamente
- [ ] Premiación impresa correctamente
- [ ] Multirespuesta manejada
- [ ] Monto S/ 0.00 rechazado por la app
- [ ] Monto < S/ 1.00 funciona

### ANULACIÓN
- [ ] Anulación de compra exitosa
- [ ] Anulación con tarjeta diferente rechazada

### CIERRE
- [ ] Cierre de lote exitoso
- [ ] Cuadre correcto con la caja
```

### 7.2 Configuración de Ambiente de Pruebas

```typescript
// src/config/pinpadTestConfig.ts

export const PINPAD_TEST_CONFIG = {
  // Montos de prueba
  amounts: {
    approved: 1000,        // S/ 10.00 - Aprobado
    declined: 5200,        // S/ 52.00 - Rechazado
    promotion: 3500,       // S/ 35.00 - Premiación
    multiResponse: 7500,   // S/ 75.00 - Multirespuesta
  },

  // Códigos para anulación (primeros 6 dígitos del comercio)
  voidPassword: '299999',

  // Puerto del Gateway
  port: 8090,
};
```

---

## 📋 RESUMEN DE ARCHIVOS A CREAR/MODIFICAR

### Archivos Nuevos
| Archivo | Descripción |
|---------|-------------|
| `src/types/pinpad.ts` | Tipos TypeScript para PinPad |
| `src/services/PinPadService.ts` | Servicio de comunicación |
| `src/store/pinpad.ts` | Store Zustand |
| `src/screens/POS/PinPadConfigScreen.tsx` | Pantalla de configuración |
| `src/components/PinPadProcessingModal.tsx` | Modal de procesamiento |
| `scripts/prepare-pinpad.js` | Script de preparación |
| `pinpad-gateway/` | Carpeta con Gateway y drivers |

### Archivos a Modificar
| Archivo | Cambios |
|---------|---------|
| `electron.js` | Handlers IPC para Gateway |
| `preload.js` | Exponer APIs del PinPad |
| `electron-builder.json` | Incluir recursos del PinPad |
| `installer.nsh` | Instalar drivers opcional |
| `package.json` | Versión y scripts |
| `src/types/pos.ts` | Flag `isPinPad` |
| `src/screens/POS/NewSaleScreen.tsx` | Flujo de pago PinPad |

---

## 🚀 ORDEN DE IMPLEMENTACIÓN

1. ✅ Crear `pinpad-gateway/` y copiar archivos
2. ✅ Crear `src/types/pinpad.ts`
3. ✅ Crear `src/services/PinPadService.ts`
4. ✅ Crear `src/store/pinpad.ts`
5. ✅ Modificar `electron.js` (handlers IPC)
6. ✅ Modificar `preload.js`
7. ✅ Crear `PinPadConfigScreen.tsx`
8. ✅ Modificar `electron-builder.json`
9. ✅ Modificar `installer.nsh`
10. ✅ Integrar en flujo de pagos (`NewSaleScreen.tsx`)
11. ✅ Crear modal de procesamiento
12. ✅ Probar con Gateway en desarrollo
13. ✅ Generar instalador y probar
14. ✅ Certificación con checklist

---

**¿Deseas que comience con la implementación? Puedo empezar por la Fase 1 (preparar carpetas y copiar archivos) y continuar secuencialmente.**
