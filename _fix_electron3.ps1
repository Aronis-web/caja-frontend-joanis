$ErrorActionPreference = 'Stop'
$zip = 'C:\Users\aaron\AppData\Local\electron\Cache\b69af54aefc8fbedf66bb3fd2c252277c5ae6eb71a3b48f88255ceb855e9ca92\electron-v40.6.0-win32-x64.zip'
$dist = 'node_modules\electron\dist'
Write-Host '--- Step 1: clear partial dist ---'
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Path $dist | Out-Null
Write-Host '--- Step 2: expand-archive (this may take a minute) ---'
Expand-Archive -Path $zip -DestinationPath $dist -Force
Write-Host '--- Step 3: write path.txt ---'
Set-Content -Path 'node_modules\electron\path.txt' -Value 'electron.exe' -NoNewline -Encoding ascii
Write-Host '--- Step 4: move electron.d.ts up if present ---'
$srcDts = Join-Path $dist 'electron.d.ts'
if (Test-Path $srcDts) {
  Move-Item -Force $srcDts 'node_modules\electron\electron.d.ts'
  Write-Host 'electron.d.ts moved up'
}
Write-Host '--- Verification ---'
if (Test-Path 'node_modules\electron\dist\electron.exe') { Write-Host 'electron.exe OK' } else { Write-Host 'electron.exe MISSING'; exit 1 }
if (Test-Path 'node_modules\electron\path.txt') { Write-Host ('path.txt: ' + (Get-Content 'node_modules\electron\path.txt' -Raw)) } else { Write-Host 'path.txt MISSING'; exit 1 }
$total = (Get-ChildItem -Recurse $dist | Measure-Object Length -Sum)
Write-Host ('dist size: ' + [math]::Round($total.Sum/1MB, 1) + ' MB across ' + $total.Count + ' files')
