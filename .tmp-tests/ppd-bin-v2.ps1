param(
  [Parameter(Mandatory=$true)][double]$Amount,
  [string]$Producto = '01'
)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'

# LOGIN
$b = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$b | Set-Content -Path (Join-Path $dir 'lb.json') -Encoding ASCII
& curl.exe -sS --max-time 15 -X POST "$base/API_PPAD/login" -H "Content-Type: application/json" --data-binary "@$(Join-Path $dir 'lb.json')" -o (Join-Path $dir 'l.json')
$L = Get-Content (Join-Path $dir 'l.json') -Raw | ConvertFrom-Json
$tok = $L.token
Write-Host "login OK"

$cents = [int][math]::Round($Amount * 100)
Write-Host "=== VENTA CON BIN + producto=$Producto  S/ $($Amount.ToString('N2')) ($cents c) ===" -ForegroundColor Yellow

$body = @{
  ecr_aplicacion    = 'POS'
  ecr_transaccion   = '02'
  ecr_amount        = "$cents"
  ecr_currency_code = '604'
  ecr_producto1     = $Producto
  ecr_amount1       = "$cents"
} | ConvertTo-Json -Compress

$bf = Join-Path $dir "bin2-$cents-$Producto.json"
$body | Set-Content -Path $bf -Encoding ASCII
Write-Host "REQUEST: $body"

$rf = Join-Path $dir "bin2-resp-$cents-$Producto.json"
& curl.exe -sS --max-time 180 -X POST "$base/API_PPAD/procesarTransaccion" `
  -H "Content-Type: application/json" -H "Authorization: Bearer $tok" `
  --data-binary "@$bf" -o $rf -w "HTTP=%{http_code} time=%{time_total}s`n"

Write-Host "--- RESPUESTA ---" -ForegroundColor Green
Get-Content $rf -Raw
