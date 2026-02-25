# Script para publicar actualizaciones automáticas
# Uso: .\publish-update.ps1 -Version "0.0.2" -GithubToken "tu_token"

param(
    [Parameter(Mandatory=$true)]
    [string]$Version,

    [Parameter(Mandatory=$false)]
    [string]$GithubToken = $env:GH_TOKEN,

    [Parameter(Mandatory=$false)]
    [switch]$Draft = $false
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Publicación de Actualización" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Validar que el token existe
if ([string]::IsNullOrEmpty($GithubToken)) {
    Write-Host "ERROR: No se encontró el token de GitHub." -ForegroundColor Red
    Write-Host "Configura la variable de entorno GH_TOKEN o pasa el token como parámetro." -ForegroundColor Yellow
    Write-Host "Ejemplo: .\publish-update.ps1 -Version '0.0.2' -GithubToken 'tu_token'" -ForegroundColor Yellow
    exit 1
}

# Configurar token
$env:GH_TOKEN = $GithubToken

Write-Host "1. Actualizando versión en package.json..." -ForegroundColor Green
# Leer package.json
$packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
$oldVersion = $packageJson.version

# Actualizar versión
$packageJson.version = $Version

# Guardar package.json
$packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"

Write-Host "   Versión actualizada: $oldVersion -> $Version" -ForegroundColor Gray
Write-Host ""

Write-Host "2. Generando build..." -ForegroundColor Green
if ($Draft) {
    npm run publish:draft
} else {
    npm run publish
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Falló la generación del build." -ForegroundColor Red
    # Revertir cambios en package.json
    $packageJson.version = $oldVersion
    $packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"
    Write-Host "Se revirtió la versión en package.json" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ Actualización publicada exitosamente" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Versión: $Version" -ForegroundColor Cyan
Write-Host "Release: https://github.com/TU_USUARIO/TU_REPOSITORIO/releases" -ForegroundColor Cyan
Write-Host ""
Write-Host "Las aplicaciones instaladas recibirán la notificación automáticamente." -ForegroundColor Yellow
