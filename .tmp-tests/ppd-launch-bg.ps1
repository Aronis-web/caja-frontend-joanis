param(
  [Parameter(Mandatory=$true)][ValidateSet('01','02')][string]$Tx,
  [Parameter(Mandatory=$true)][double]$Amount,
  [string]$Label = ''
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
if (-not $tok) { Write-Host 'LOGIN FAIL'; exit 1 }

$cents = [int][math]::Round($Amount * 100)
$req = [ordered]@{
  ecr_aplicacion    = 'POS'
  ecr_transaccion   = $Tx
  ecr_amount        = "$cents"
  ecr_currency_code = '604'
}
if ($Tx -eq '02') {
  $req.ecr_producto1 = '01'
  $req.ecr_amount1   = "$cents"
}
$body = ($req | ConvertTo-Json -Compress)
$rf   = Join-Path $dir 'bg-resp.json'
$bf   = Join-Path $dir 'bg-body.json'
Remove-Item $rf -ErrorAction SilentlyContinue
$body | Set-Content -Path $bf -Encoding ASCII

Write-Host "REQUEST: $body"

$worker = Join-Path $dir 'ppd-worker.ps1'
$url    = "$base/API_PPAD/procesarTransaccion"

# Lanzar worker desacoplado (body por archivo para evitar problemas de escape)
$p = Start-Process -FilePath 'powershell.exe' -ArgumentList @(
  '-NoProfile','-ExecutionPolicy','Bypass',
  '-File', $worker,
  '-Url', $url,
  '-Token', $tok,
  '-BodyFile', $bf,
  '-Out', $rf,
  '-TimeoutSec', '60'
) -WindowStyle Hidden -PassThru

$p.Id | Set-Content -Path (Join-Path $dir 'bg-pid.txt') -Encoding ASCII
Write-Host ("Worker PID = " + $p.Id)
Write-Host "OK - transaccion en background. Use wait-bg.ps1"
