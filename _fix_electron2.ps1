$ErrorActionPreference = 'Continue'
$env:DEBUG = '@electron/get:*'
$env:ELECTRON_GET_USE_PROXY = 'true'
Write-Host '--- Re-running install.js with DEBUG enabled ---'
node node_modules/electron/install.js 2>&1 | ForEach-Object { $_ }
Write-Host ('install.js exit code: ' + $LASTEXITCODE)
Write-Host '--- Verification ---'
if (Test-Path node_modules/electron/path.txt) {
  Write-Host ('path.txt OK: ' + (Get-Content node_modules/electron/path.txt))
} else {
  Write-Host 'path.txt MISSING'
}
if (Test-Path node_modules/electron/dist/electron.exe) {
  Write-Host 'electron.exe OK'
} else {
  Write-Host 'electron.exe MISSING'
}
