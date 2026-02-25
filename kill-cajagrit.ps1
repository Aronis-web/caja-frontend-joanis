# Script para cerrar todos los procesos de CajaGrit
# Útil cuando el instalador dice "CajaGrit cannot be closed"

Write-Host "🔴 Cerrando todos los procesos de CajaGrit..." -ForegroundColor Red
Write-Host ""

# Buscar todos los procesos relacionados con CajaGrit
$processes = @(
    "CajaGrit",
    "CajaGrit Setup"
)

$found = $false

foreach ($processName in $processes) {
    $runningProcesses = Get-Process -Name $processName -ErrorAction SilentlyContinue

    if ($runningProcesses) {
        $found = $true
        Write-Host "Encontrado: $processName" -ForegroundColor Yellow

        foreach ($proc in $runningProcesses) {
            Write-Host "  - PID: $($proc.Id) | Memoria: $([math]::Round($proc.WorkingSet64/1MB, 2)) MB" -ForegroundColor Gray

            try {
                Stop-Process -Id $proc.Id -Force
                Write-Host "  ✅ Proceso cerrado" -ForegroundColor Green
            } catch {
                Write-Host "  ❌ Error al cerrar: $_" -ForegroundColor Red
            }
        }
    }
}

if (-not $found) {
    Write-Host "✅ No se encontraron procesos de CajaGrit corriendo" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "✅ Todos los procesos han sido cerrados" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ahora puedes:" -ForegroundColor Cyan
    Write-Host "1. Ejecutar el instalador nuevamente" -ForegroundColor White
    Write-Host "2. O abrir la aplicación normalmente" -ForegroundColor White
}

Write-Host ""
