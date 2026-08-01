# Compra con SOLICITUD DE BIN (ecr_transaccion=02)
# Chip, Contactless (CTLS) y Banda -> el tipo de lectura lo elige el PPD.
# Visa <= S/ 10.99, Mastercard > S/ 11.00 y <= S/ 20.00
#
# Uso: pasar -Amount (en soles) por parametro. Marca la eliges insertando/tocando/deslizando la tarjeta.
param(
  [Parameter(Mandatory=$true)][double]$Amount,
  [string]$Label = 'BIN'
)

$ErrorActionPreference = 'Continue'
$base   = 'http://localhost:9090'
$outDir = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'

# 1) LOGIN
Write-Host "=== LOGIN ===" -ForegroundColor Cyan
$loginBody = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$loginFile = Join-Path $outDir 'login.json'
$loginBody | Set-Content -Path (Join-Path $outDir 'login-body.json') -Encoding ASCII

& curl.exe -sS --max-time 15 -X POST "$base/API_PPAD/login" `
  -H "Content-Type: application/json" `
  --data-binary "@$(Join-Path $outDir 'login-body.json')" `
  -o $loginFile
if ($LASTEXITCODE -ne 0) { Write-Host "curl login exit=$LASTEXITCODE" -ForegroundColor Red; exit 1 }
$login = Get-Content $loginFile -Raw | ConvertFrom-Json
Write-Host ($login | ConvertTo-Json -Compress)
$token = $login.token
if (-not $token) { Write-Host "Sin token" -ForegroundColor Red; exit 1 }

# 2) VENTA CON BIN
$amountCents = [int][math]::Round($Amount * 100)
Write-Host ""
Write-Host "=== VENTA CON BIN ($Label)  S/ $($Amount.ToString('N2'))  = $amountCents cents ===" -ForegroundColor Yellow
Write-Host ">>> En el PPD: inserte CHIP, acerque CTLS o deslice BANDA segun corresponda <<<" -ForegroundColor Yellow

$body = @{
  ecr_aplicacion    = 'POS'
  ecr_transaccion   = '02'          # SALE_WITH_BIN
  ecr_amount        = "$amountCents"
  ecr_currency_code = '604'
} | ConvertTo-Json -Compress

$bodyFile = Join-Path $outDir "bin-body-$amountCents.json"
$body | Set-Content -Path $bodyFile -Encoding ASCII

$respFile = Join-Path $outDir "bin-resp-$amountCents.json"
& curl.exe -sS --max-time 180 -X POST "$base/API_PPAD/procesarTransaccion" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $token" `
  --data-binary "@$bodyFile" `
  -o $respFile -w "HTTP=%{http_code}  time=%{time_total}s`n"

if ($LASTEXITCODE -ne 0) {
  Write-Host "curl exit=$LASTEXITCODE (timeout o error de red)" -ForegroundColor Red
  exit 1
}

Write-Host "--- RESPUESTA ---" -ForegroundColor Green
$raw = Get-Content $respFile -Raw
Write-Host $raw
try {
  $resp = $raw | ConvertFrom-Json
  Write-Host ""
  Write-Host ("resumen: response_code={0}  message={1}  approval_code={2}  card_brand={3}  card_read_type={4}  card_number={5}  bin={6}" -f `
    $resp.response_code, $resp.message, $resp.approval_code, $resp.card_brand, $resp.card_read_type, $resp.card_number, $resp.card_bin) -ForegroundColor Cyan
} catch {}
