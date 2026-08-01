Start-Sleep -Seconds 45
Write-Host ("Hora ahora: " + (Get-Date -Format 'HH:mm:ss'))
$dir = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'
Get-ChildItem $dir -File | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | Format-Table LastWriteTime, Length, Name -AutoSize
$latest = Get-ChildItem "$dir\resp-02-1099-*.json" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latest) {
  Write-Host ""
  Write-Host "===== LATEST RESPONSE ($($latest.Name)) ====="
  Get-Content $latest.FullName -Raw
} else {
  Write-Host "Sin respuesta aun."
}
