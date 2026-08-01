$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'

$b = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$b | Set-Content -Path (Join-Path $dir 'lb.json') -Encoding ASCII
& curl.exe -sS --max-time 15 -X POST "$base/API_PPAD/login" -H "Content-Type: application/json" --data-binary "@$(Join-Path $dir 'lb.json')" -o (Join-Path $dir 'l.json')
$L = Get-Content (Join-Path $dir 'l.json') -Raw | ConvertFrom-Json
Write-Host "login: $($L.mensaje) resultado=$($L.resultado)"
$tok = $L.token

Write-Host "-- calling /test (max 45s) --"
& curl.exe -sS --max-time 45 -X POST "$base/API_PPAD/test" -H "Content-Type: application/json" -H "Authorization: Bearer $tok" -o (Join-Path $dir 't.json') -w "HTTP=%{http_code}  time=%{time_total}s`n"
Write-Host "curl exit=$LASTEXITCODE"
Write-Host "body:"
Get-Content (Join-Path $dir 't.json') -Raw
