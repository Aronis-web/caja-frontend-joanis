param(
  [Parameter(Mandatory=$true)][string]$Ref,
  [string]$Etiqueta = 'Reimpresion'
)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'

# LOGIN
$loginBody = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$lf = Join-Path $dir 'rep-login.json'
$loginBody | Out-File -FilePath $lf -Encoding ascii -NoNewline
$l = & curl.exe -s -X POST "$base/API_PPAD/login" -H 'Content-Type: application/json' --data-binary "@$lf" | ConvertFrom-Json
$token = $l.token
if (-not $token) { Write-Host 'ERROR LOGIN'; exit 1 }
Write-Host "OK LOGIN"

# REIMPRESION (ecr_transaccion=11, ecr_data_adicional=<ref>)
$req = [ordered]@{
  ecr_aplicacion    = 'POS'
  ecr_transaccion   = '11'
  ecr_data_adicional = $Ref
}
$rf = Join-Path $dir 'rep-req.json'
($req | ConvertTo-Json -Compress) | Out-File -FilePath $rf -Encoding ascii -NoNewline

Write-Host ""
Write-Host "===== $Etiqueta - REF=$Ref ====="
Write-Host "Body: $(Get-Content $rf)"
Write-Host ""

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$rraw = & curl.exe -s -X POST "$base/API_PPAD/procesarTransaccion" `
  -H "Authorization: Bearer $token" `
  -H 'Content-Type: application/json' `
  --max-time 60 `
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
  Write-Host "approval_code : $($r.approval_code)"
  Write-Host "amount        : $($r.amount)"
  Write-Host "card          : $($r.card)"
  Write-Host "trace_unique  : $($r.trace_unique)"
  $dt = $r.date_time
  if ($dt -and $dt.Length -ge 14) {
    $anio=$dt.Substring(0,4);$mes=$dt.Substring(4,2);$dia=$dt.Substring(6,2)
    $hh=$dt.Substring(8,2);$mm=$dt.Substring(10,2);$ss=$dt.Substring(12,2)
    Write-Host "Fecha         : $dia/$mes/$anio"
    Write-Host "Hora          : ${hh}:${mm}:${ss}"
    Write-Host "ISO 8601      : $anio-$mes-${dia}T${hh}:${mm}:${ss}"
  } else {
    Write-Host "date_time     : (no presente)"
  }
} catch {
  Write-Host "No se pudo parsear JSON: $_"
}
