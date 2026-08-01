param(
  [Parameter(Mandatory=$true)][ValidateSet('01','02')][string]$Tx,   # 01=simple, 02=con BIN
  [Parameter(Mandatory=$true)][double]$Amount,
  [string]$Producto = '01',
  [string]$Etiqueta = ''
)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'

# LOGIN
$lb = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$lb | Set-Content -Path (Join-Path $dir 'lb.json') -Encoding ASCII
& curl.exe -sS --max-time 15 -X POST "$base/API_PPAD/login" -H "Content-Type: application/json" --data-binary "@$(Join-Path $dir 'lb.json')" -o (Join-Path $dir 'l.json') | Out-Null
$L = Get-Content (Join-Path $dir 'l.json') -Raw | ConvertFrom-Json
$tok = $L.token
if (-not $tok) { Write-Host "LOGIN FAIL"; exit 1 }

$cents = [int][math]::Round($Amount * 100)
$req = [ordered]@{
  ecr_aplicacion    = 'POS'
  ecr_transaccion   = $Tx
  ecr_amount        = "$cents"
  ecr_currency_code = '604'
}
if ($Tx -eq '02') {
  $req.ecr_producto1 = $Producto
  $req.ecr_amount1   = "$cents"
}
$body = ($req | ConvertTo-Json -Compress)

Write-Host ("================ {0}  Tx={1}  S/ {2}  =================" -f $Etiqueta, $Tx, $Amount.ToString('N2')) -ForegroundColor Yellow
Write-Host "REQUEST:" -ForegroundColor DarkGray
Write-Host $body

$bf = Join-Path $dir ("req-{0}-{1}.json" -f $Tx,$cents)
$body | Set-Content -Path $bf -Encoding ASCII

$rf = Join-Path $dir ("resp-{0}-{1}-{2}.json" -f $Tx,$cents,(Get-Date -Format 'HHmmss'))
& curl.exe -sS --max-time 180 -X POST "$base/API_PPAD/procesarTransaccion" `
  -H "Content-Type: application/json" -H "Authorization: Bearer $tok" `
  --data-binary "@$bf" -o $rf -w "HTTP=%{http_code} time=%{time_total}s`n"

Write-Host ""
Write-Host "===== RESPUESTA (JSON PARA COPIAR) =====" -ForegroundColor Green
$raw = Get-Content $rf -Raw
Write-Host $raw

# Parse and extract date_time
try {
  $r = $raw | ConvertFrom-Json
  Write-Host ""
  Write-Host "===== FECHA / HORA DE LA TRANSACCION =====" -ForegroundColor Cyan
  $dt = $r.date_time
  if ($dt -and $dt.Length -ge 14) {
    $anio = $dt.Substring(0,4)
    $mes  = $dt.Substring(4,2)
    $dia  = $dt.Substring(6,2)
    $hora = $dt.Substring(8,2)
    $min  = $dt.Substring(10,2)
    $seg  = $dt.Substring(12,2)
    Write-Host ("date_time (raw):  {0}" -f $dt)
    Write-Host ("Fecha:            {0}/{1}/{2}" -f $dia,$mes,$anio)
    Write-Host ("Hora:             {0}:{1}:{2}" -f $hora,$min,$seg)
    Write-Host ("ISO 8601:         {0}-{1}-{2}T{3}:{4}:{5}" -f $anio,$mes,$dia,$hora,$min,$seg)
  } else {
    Write-Host "date_time no presente en la respuesta."
  }
  Write-Host ""
  Write-Host "===== RESUMEN =====" -ForegroundColor Cyan
  Write-Host ("response_code : {0}" -f $r.response_code)
  Write-Host ("message       : {0}" -f $r.message)
  Write-Host ("approval_code : {0}" -f $r.approval_code)
  Write-Host ("card_id       : {0}" -f $r.card_id)
  Write-Host ("card          : {0}" -f $r.card)
  Write-Host ("read_type     : {0}   (C=chip, L=contactless, B=banda)" -f $r.read_type)
  Write-Host ("amount        : {0}" -f $r.amount)
  Write-Host ("trace_unique  : {0}" -f $r.trace_unique)
  Write-Host ("batch/lote    : {0}" -f $r.batch_number)
  Write-Host ("merchant_id   : {0}" -f $r.merchant_id)
} catch {
  Write-Host "No se pudo parsear la respuesta: $($_.Exception.Message)"
}
