param(
  [Parameter(Mandatory=$true)][string]$Ref,     # Numero de referencia del voucher a anular (ej: 0178)
  [Parameter(Mandatory=$true)][double]$Amount,  # Monto en soles (ej: 0.90)
  [string]$Etiqueta = 'Anulacion'
)
$cents = [int][math]::Round($Amount * 100)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'

# 1) LOGIN
$loginBody = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$loginFile = Join-Path $dir 'anul-login.json'
$loginBody | Out-File -FilePath $loginFile -Encoding ascii -NoNewline
$lresp = & curl.exe -s -X POST "$base/API_PPAD/login" -H 'Content-Type: application/json' -H 'Accept: application/json' --data-binary "@$loginFile"
$ljson = $lresp | ConvertFrom-Json
$token = $ljson.token
if (-not $token) { Write-Host "ERROR LOGIN: $lresp"; exit 1 }
Write-Host "OK LOGIN (token len=$($token.Length))"

# 2) ANULACION (ecr_transaccion=06, ecr_data_adicional=<referencia>)
$req = [ordered]@{
  ecr_aplicacion     = 'POS'
  ecr_transaccion    = '06'
  ecr_amount         = ("{0:D4}" -f $cents)
  ecr_currency_code  = '604'
  ecr_data_adicional = $Ref
}
$reqFile = Join-Path $dir 'anul-req.json'
($req | ConvertTo-Json -Compress) | Out-File -FilePath $reqFile -Encoding ascii -NoNewline

Write-Host ""
Write-Host "===== $Etiqueta - REF=$Ref ====="
Write-Host "Body: $(Get-Content $reqFile)"
Write-Host ""

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$rraw = & curl.exe -s -X POST "$base/API_PPAD/procesarTransaccion" `
  -H "Authorization: Bearer $token" `
  -H 'Content-Type: application/json' `
  -H 'Accept: application/json' `
  --max-time 90 `
  --data-binary "@$reqFile"
$sw.Stop()
Write-Host "Elapsed: $([math]::Round($sw.Elapsed.TotalSeconds,2)) s"
Write-Host ""
Write-Host "===== RESPUESTA RAW (para copiar) ====="
Write-Host $rraw
Write-Host "======================================="

try {
  $r = $rraw | ConvertFrom-Json
  Write-Host ""
  Write-Host "response_code : $($r.response_code)"
  Write-Host "message       : $($r.message)"
  Write-Host "approval_code : $($r.approval_code)"
  Write-Host "amount        : $($r.amount)"
  Write-Host "card          : $($r.card)"
  Write-Host "trace_unique  : $($r.trace_unique)"
  $dt = $r.date_time
  if ($dt -and $dt.Length -ge 14) {
    $anio = $dt.Substring(0,4); $mes = $dt.Substring(4,2); $dia = $dt.Substring(6,2)
    $hh = $dt.Substring(8,2); $mm = $dt.Substring(10,2); $ss = $dt.Substring(12,2)
    Write-Host "date_time raw : $dt"
    Write-Host "Fecha         : $dia/$mes/$anio"
    Write-Host "Hora          : ${hh}:${mm}:${ss}"
    Write-Host "ISO 8601      : $anio-$mes-${dia}T${hh}:${mm}:${ss}"
  } else {
    Write-Host "date_time     : (no presente)"
  }
} catch {
  Write-Host "No se pudo parsear JSON: $_"
}
