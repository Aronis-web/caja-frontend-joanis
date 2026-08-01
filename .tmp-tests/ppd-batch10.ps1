param(
  [double]$Amount = 3.00,
  [int]$Count = 10
)
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:9090'
$dir  = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'
$cents = [int][math]::Round($Amount * 100)
$refsFile = Join-Path $dir 'batch10-refs.txt'
Remove-Item $refsFile -ErrorAction SilentlyContinue

# LOGIN
$lb = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json -Compress
$lf = Join-Path $dir 'b10-login.json'
$lb | Out-File -FilePath $lf -Encoding ascii -NoNewline
$l = & curl.exe -s -X POST "$base/API_PPAD/login" -H 'Content-Type: application/json' --data-binary "@$lf" | ConvertFrom-Json
$token = $l.token
if (-not $token) { Write-Host 'ERROR LOGIN'; exit 1 }
Write-Host "OK LOGIN"

$req = [ordered]@{
  ecr_aplicacion    = 'POS'
  ecr_transaccion   = '02'
  ecr_amount        = "$cents"
  ecr_currency_code = '604'
  ecr_producto1     = '01'
  ecr_amount1       = "$cents"
}
$reqFile = Join-Path $dir 'b10-req.json'
($req | ConvertTo-Json -Compress) | Out-File -FilePath $reqFile -Encoding ascii -NoNewline

$results = @()
for ($i = 1; $i -le $Count; $i++) {
  Write-Host ""
  Write-Host "======================= COMPRA $i / $Count  S/ $Amount ======================="
  Write-Host "Presenta la Visa cuando el PPD lo pida..."
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $rraw = & curl.exe -s -X POST "$base/API_PPAD/procesarTransaccion" `
    -H "Authorization: Bearer $token" `
    -H 'Content-Type: application/json' `
    --max-time 120 `
    --data-binary "@$reqFile"
  $sw.Stop()
  Write-Host "Elapsed: $([math]::Round($sw.Elapsed.TotalSeconds,2)) s"
  try {
    $r = $rraw | ConvertFrom-Json
    $ref = if ($r.print_data -and $r.message -match 'REF(\d{4})') { $matches[1] } else { $null }
    if (-not $ref -and $r.message -match 'REF(\d{4})') { $ref = $matches[1] }
    $ap  = $r.approval_code
    $rc  = $r.response_code
    $dt  = $r.date_time
    Write-Host "  response_code=$rc  approval=$ap  REF=$ref  date_time=$dt"
    if ($rc -eq '00' -and $ref) {
      Add-Content -Path $refsFile -Value $ref
      $results += [PSCustomObject]@{ Idx=$i; Ref=$ref; Approval=$ap; DateTime=$dt; Response=$rc }
    } else {
      Write-Host "  ⚠ Rechazada o sin REF - no se guarda. Raw: $rraw"
      $results += [PSCustomObject]@{ Idx=$i; Ref=$null; Approval=$ap; DateTime=$dt; Response=$rc }
    }
  } catch {
    Write-Host "  ERROR parseo: $_"
    Write-Host "  Raw: $rraw"
  }
}

Write-Host ""
Write-Host "======================= RESUMEN DE 10 COMPRAS ======================="
$results | Format-Table -AutoSize
Write-Host ""
Write-Host "REFs guardadas en: $refsFile"
Get-Content $refsFile
