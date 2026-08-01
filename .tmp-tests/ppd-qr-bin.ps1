param(
  [Parameter(Mandatory=$true)][double]$Amount,
  [string]$Etiqueta = 'Compra QR-BIN'
)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'
$cents = [int][math]::Round($Amount * 100)

$lb = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$lf = Join-Path $dir 'qrbin-login.json'
$lb | Out-File -FilePath $lf -Encoding ascii -NoNewline
$l = & curl.exe -s -X POST "$base/API_PPAD/login" -H 'Content-Type: application/json' --data-binary "@$lf" | ConvertFrom-Json
$token = $l.token
if (-not $token) { Write-Host 'ERROR LOGIN'; exit 1 }
Write-Host "OK LOGIN"

# tx=02 SALE_WITH_BIN + ecr_data_adicional='0' habilita opciones QR + Tarjeta
$req = [ordered]@{
  ecr_aplicacion     = 'POS'
  ecr_transaccion    = '02'
  ecr_amount         = "$cents"
  ecr_currency_code  = '604'
  ecr_producto1      = '01'
  ecr_amount1        = "$cents"
  ecr_data_adicional = '0'
}
$rf = Join-Path $dir 'qrbin-req.json'
($req | ConvertTo-Json -Compress) | Out-File -FilePath $rf -Encoding ascii -NoNewline

Write-Host ""
Write-Host "===== $Etiqueta - S/ $Amount ====="
Write-Host "Body: $(Get-Content $rf)"
Write-Host ""

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$outFile = Join-Path $dir 'qrbin-resp.txt'
Remove-Item $outFile -ErrorAction SilentlyContinue
& curl.exe -s -X POST "$base/API_PPAD/procesarTransaccion" `
  -H "Authorization: Bearer $token" `
  -H 'Content-Type: application/json' `
  --max-time 180 `
  --data-binary "@$rf" `
  -o "$outFile"
$rraw = if (Test-Path $outFile) { Get-Content $outFile -Raw } else { '' }
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
  Write-Host "read_type     : $($r.read_type)"
  Write-Host "card_id       : $($r.card_id)"
  Write-Host "card          : $($r.card)"
  Write-Host "approval_code : $($r.approval_code)"
  Write-Host "amount        : $($r.amount)"
  Write-Host "merchant_id   : $($r.merchant_id)"
  Write-Host "trace_unique  : $($r.trace_unique)"
  $dt = $r.date_time
  if ($dt -and $dt.Length -ge 14) {
    $anio=$dt.Substring(0,4);$mes=$dt.Substring(4,2);$dia=$dt.Substring(6,2)
    $hh=$dt.Substring(8,2);$mm=$dt.Substring(10,2);$ss=$dt.Substring(12,2)
    Write-Host "Fecha         : $dia/$mes/$anio"
    Write-Host "Hora          : ${hh}:${mm}:${ss}"
  } else { Write-Host "date_time     : (no presente)" }
} catch { Write-Host "No JSON: $_" }
