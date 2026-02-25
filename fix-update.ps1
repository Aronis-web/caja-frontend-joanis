# Script de Reparación de Actualizaciones
# Este script limpia archivos temporales y reinicia el proceso de actualización

Write-Host "🔧 Reparando sistema de actualizaciones..." -ForegroundColor Cyan
Write-Host ""

# 1. Cerrar la aplicación si está corriendo
Write-Host "1. Cerrando aplicación..." -ForegroundColor Yellow
Get-Process -Name "CajaGrit" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# 2. Limpiar archivos temporales de actualización
Write-Host "2. Limpiando archivos temporales..." -ForegroundColor Yellow

$paths = @(
    "$env:LOCALAPPDATA\CajaGrit-updater",
    "$env:TEMP\electron-updater"
)

foreach ($path in $paths) {
    if (Test-Path $path) {
        Write-Host "   Eliminando: $path" -ForegroundColor Gray
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 3. Verificar logs
Write-Host "3. Verificando logs..." -ForegroundColor Yellow
$logPath = "$env:APPDATA\CajaGrit\electron-server.log"
if (Test-Path $logPath) {
    Write-Host "   Logs encontrados en: $logPath" -ForegroundColor Gray
    Write-Host "   Últimas 10 líneas:" -ForegroundColor Gray
    Get-Content $logPath -Tail 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
} else {
    Write-Host "   No se encontraron logs" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Limpieza completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
Write-Host "1. Ejecuta la aplicación nuevamente" -ForegroundColor White
Write-Host "2. Espera 3 segundos para que verifique actualizaciones" -ForegroundColor White
Write-Host "3. Si aparece una actualización, haz clic en 'Descargar'" -ForegroundColor White
Write-Host ""
Write-Host "Si el problema persiste, describe el error exacto que ves." -ForegroundColor Yellow
Write-Host ""

# Preguntar si quiere abrir la aplicación
$response = Read-Host "¿Deseas abrir la aplicación ahora? (S/N)"
if ($response -eq "S" -or $response -eq "s") {
    Write-Host "Abriendo aplicación..." -ForegroundColor Green
    $exePath = ".\dist\win-unpacked\CajaGrit.exe"
    if (Test-Path $exePath) {
        Start-Process $exePath
    } else {
        Write-Host "❌ No se encontró el ejecutable en: $exePath" -ForegroundColor Red
        Write-Host "Verifica que la aplicación esté compilada." -ForegroundColor Yellow
    }
}
