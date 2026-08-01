param(
  [Parameter(Mandatory=$true)][string]$Url,
  [Parameter(Mandatory=$true)][string]$Token,
  [Parameter(Mandatory=$true)][string]$BodyFile,
  [Parameter(Mandatory=$true)][string]$Out,
  [int]$TimeoutSec = 45
)
$ErrorActionPreference = 'Continue'

$respBody = Join-Path (Split-Path $Out) 'bg-httpbody.txt'
$respHead = Join-Path (Split-Path $Out) 'bg-httphead.txt'
Remove-Item $respBody,$respHead -ErrorAction SilentlyContinue

$sw = [System.Diagnostics.Stopwatch]::StartNew()
# curl con timeout DURO
& curl.exe -sS --max-time $TimeoutSec -X POST "$Url" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $Token" `
  --data-binary "@$BodyFile" `
  -o "$respBody" `
  -D "$respHead" `
  -w "HTTP=%{http_code} time=%{time_total}s`n" 2>&1 | Set-Content -Path (Join-Path (Split-Path $Out) 'bg-curl.log') -Encoding UTF8
$exit = $LASTEXITCODE
$sw.Stop()

$bodyText = ''
if (Test-Path $respBody) { $bodyText = Get-Content -Path $respBody -Raw }
$headText = ''
if (Test-Path $respHead) { $headText = Get-Content -Path $respHead -Raw }

$wrap = [ordered]@{
  curl_exit_code = $exit
  elapsed_s      = $sw.Elapsed.TotalSeconds
  http_headers   = $headText
  raw_body       = $bodyText
}
if ($exit -eq 0 -and $bodyText) {
  try { $wrap.response = ($bodyText | ConvertFrom-Json); $wrap.ok = $true } catch { $wrap.ok = $false; $wrap.parse_error = $_.Exception.Message }
} else {
  $wrap.ok = $false
  # curl exit codes: 28 = timeout, 7 = couldnt connect, 52 = empty reply, 56 = failure receiving
  switch ($exit) {
    28 { $wrap.error = "TIMEOUT (curl 28) - servidor no respondio en $TimeoutSec s" }
    7  { $wrap.error = "CONNECT FAIL (curl 7)" }
    52 { $wrap.error = "EMPTY REPLY (curl 52)" }
    56 { $wrap.error = "RECV FAIL (curl 56)" }
    default { $wrap.error = "curl exit=$exit" }
  }
}
$wrap | ConvertTo-Json -Depth 20 | Set-Content -Path $Out -Encoding UTF8
