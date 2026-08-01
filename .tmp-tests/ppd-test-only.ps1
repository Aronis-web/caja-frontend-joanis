$ErrorActionPreference = 'Continue'
$b = @{ ecr_usuario='izipay'; ecr_password='izipay' } | ConvertTo-Json
$l = Invoke-RestMethod -Uri 'http://localhost:9090/API_PPAD/login' -Method Post -Body $b -ContentType 'application/json'
$t = $l.token
Write-Host "Token OK"
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:9090/API_PPAD/test' -Method Post -Headers @{ Authorization = "Bearer $t" } -ContentType 'application/json' -TimeoutSec 60 -UseBasicParsing
  Write-Host "STATUS: $($r.StatusCode)"
  Write-Host $r.Content
} catch {
  Write-Host "ERROR: $($_.Exception.Message)"
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  if ($_.Exception.Response) {
    $s = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host $s.ReadToEnd()
  }
}
