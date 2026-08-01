$ErrorActionPreference = 'Stop'
$base = 'http://localhost:9090'

Write-Host '=== 1. LOGIN ===' -ForegroundColor Cyan
$loginBody = @{ ecr_usuario = 'izipay'; ecr_password = 'izipay' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/API_PPAD/login" -Method Post -Body $loginBody -ContentType 'application/json'
$login | ConvertTo-Json -Depth 10
$token = $login.token
if (-not $token) { throw 'No se obtuvo token' }
$headers = @{ Authorization = "Bearer $token" }

Write-Host ''
Write-Host '=== 2. TEST CONEXION PINPAD ===' -ForegroundColor Cyan
$test = Invoke-RestMethod -Uri "$base/API_PPAD/test" -Method Post -Headers $headers -ContentType 'application/json'
$test | ConvertTo-Json -Depth 10

Write-Host ''
Write-Host '=== 3. VENTA VISA S/ 10.99 (CHIP - INSERTE TARJETA VISA) ===' -ForegroundColor Yellow
Write-Host '>>> Inserte la tarjeta VISA con chip en el PinPad cuando lo indique <<<' -ForegroundColor Yellow
$saleVisa = @{
  ecr_aplicacion    = 'POS'
  ecr_transaccion   = '01'
  ecr_amount        = '1099'
  ecr_currency_code = '604'
} | ConvertTo-Json
$respVisa = Invoke-RestMethod -Uri "$base/API_PPAD/procesarTransaccion" -Method Post -Headers $headers -Body $saleVisa -ContentType 'application/json' -TimeoutSec 180
Write-Host '--- RESPUESTA VISA ---' -ForegroundColor Green
$respVisa | ConvertTo-Json -Depth 10

Write-Host ''
Write-Host '=== 4. VENTA MASTERCARD S/ 15.00 (CHIP - INSERTE TARJETA MASTERCARD) ===' -ForegroundColor Yellow
Write-Host '>>> Inserte la tarjeta MASTERCARD con chip en el PinPad cuando lo indique <<<' -ForegroundColor Yellow
$saleMC = @{
  ecr_aplicacion    = 'POS'
  ecr_transaccion   = '01'
  ecr_amount        = '1500'
  ecr_currency_code = '604'
} | ConvertTo-Json
$respMC = Invoke-RestMethod -Uri "$base/API_PPAD/procesarTransaccion" -Method Post -Headers $headers -Body $saleMC -ContentType 'application/json' -TimeoutSec 180
Write-Host '--- RESPUESTA MASTERCARD ---' -ForegroundColor Green
$respMC | ConvertTo-Json -Depth 10

Write-Host ''
Write-Host '=== RESUMEN ===' -ForegroundColor Cyan
Write-Host ("Visa S/ 10.99  -> response_code: {0} | approval_code: {1} | brand: {2} | read_type: {3}" -f $respVisa.response_code, $respVisa.approval_code, $respVisa.card_brand, $respVisa.card_read_type)
Write-Host ("MC   S/ 15.00  -> response_code: {0} | approval_code: {1} | brand: {2} | read_type: {3}" -f $respMC.response_code, $respMC.approval_code, $respMC.card_brand, $respMC.card_read_type)
