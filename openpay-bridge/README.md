# openpay-bridge

Servicio HTTP local (`http://localhost:9091`) que envuelve el SDK
**EGlobal.TotalPOS.Peru.SDK** (PinPad OpenPay Perú) y lo expone como API REST
para que el proceso Electron / renderer TS lo consuma con el mismo patrón que
el gateway de Izipay.

## Estructura

```
openpay-bridge/
├── openpay-bridge.csproj    # .NET Framework 4.8, C# 5.0 compat
├── Program.cs               # HttpListener + rutas
├── SdkClient.cs             # Wrapper thread-safe del SDK
├── Local.config             # Config del comercio (SANDBOX por defecto)
├── pinpad.config            # Config del SDK (telecarga/llaves)
├── build.ps1                # Compila sin depender de Visual Studio
├── run-sandbox.ps1          # Levanta simulador + bridge
├── lib/                     # (no versionado) EGlobal.TotalPOS.Peru.SDK.dll
├── sandbox/                 # (no versionado) simulador_windows.exe + assets
├── bin/Release/             # (no versionado) openpay-bridge.exe
└── logs/                    # (no versionado) stdout/stderr de sim + bridge
```

---

## Sandbox: primera vez

### 1) Copiar la DLL del SDK y el simulador

Del ZIP oficial **TotalPos SDK.Net** de EGlobal, copiar:

- `SDK/EGlobal.TotalPOS.Peru.SDK.dll` → `openpay-bridge/lib/`
- `Sandbox_1.0.37/*` (todo el contenido) → `openpay-bridge/sandbox/`

```powershell
# Ejemplo si el ZIP está descomprimido en Descargas:
Copy-Item "$env:USERPROFILE\Downloads\TotalPosSDKNet_extract\SDK\EGlobal.TotalPOS.Peru.SDK.dll" .\lib\
Copy-Item "$env:USERPROFILE\Downloads\TotalPosSDKNet_extract\Sandbox_1.0.37\*" .\sandbox\ -Recurse
```

### 2) Ajustar el COM del PinPad en `Local.config`

Aunque estemos en sandbox, el SDK EGlobal **exige un PinPad físico** conectado
por USB/COM. El "sandbox" solo cambia el back-end (HTTP) por el simulador
local; el PPD sigue siendo real.

Ver los COM disponibles y elegir el del PPD:

```powershell
[System.IO.Ports.SerialPort]::GetPortNames()
Get-CimInstance Win32_SerialPort | Select DeviceID, Description
```

Editar `Local.config`:

```xml
<pinpadconexion value="COM3" />   <!-- ajustar al puerto real -->
```

Los demás valores (`afiliacion`, `idaplicacion`, `clavesecreta`, etc.) ya
vienen con las credenciales **demo** de EGlobal para sandbox.

### 3) Compilar

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

`build.ps1` usa el `MSBuild.exe` de `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\`
(viene con Windows). No hace falta Visual Studio.

Salida: `bin\Release\openpay-bridge.exe` + `EGlobal.TotalPOS.Peru.SDK.dll` +
copias de `Local.config` / `pinpad.config`.

### 4) Levantar sandbox

```powershell
powershell -ExecutionPolicy Bypass -File .\run-sandbox.ps1
```

Lo que hace:

1. `sandbox\simulador_windows.exe` → HOST simulado en `http://localhost:9000`.
2. `bin\Release\openpay-bridge.exe` → API en `http://localhost:9091`.
3. Muestra el resultado de `/health`.
4. Sigue vivo hasta Ctrl+C, y limpia ambos procesos al salir.

Logs en `openpay-bridge\logs\`:

- `simulator.stdout.log` / `simulator.stderr.log`
- `bridge.stdout.log` / `bridge.stderr.log`
- `bin\Release\bridge.log` (rolling del bridge)

### 5) Verificar manualmente

```powershell
Invoke-RestMethod http://localhost:9091/health
# {"ok": true, "initialized": false}

Invoke-RestMethod http://localhost:9091/openpay/init -Method POST
# {"ok": true, "initialized": true}   ← si el PPD responde

Invoke-RestMethod http://localhost:9091/openpay/venta -Method POST `
    -ContentType 'application/json' -Body '{"amount":"10.50"}'
# → el PPD pide inserción/aproximación y devuelve la Respuesta del SDK
```

---

## Integración con Electron

`electron.js` arranca el bridge automáticamente en `app.ready` si encuentra
`bin\Release\openpay-bridge.exe` (dev) o `resources/openpay-bridge/openpay-bridge.exe`
(producción). En `before-quit` lo detiene con `taskkill /F /T`.

`electron-builder.yml` empaqueta `bin\Release\` como `extraResources`, por lo
que el bridge queda dentro del instalador NSIS.

Del lado renderer, `src/services/OpenPayPinPadService.ts` + `src/store/openpay.ts`
consumen la API HTTP y `NewSaleScreen.tsx` enruta por
`derivePinPadProvider(paymentMethod.code)` — códigos con `OPENPAY_*` van al
bridge, `IZIPAY_*` al gateway Izipay.

---

## Endpoints

| Método | Ruta                       | Cuerpo                                         | Descripción                                        |
| ------ | -------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| GET    | `/health`                  | —                                              | Ping + flag `initialized`                          |
| POST   | `/openpay/init`            | —                                              | Carga `Local.config` + `Interfaz.Inicializar()`    |
| POST   | `/openpay/carga-llaves`    | —                                              | `Operacion.CargaLlaves`                            |
| POST   | `/openpay/venta`           | `{ "amount": "10.50" }`                        | `Operacion.Venta`                                  |
| POST   | `/openpay/venta-qr`        | `{ "amount": "10.50" }`                        | `Operacion.VentaQR`                                |
| POST   | `/openpay/anulacion`       | `{ "amount": "10.50", "financialReference": "0000000045" }` | `Operacion.AnulacionVenta`             |
| POST   | `/openpay/anulacion-qr`    | idem                                           | `Operacion.AnulacionVentaQR`                       |
| POST   | `/openpay/cierre`          | —                                              | `Operacion.CierreTurno`                            |

Respuestas: shape 1:1 con `Layout.Respuesta` en camelCase; `ok = (responseCode === '00')`.

En error del SDK:

```json
{ "ok": false, "error": "mensaje", "type": "PeticionException" }
```

---

## Migrar a producción

Editar `Local.config` con los valores reales que entregue EGlobal / OpenPay:

```xml
<hosturl value="https://www.totalpos.latam.eglobal.com.mx" /> <!-- Host autorizador EGlobal (TLS 1.2/1.3, :443) -->
<afiliacion value="<afiliacion-real>" />
<idaplicacion value="<id-aplicacion-real>" />
<clavesecreta value="<clave-secreta-real>" />
<numeroterminal value="<n-terminal>" />
<pinpadconexion value="COM3" />   <!-- COM real -->
<android value="0" />              <!-- deshabilitar modo Android/demo -->
```

Y correr `Operacion.CargaLlaves` una vez (`POST /openpay/carga-llaves`) tras
afiliar el terminal.

### Accesos de red requeridos para Certificación

OpenPay/EGlobal exige habilitar (allowlist de firewall/proxy) los siguientes
destinos **antes de certificar**. Se dividen en dos rutas distintas:

**1) Host autorizador — lo consume la PC (este bridge, vía `hosturl`):**

| Destino | Puerto | Protocolo | Uso |
| --- | --- | --- | --- |
| `www.totalpos.latam.eglobal.com.mx` | 443 | TLS 1.2 / 1.3 | Autorización de transacciones (pagos) |

**2) Agente MDM (Agora / Necomplus) — lo consume el TERMINAL `PAX A35`:**

| Destino | Puerto | Uso |
| --- | --- | --- |
| `rabbitmq.necomplus.com` | 5671 (TLS) | Agente Rabbit (mensajería del terminal) |
| `agoramarket.necomplus.com` | 443 (TLS) | Servicios web (intercambio de información) |
| `agoramarketsta.blob.core.windows.net` | 443 | Blob Storage: descargas de comunicaciones / actualizaciones remotas de PinPad |

> El `PAX A35` es un terminal Android. La ruta MDM (2) requiere que **el propio
> terminal** tenga salida a Internet. En el modelo COM de este bridge, el
> terminal suele recibir Internet **compartido desde la PC por USB** (RNDIS
> reverse *with serial* en Windows / ECM en Linux, IP `192.168.42.1`) — ver la
> guía de EGlobal "NCP_Agora_PAX_A35_GuiaConfiguracion_USB". En Windows usar el
> modo **RNDIS reverse *with serial*** para no perder el puerto COM que este
> bridge necesita.
