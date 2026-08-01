param(
  [double]$Amount = 3.00
)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'
$cents = [int][math]::Round($Amount * 100)
$amtPadded = "{0:D4}" -f $cents

$refs = (Get-Content (Join-Path $dir 'batch10-refs.txt')) | Select-Object -First 5
Write-Host "REFs a anular (primeras 5): $($refs -join ', ')"

# LOGIN
$lb = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$lf = Join-Path $dir 'a5-login.json'
$lb | Out-File -FilePath $lf -Encoding ascii -NoNewline
$l = & curl.exe -s -X POST "$base/API_PPAD/login" -H 'Content-Type: application/json' --data-binary "@$lf" | ConvertFrom-Json
$token = $l.token
Write-Host "OK LOGIN"

$results = @()
$i = 0
foreach ($ref in $refs) {
  $i++
  $req = [ordered]@{
    ecr_aplicacion     = 'POS'
    ecr_transaccion    = '06'
    ecr_amount         = $amtPadded
    ecr_currency_code  = '604'
    ecr_data_adicional = $ref
  }
  $rf = Join-Path $dir "a5-req-$ref.json"
  ($req | ConvertTo-Json -Compress) | Out-File -FilePath $rf -Encoding ascii -NoNewline

  Write-Host ""
  Write-Host "======================= ANULACION $i / 5  REF=$ref  S/ $Amount ======================="
  Write-Host "Ingresa clave de supervisor y presenta la Visa cuando el PPD lo pida..."
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $rraw = & curl.exe -s -X POST "$base/API_PPAD/procesarTransaccion" `
    -H "Authorization: Bearer $token" `
    -H 'Content-Type: application/json' `
    --max-time 120 `
    --data-binary "@$rf"
  $sw.Stop()
  Write-Host "Elapsed: $([math]::Round($sw.Elapsed.TotalSeconds,2)) s"
  try {
    $r = $rraw | ConvertFrom-Json
    $rc = $r.response_code
    $msg = $r.message
    $ap = $r.approval_code
    $newRef = $null
    if ($r.message -match 'REF(\d{4})') { $newRef = $matches[1] }
    Write-Host "  response_code=$rc  approval=$ap  newREF=$newRef  msg=$msg  date_time=$($r.date_time)"
    $results += [PSCustomObject]@{ Idx=$i; RefOrig=$ref; RC=$rc; Approval=$ap; NewRef=$newRef; Msg=$msg; DateTime=$r.date_time }
  } catch {
    Write-Host "  ERROR parseo. Raw: $rraw"
  }
}

Write-Host ""
Write-Host "======================= RESUMEN 5 ANULACIONES ======================="
$results | Format-Table -AutoSize
