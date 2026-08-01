# run-sandbox.ps1 - arranca el simulador OpenPay + openpay-bridge en modo sandbox.
#
# Levanta dos procesos en segundo plano:
#   1) sandbox\simulador_windows.exe   -> HOST simulado en http://localhost:9000
#   2) bin\Release\openpay-bridge.exe  -> API HTTP en http://localhost:9091
#
# Logs de ambos van a openpay-bridge\logs\. Ctrl+C detiene todo limpiamente.
#
# Requisitos:
#   - Haber corrido build.ps1 (bin\Release\openpay-bridge.exe existe).
#   - Copiado Sandbox_1.0.37\* a openpay-bridge\sandbox\.
#   - PinPad fisico conectado en el COM configurado en Local.config
#     (el SDK EGlobal exige un PPD real por COM incluso en sandbox;
#     la parte "sandbox" solo suplanta el back-end OpenPay, no el PPD).

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$bridgeExe = Join-Path $here 'bin\Release\openpay-bridge.exe'
$simExe    = Join-Path $here 'sandbox\simulador_windows.exe'

if (-not (Test-Path $bridgeExe)) {
    Write-Host "[ERROR] No existe $bridgeExe. Corre .\build.ps1 primero." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $simExe)) {
    Write-Host "[ERROR] No existe $simExe. Copia Sandbox_1.0.37\* a openpay-bridge\sandbox\." -ForegroundColor Red
    exit 1
}

$logsDir = Join-Path $here 'logs'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

# Limpia procesos zombie: Electron (o un run-sandbox previo cerrado sin
# cleanup) puede haber dejado un openpay-bridge.exe registrado en http.sys,
# reservando el prefijo http://localhost:9091/. Si no lo matamos, el nuevo
# bridge fallara con "conflicts with an existing registration".
$stale = Get-Process openpay-bridge -ErrorAction SilentlyContinue
if ($stale) {
    Write-Host "[sandbox] Matando openpay-bridge previo (pid $(($stale | Select -First 1).Id))..." -ForegroundColor Yellow
    $stale | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}
$staleSim = Get-Process simulador_windows -ErrorAction SilentlyContinue
if ($staleSim) {
    Write-Host "[sandbox] Matando simulador previo (pid $(($staleSim | Select -First 1).Id))..." -ForegroundColor Yellow
    $staleSim | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# IMPORTANTE: arrancamos el bridge PRIMERO (antes del simulador) para ganar
# la carrera contra el auto-restart de Electron. Si Electron esta corriendo,
# tras matar su bridge programa un setTimeout(3s) que lo relanza. Si esperamos
# 3s (start simulador + sleep) para spawnear el nuestro, Electron gana el
# puerto :9091 y nuestro bridge muere con "conflicts with existing registration".
Write-Host "[sandbox] Iniciando openpay-bridge (localhost:9091)..." -ForegroundColor Cyan
$bridge = Start-Process -FilePath $bridgeExe `
    -WorkingDirectory (Split-Path $bridgeExe) `
    -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $logsDir 'bridge.stdout.log') `
    -RedirectStandardError  (Join-Path $logsDir 'bridge.stderr.log')

Start-Sleep -Milliseconds 500

Write-Host "[sandbox] Iniciando simulador OpenPay (localhost:9000)..." -ForegroundColor Cyan
# El simulador se lanza VISIBLE: es la UI donde se "presenta" la tarjeta
# durante una venta sandbox (tap / insert / QR). Sin esta ventana el SDK
# no puede completar operaciones y devuelve "Error al recuperar la tarjeta".
$sim = Start-Process -FilePath $simExe `
    -WorkingDirectory (Split-Path $simExe) `
    -PassThru

Start-Sleep -Seconds 2

Write-Host ""
Write-Host "[sandbox] Corriendo:" -ForegroundColor Green
Write-Host "   Simulador (host): http://localhost:9000  (pid $($sim.Id))"
Write-Host "   Bridge (API):     http://localhost:9091  (pid $($bridge.Id))"
Write-Host ""
# Deteccion temprana: si el bridge murio en el arranque (tipicamente por
# conflicto de puerto con un openpay-bridge de Electron), abortamos con
# mensaje claro en vez de dejar el script colgado.
if ($bridge.HasExited) {
    Write-Host ""
    Write-Host "[ERROR] El bridge murio inmediatamente (exit $($bridge.ExitCode))." -ForegroundColor Red
    Write-Host "        Causa mas comun: la app Electron esta corriendo y su" -ForegroundColor Red
    Write-Host "        auto-restart tomo el puerto 9091 antes que nosotros." -ForegroundColor Red
    Write-Host "        Cierra Electron, o revisa logs\bridge.stdout.log." -ForegroundColor Red
    if (-not $sim.HasExited) { Stop-Process -Id $sim.Id -Force -ErrorAction SilentlyContinue }
    exit 2
}

Write-Host "[sandbox] Sonda /health..."
try {
    $health = Invoke-RestMethod -Uri 'http://localhost:9091/health' -TimeoutSec 5
    Write-Host "   -> $($health | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] /health fallo: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "[sandbox] Logs: $logsDir"
Write-Host "[sandbox] Ctrl+C para detener ambos procesos."
Write-Host ""

# Cleanup en Ctrl+C
try {
    while ($true) {
        if ($sim.HasExited) {
            Write-Host "[sandbox] Simulador termino (code $($sim.ExitCode))" -ForegroundColor Yellow
        }
        if ($bridge.HasExited) {
            Write-Host "[sandbox] Bridge termino (code $($bridge.ExitCode))" -ForegroundColor Yellow
            break
        }
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host ""
    Write-Host "[sandbox] Deteniendo..." -ForegroundColor Cyan
    if (-not $bridge.HasExited) { Stop-Process -Id $bridge.Id -Force -ErrorAction SilentlyContinue }
    if (-not $sim.HasExited)    { Stop-Process -Id $sim.Id    -Force -ErrorAction SilentlyContinue }
    Write-Host "[sandbox] Detenido." -ForegroundColor Green
}
