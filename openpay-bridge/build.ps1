# build.ps1 - compila openpay-bridge sin depender de Visual Studio.
#
# Requiere:
#   - Windows con .NET Framework 4.x runtime (viene por defecto).
#   - openpay-bridge/lib/EGlobal.TotalPOS.Peru.SDK.dll (copiar del ZIP de EGlobal
#     antes de compilar).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File .\build.ps1

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

# Verificar que la DLL del SDK este copiada.
$sdkDll = Join-Path $here 'lib\EGlobal.TotalPOS.Peru.SDK.dll'
if (-not (Test-Path $sdkDll)) {
    Write-Host ""
    Write-Host "[ERROR] Falta la DLL del SDK: $sdkDll" -ForegroundColor Red
    Write-Host "        Copia EGlobal.TotalPOS.Peru.SDK.dll (del ZIP TotalPos SDK.Net" -ForegroundColor Yellow
    Write-Host "        de EGlobal) a openpay-bridge\lib\ y vuelve a intentar." -ForegroundColor Yellow
    exit 1
}

# Buscar MSBuild:
#   1) Framework64\v4.0.30319\MSBuild.exe (siempre presente en Windows con .NET 4.x)
#   2) MSBuild moderno de Visual Studio Build Tools (si esta instalado)
$candidates = @(
    'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\MSBuild.exe',
    'C:\Windows\Microsoft.NET\Framework\v4.0.30319\MSBuild.exe'
)
$vsWhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
if (Test-Path $vsWhere) {
    $vsMsBuild = & $vsWhere -latest -requires Microsoft.Component.MSBuild -find 'MSBuild\**\Bin\MSBuild.exe' 2>$null | Select-Object -First 1
    if ($vsMsBuild) { $candidates = @($vsMsBuild) + $candidates }
}

$msbuild = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $msbuild) {
    Write-Host "[ERROR] MSBuild no encontrado." -ForegroundColor Red
    exit 1
}

Write-Host "[build] MSBuild: $msbuild"
& $msbuild openpay-bridge.csproj /p:Configuration=Release /nologo /verbosity:minimal

# Limpiar archivos espureos que MSBuild v4.0 a veces copia (mscorlib.dll,
# norm*.nlp) por el warning MSB3644 de reference assemblies.
$release = Join-Path $here 'bin\Release'
Get-ChildItem -Path $release -Include 'mscorlib.dll','norm*.nlp' -File -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host ""
Write-Host "[build] OK - output: $release\openpay-bridge.exe" -ForegroundColor Green
