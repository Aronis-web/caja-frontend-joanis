param(
  [Parameter(Mandatory=$true)][ValidateSet('09','10','12','19','20')][string]$Tx,
  [string]$Etiqueta = 'Reporte'
)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'

$lb = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$lf = Join-Path $dir 'rep-login2.json'
$lb | Out-File -FilePath $lf -Encoding ascii -NoNewline
$l = & curl.exe -s -X POST "$base/API_PPAD/login" -H 'Content-Type: application/json' --data-binary "@$lf" | ConvertFrom-Json
$token = $l.token
if (-not $token) { Write-Host 'ERROR LOGIN'; exit 1 }
Write-Host "OK LOGIN"

$req = [ordered]@{
  ecr_aplicacion  = 'POS'
  ecr_transaccion = $Tx
}
$rf = Join-Path $dir "rep2-req-$Tx.json"
($req | ConvertTo-Json -Compress) | Out-File -FilePath $rf -Encoding ascii -NoNewline

Write-Host ""
Write-Host "===== $Etiqueta - Tx=$Tx ====="
Write-Host "Body: $(Get-Content $rf)"
Write-Host ""

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$rraw = & curl.exe -s -X POST "$base/API_PPAD/procesarTransaccion" `
  -H "Authorization: Bearer $token" `
  -H 'Content-Type: application/json' `
  --max-time 120 `
  --data-binary "@$rf"
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
  $dt = $r.date_time
  if ($dt -and $dt.Length -ge 14) {
    $anio=$dt.Substring(0,4);$mes=$dt.Substring(4,2);$dia=$dt.Substring(6,2)
    $hh=$dt.Substring(8,2);$mm=$dt.Substring(10,2);$ss=$dt.Substring(12,2)
    Write-Host "Fecha         : $dia/$mes/$anio"
    Write-Host "Hora          : ${hh}:${mm}:${ss}"
  }
  if ($r.print_data) {
    Write-Host ""
    Write-Host "===== VOUCHER (print_data legible) ====="
    ($r.print_data -split "`r") | ForEach-Object { $_ -replace '^[A-Za-z]', '' } | ForEach-Object { Write-Host $_ }
  }
} catch { Write-Host "No JSON: $_" }
