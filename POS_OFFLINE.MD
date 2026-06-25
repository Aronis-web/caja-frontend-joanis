Contrato Frontend - Ventas y Login Offline del POS
Guia para el equipo de frontend del POS (web / Electron). Describe que debe implementar el cliente para vender y autenticar sin conexion, con los endpoints que consume, sus request/response, el almacenamiento local y la criptografia que ejecuta en el dispositivo.

Lo que ocurre dentro del backend (numeracion SUNAT, colas, procesamiento fiscal) no es responsabilidad del frontend y aqui solo se menciona lo imprescindible para entender el contrato.

Feature flag backend: POS_OFFLINE_LOGIN_ENABLED. Mientras este OFF, los endpoints de bundle de usuarios responden 403; el frontend debe degradar elegantemente (login offline deshabilitado) sin romper la venta offline.

1. Que debe hacer el frontend (vision general)
   El POS siempre vende y siempre autentica, online u offline. Para lograrlo, el frontend:

Mientras hay red (pre-sync): descarga y guarda localmente tres recursos:
Catalogo (productos, precios, stock) + checksum.
Pool de tokens QR (para numerar tickets sin colisiones).
Bundle de usuarios cifrado (para el login offline).
Sin red: vende contra el almacen local consumiendo tokens y emitiendo tickets no tributarios con QR; autentica al cajero descifrando el bundle.
Al reconectar: pide turno (semaforo), sube las ventas en lotes y sincroniza los eventos de login. El cliente recupera su boleta/factura real escaneando el QR del ticket.
flowchart TD
subgraph ONLINE["Con red (pre-sync)"]
A1["GET catalogo + checksum"]
A2["Pool tokens QR (48h)"]
A3["GET bundle usuarios cifrado (24h)"]
end
ONLINE -->|"guardar"| LOCAL["IndexedDB (web) / SQLite (Electron)"]

    subgraph OFFLINE["Sin red"]
        B1["Login offline (password/PIN vs bundle)"]
        B2["Venta -> consume token -> ticket QR"]
        B3["Descuenta stock local"]
    end
    LOCAL --> OFFLINE

    OFFLINE -->|"reconexion"| SYNC["Semaforo: register -> poll -> batch -> complete"]
    SYNC --> DONE["Backend numera y emite a SUNAT"]
    DONE --> QR["Cliente recupera boleta por QR publico"]
Deteccion de online/offline
El backend no decide el estado de red. El frontend lo determina con navigator.onLine + un heartbeat periodico (p. ej. cada 30 s) a un endpoint de salud. Si el JWT del cajero vence durante el corte, el frontend no debe limpiar la sesion ni patear al login del backend: debe entrar al modo offline.

2. Almacenamiento local
   Estructura sugerida (IndexedDB web / SQLite Electron):

Store / tabla	Contenido
products	Catalogo descargado (productId, sku, title, priceCents, stock, barcode)
tokens	Pool de tokens QR (token, expiresAt, status local)
users_bundle	Respuesta cruda del bundle cifrado (iv, authTag, ciphertext, bundleId, ...)
offline_sales	Ventas hechas offline pendientes de sync (localId, token, items, pagos, sellerId, estado)
login_events	Logins offline a sincronizar (userId, bundleId, occurredAt, method, success)
sync_metadata	lastCatalogSync, lastBundleSync, checksum, contadores
El device-token (X-Device-Token) NO va en IndexedDB plano: guardarlo en almacenamiento seguro (Electron safeStorage / SecureStorage del dispositivo). Se usa como clave para descifrar el bundle y firmar el JWT offline.

3. Headers que envia el frontend
   Header	Cuando	Descripcion
   X-Device-Token	Siempre en endpoints /pos/*	Token de la caja (validez 1 año). Identifica el dispositivo.
   X-Offline-Session	Tras login offline	JWT offline HS256 que firma el propio frontend con el device-token.
   X-Sync-Token	Solo en POST /pos/sync/sales	Token de turno devuelto por register.
   Authorization: Bearer <jwt>	Endpoints de gestion del PIN (online)	JWT normal del cajero.
   El X-Offline-Session no reemplaza al X-Device-Token: ambos viajan. Si el device-token es invalido, la peticion se rechaza aunque el offline-session sea valido.

4. Pre-sincronizacion (frontend online)
   4.1 Catalogo y tokens
   GET /api/pos/offline-catalog/:cashRegisterId
   Catalogo completo + tokens. Query: includeImages (bool), tokensCount (default 1000).

{
"cashRegisterId": "6f1a...e9",
"checksum": "sha256:9c2b...",
"generatedAt": "2026-06-22T14:00:00.000Z",
"products": [
{ "productId": "a1...", "sku": "JEAN-001", "title": "Jean clasico",
"priceCents": 12990, "stock": 14, "barcode": "7501..." }
],
"tokens": [
{ "token": "Hk3l9Zx1Qm7BvT0a", "expiresAt": "2026-06-24T14:00:00.000Z" }
],
"totalProducts": 1820,
"totalTokens": 1000
}
Guardar checksum para detectar cambios. Comparar contra el local antes de re-descargar todo.

GET /api/pos/offline-catalog/:cashRegisterId/delta?since=ISO
Solo cambios desde since. Query: since (ISO8601, requerido), replenishTokens (bool), currentTokensCount (number).

Response: { changedProducts: [...], removedProductIds: [...], newTokens: [...], since, generatedAt }.

GET /api/pos/offline-catalog/:cashRegisterId/stock-updates?since=ISO
Endpoint ligero (~5-50 KB) para refrescar solo stock. Query: since (ISO8601), onlyActiveProducts (bool). Alias legacy: GET /api/pos/stock-updates/:cashRegisterId.

{ "cashRegisterId": "6f1a...e9", "since": "2026-06-22T13:50:00.000Z",
"updates": [ { "productId": "a1...", "stock": 12 } ], "totalUpdates": 1 }
POST /api/pos/offline-catalog/:cashRegisterId/replenish-tokens
Confirmar tokens usados y reponer el pool. Llamar cuando queden < 20 tokens.

// request
{ "usedTokens": ["Hk3l9Zx1Qm7BvT0a"], "requestCount": 500 }
// response 201
{ "newTokens": [ { "token": "Pq8r...", "expiresAt": "2026-06-24T14:05:00.000Z" } ],
"newPoolId": "b2c3...", "confirmedUsedTokens": ["Hk3l9Zx1Qm7BvT0a"],
"totalAvailableTokens": 980, "expiresAt": "2026-06-24T14:05:00.000Z" }
GET /api/pos/offline-catalog/:cashRegisterId/token-stats
{ available, used, expired, total, needsReplenishment, replenishThreshold }.

4.2 Bundle de usuarios (para login offline)
GET /api/pos/offline-catalog/:cashRegisterId/users
Bundle cifrado de los cajeros autorizados para esa caja. Requiere X-Device-Token. Refrescar junto al catalogo (TTL 24h; nextRefreshMs sugiere cada 4h).

{
"alg": "AES-256-GCM",
"iv": "b64url-12-bytes",
"authTag": "b64url-16-bytes",
"ciphertext": "b64url-...",
"bundleId": "8f2a-...",
"userCount": 7,
"checksum": "sha256:...",
"keyVersion": 1,
"generatedAt": "2026-06-22T14:00:00.000Z",
"expiresAt": "2026-06-23T14:00:00.000Z",
"nextRefreshMs": 14400000,
"salt": "<cashRegisterId>",
"info": "pos-offline-users-v1"
}
Guardar la respuesta cruda en users_bundle. El frontend la descifra solo cuando necesita autenticar offline (ver seccion 5).

Errores: 403 (feature off o device no aprovisionado -> deshabilitar login offline), 404 (caja no existe).

Contenido del bundle descifrado (lo que el frontend obtiene tras descifrar):

{
"bundleId": "8f2a-...",
"cashRegisterId": "6f1a...e9",
"generatedAt": "2026-06-22T14:00:00.000Z",
"expiresAt": "2026-06-23T14:00:00.000Z",
"keyVersion": 1,
"users": [
{
"id": "u1...", "email": "cajera1@joanis.pe",
"firstName": "Ana", "lastName": "Quispe",
"passwordHash": "$argon2id$v=19$m=...$...",
"pinHash": "$argon2id$v=19$m=...$...", "hasPin": true,
"roles": ["CAJERA"],
"permissions": ["pos.sales.create", "pos.sessions.open"],
"isActive": true, "updatedAt": "2026-06-20T10:00:00.000Z",
"pinLockedUntil": null
}
]
}
Los passwordHash / pinHash son argon2id y nunca se almacenan en claro. El frontend los usa solo para verificar credenciales localmente.

5. Login offline (criptografia que ejecuta el frontend)
   Cuando el cajero entra sin red (o el JWT vencio durante el corte):

sequenceDiagram
participant C as Cajero
participant POS as POS Frontend
participant DB as IndexedDB (bundle cifrado)

    C->>POS: Abre caja / pantalla bloqueada
    POS->>DB: Lee bundle cifrado
    POS->>POS: Descifra con device-token (HKDF -> AES-GCM)
    C->>POS: Ingresa email + password (o PIN de 8 digitos)
    POS->>POS: argon2.verify(input, hash del bundle)
    alt Credenciales validas
        POS->>POS: Emite JWT local HS256 firmado con device-token
        POS->>DB: Registra login_event (success=true)
        POS-->>C: Sesion offline activa (roles/permits del bundle)
    else Invalidas
        POS->>DB: Registra login_event (success=false), incrementa intentos
        POS-->>C: Error / bloqueo temporal
    end
5.1 Descifrado del bundle (AES-256-GCM + HKDF)
Derivar la clave: key = HKDF-SHA256(deviceToken, salt = cashRegisterId, info = "pos-offline-users-v1", length = 32).
salt e info vienen en la respuesta del bundle.
Descifrar: AES-256-GCM(ciphertext, key, iv, authTag). Si el authTag no valida, el bundle fue manipulado o el device-token no corresponde -> abortar.
Validar expiresAt del bundle. Si vencio y no hay red, segun politica: permitir con advertencia o exigir reconexion.
5.2 Verificacion de credenciales
Buscar el usuario por email en el bundle.
argon2.verify(passwordIngresado, user.passwordHash) o argon2.verify(pinIngresado, user.pinHash) (usar argon2 WASM en el cliente).
Respetar isActive (rechazar inactivos) y pinLockedUntil (bloqueo por intentos).
5.3 Emision del JWT offline (HS256)
Tras validar, el frontend firma un JWT HS256 con el device-token como secreto:

// payload
{
"sub": "u1...",
"cashRegisterId": "6f1a...e9",
"cashRegisterCode": "CAJA09",
"bundleId": "8f2a-...",
"method": "PIN",
"offline": true,
"iat": 1750600000,
"exp": 1750636000
}
Este JWT se envia como X-Offline-Session en cada request de sync. Solo el backend de Joanis (que tiene el device-token) puede validarlo.

5.4 RBAC offline
La UI se gobierna con roles[] / permissions[] del usuario del bundle (mismas keys que online, p. ej. pos.sales.create, pos.sessions.open). No hay llamada al backend para permisos durante el corte.

5.5 Intentos fallidos
Llevar el contador localmente y bloquear tras N intentos (recomendado 5) por un tiempo. Registrar cada intento (exito/fallo) en login_events para sincronizarlo al reconectar.

6. Venta offline
   Cada venta consume un token del pool local y emite un ticket NO tributario con codigo OFF-YYYYMMDD-CAJA-SEC y un QR que apunta a: https://erp-aio-offline-documents.com/public/receipt/view/{token}.
   Generar un localId (UUID v4) por venta: junto al token es la base de la idempotencia al sincronizar.
   Descontar el stock localmente (localStock). Puede quedar en negativo si se vendio mas de lo cacheado; es esperable y el backend lo reconcilia al sincronizar (no bloquea la venta).
   Atribuir la venta al cajero real (sellerId = sub del JWT offline), no a un usuario generico.
   Guardar la venta en offline_sales con estado PENDING hasta confirmar sync.
   El comprobante tributario (boleta/factura) no se numera en la caja: lo hace el backend al sincronizar. El cliente lo obtiene escaneando el QR del ticket.

7. Reconexion y sincronizacion de ventas (semaforo)
   El frontend implementa el flujo register -> poll -> batch -> complete. Esto evita que 100 cajas reenvien a la vez (thundering herd). Limites del backend que el frontend debe respetar:

Maximo 10 ventas por lote (POST /pos/sync/sales).
Cooldown de 3 s entre lotes (respetar nextBatchAllowedAt).
Maximo 5 cajas sincronizando a la vez (si no hay turno, quedas en cola).
POST /api/pos/sync/register
La caja anuncia sus ventas pendientes y pide turno.

// request
{ "cashRegisterId": "6f1a...e9", "sessionId": "ss-2026...",
"pendingSalesCount": 37, "oldestSaleTimestamp": "2026-06-22T12:00:00.000Z",
"clientInfo": { "userAgent": "POS/2.3.1", "appVersion": "2.3.1" } }
// response 201 (turno libre)
{ "registrationId": "reg-9a...", "status": "READY", "syncToken": "k7Q...base64url",
"tokenExpiresAt": "2026-06-22T15:05:00.000Z", "pollIntervalMs": 10000 }
// response 201 (en cola)
{ "registrationId": "reg-9a...", "status": "QUEUED", "queuePosition": 3,
"estimatedWaitMinutes": 2, "pollIntervalMs": 10000 }
GET /api/pos/sync/status/:registrationId
Polling cada pollIntervalMs (10 s) hasta status: READY.

{ "status": "SYNCING", "syncToken": "k7Q...", "tokenExpiresAt": "2026-06-22T15:05:00.000Z",
"progress": { "totalSales": 37, "syncedSales": 20, "failedSales": 0, "percentComplete": 54 },
"nextPollMs": 10000 }
POST /api/pos/sync/sales
Sube un lote de maximo 10 ventas. Header obligatorio X-Sync-Token.

// request (resumido)
{
"cashRegisterId": "6f1a...e9",
"sessionId": "ss-2026...",
"batchId": "batch-uuid-1",
"sales": [
{
"localId": "local-uuid-1",
"token": "Hk3l9Zx1Qm7BvT0a",
"offlineTicketCode": "OFF-20260622-CAJA09-0007",
"items": [
{ "productId": "a1...", "quantity": 2, "unitPriceCents": 12990, "discountCents": 0,
"productSnapshot": { "sku": "JEAN-001", "title": "Jean clasico" } }
],
"totalCents": 25980,
"customerDocumentType": "DNI",
"customerDocumentNumber": "12345678",
"customerSnapshot": { "fullName": "JUAN PEREZ", "documentType": "DNI", "documentNumber": "12345678" },
"payments": [ { "paymentMethodId": "pm-efectivo", "amountCents": 25980 } ],
"createdAt": "2026-06-22T13:10:00.000Z",
"sellerId": "u1...",
"notes": "Venta en contingencia"
}
]
}
// response 201
{ "batchId": "batch-uuid-1", "processed": 1,
"results": [ { "localId": "local-uuid-1", "token": "Hk3l9Zx1Qm7BvT0a", "status": "QUEUED", "queuePosition": 1 } ],
"nextBatchAllowedAt": "2026-06-22T15:01:03.000Z", "remainingQuota": 36 }
// resultado por venta rechazada
{ "localId": "local-uuid-9", "token": "BAD", "status": "REJECTED",
"error": "Token ya fue utilizado", "errorCode": "TOKEN_ALREADY_USED" }
Notas para el frontend:

Marcar cada venta local como SYNCED cuando reciba status: QUEUED/OK.
Si una venta vuelve REJECTED con TOKEN_ALREADY_USED, ya estaba procesada: marcarla como sincronizada (idempotencia), no reintentar.
Si cae la red a mitad del lote, reintentar el mismo lote: el backend ignora tokens ya procesados.
El sellerId que mande el cliente se ignora si hay X-Offline-Session valido: el backend usa el sub del JWT offline.
POST /api/pos/sync/complete
// request
{ "registrationId": "reg-9a..." }
// response 200
{ "status": "COMPLETED", "totalSynced": 37, "totalFailed": 0, "durationMs": 48213 }
(status: "PARTIAL" si hubo fallidas.)

GET /api/pos/sync/queue-stats
{ "queued": 2, "ready": 1, "syncing": 4, "completedToday": 88 }.

7.1 Sincronizacion de eventos de login
POST /api/pos/offline-catalog/:cashRegisterId/users/login-events
Al reconectar, enviar en lote los logins ocurridos offline. Idempotente.

// request
{
"events": [
{ "userId": "u1...", "bundleId": "8f2a-...", "occurredAt": "2026-06-22T15:32:10.000Z",
"method": "PIN", "success": true },
{ "userId": "u2...", "bundleId": "8f2a-...", "occurredAt": "2026-06-22T15:40:00.000Z",
"method": "PASSWORD", "success": false, "failureReason": "BAD_PASSWORD" }
]
}
// response 201
{ "processed": 1, "skipped": 1 }
(skipped = duplicados ya registrados; el frontend puede reenviar sin riesgo.)

8. Consulta publica por QR (lo que ve el cliente)
   El cliente escanea el QR del ticket y abre una pagina del dominio erp-aio-offline-documents.com. El frontend del POS normalmente solo genera y muestra el QR; estos endpoints los consume el navegador del cliente, no la caja.

Endpoint	Devuelve
GET /api/public/receipt/view/:token	Pagina HTML con estado y, si esta listo, boton de descarga
GET /api/public/receipt/:token (Accept: application/json)	Estado en JSON
GET /api/public/receipt/:token/pdf	Descarga el PDF (max 100/token)
Estados posibles del comprobante: PENDING, PROCESSING, COMPLETED, EXPIRED, INVALID.

// PENDING
{ "status": "PENDING", "message": "Tu comprobante se esta generando",
"estimatedWaitMinutes": 60, "offlineTicketCode": "OFF-20260622-CAJA09-0007" }
// COMPLETED
{ "status": "COMPLETED", "documentType": "BOLETA", "documentNumber": "BPPC-00001056",
"issueDate": "22/06/2026", "totalAmount": 259.80, "canDownloadPdf": true,
"pdfExpiresAt": "2026-07-22T00:00:00.000Z" }
9. Gestion del PIN del POS (online)
   El cajero define/cambia su PIN estando online, desde el menu del POS. El admin solo lo borra o desbloquea (nunca lo define). Base: /api/auth/pos-pin, auth Bearer JWT.

Accion	Endpoint	Quien
Cajero define/cambia su PIN	POST /api/auth/pos-pin/me	El propio cajero (con su password)
Ver estado del PIN	GET /api/auth/pos-pin/users/:id	Admin (users.update)
Borrar/resetear PIN	DELETE /api/auth/pos-pin/users/:id	Admin (pos.pin.reset_others)
Desbloquear por intentos	POST /api/auth/pos-pin/users/:id/unlock	Admin (pos.pin.reset_others)
// POST /api/auth/pos-pin/me  - request
{ "currentPassword": "MiPass123", "newPin": "48205173" }
// response 200
{ "status": "OK", "updatedAt": "2026-06-22T14:10:00.000Z" }
Reglas del PIN que el frontend debe reflejar en validacion de UI:

Exactamente 8 digitos numericos.
Rechazar triviales (00000000, 12345678, todos iguales, etc.).
Errores: 400 (formato/trivial), 403 (password actual incorrecta).
GET /api/auth/pos-pin/users/:id -> { "hasPin": true, "updatedAt": "...", "failedAttempts": 0, "lockedUntil": null }.

10. Manejo de errores y estados
    Codigos de error de token (en POST /pos/sync/sales, por venta)
    errorCode	Significado	Accion del frontend
    TOKEN_ALREADY_USED	El token ya se proceso	Marcar venta como sincronizada (idempotencia)
    TOKEN_NOT_FOUND	Token desconocido	Revisar; posible corrupcion local
    TOKEN_WRONG_REGISTER	Token de otra caja	No reintentar; reportar
    TOKEN_EXPIRED	Token vencido (>48h)	Marcar venta para revision manual
    Codigos HTTP
    Codigo	Cuando	Accion sugerida
    200 / 201	OK	Continuar
    204	Reset de PIN exitoso	-
    400	Validacion (cooldown 3 s, >10 ventas, PIN invalido)	Ajustar y reintentar
    403	Device-token / sync-token / offline-session invalido, password incorrecta, feature off	Re-aprovisionar device, re-login, o deshabilitar login offline
    404	Caja, sesion de sync o comprobante no encontrado	Reportar
    429	Rate-limit (QR publico)	Backoff
11. Resumen mental rapido (frontend)
    Con red: descarga catalogo, tokens y el bundle de usuarios cifrado, y guarda todo local. Sin red: descifra el bundle con el device-token (HKDF + AES-GCM), valida al cajero con argon2 (password o PIN de 8 digitos), emite un JWT offline HS256 y vende consumiendo tokens, emitiendo tickets con QR y descontando stock local. Al reconectar: pide turno (max 5 cajas), sube ventas en lotes de 10 cada 3 s con X-Sync-Token, sincroniza los eventos de login, y deja que el backend numere y emita a SUNAT. La idempotencia la garantizan el token QR unico + el localId; ante TOKEN_ALREADY_USED, la venta ya estaba procesada.