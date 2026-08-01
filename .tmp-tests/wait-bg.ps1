param([int]$MaxSeconds = 300)
$dir = 'C:\Users\aaron\IdeaProjects\caja-frontend-joanis\.tmp-tests'
$pidFile = Join-Path $dir 'bg-pid.txt'
if (-not (Test-Path $pidFile)) { Write-Host 'No hay PID'; exit 1 }
$workerPid = [int]((Get-Content $pidFile -Raw).Trim())
Write-Host ("Esperando worker PID {0} (max {1}s)..." -f $workerPid, $MaxSeconds)

$start = Get-Date
while ($true) {
  $running = Get-Process -Id $workerPid -ErrorAction SilentlyContinue
  if (-not $running) { break }
  if (((Get-Date) - $start).TotalSeconds -gt $MaxSeconds) {
    Write-Host "Timeout, matando PID"
    Stop-Process -Id $workerPid -Force -ErrorAction SilentlyContinue
    break
  }
  Start-Sleep -Seconds 2
}
$elapsed = ((Get-Date) - $start).TotalSeconds
Write-Host ("Worker termino tras {0:N1}s" -f $elapsed)

Write-Host ""
Write-Host "===== RESPUESTA (JSON PARA COPIAR) ====="
$rf = Join-Path $dir 'bg-resp.json'
if (-not (Test-Path $rf)) { Write-Host "(sin archivo de respuesta)"; exit 0 }

$raw = Get-Content $rf -Raw
Write-Host $raw

try {
  $w = $raw | ConvertFrom-Json
  Write-Host ""
  Write-Host ("Tiempo total worker: {0:N2} s   curl_exit={1}" -f $w.elapsed_s, $w.curl_exit_code)
  if ($w.ok) {
    $r = $w.response
    Write-Host ""
    Write-Host "===== FECHA / HORA DE LA TRANSACCION ====="
    $dt = $r.date_time
    if ($dt -and $dt.Length -ge 14) {
      $anio = $dt.Substring(0,4); $mes = $dt.Substring(4,2); $dia = $dt.Substring(6,2)
      $hora = $dt.Substring(8,2); $min = $dt.Substring(10,2); $seg = $dt.Substring(12,2)
      Write-Host ("date_time (raw):  {0}" -f $dt)
      Write-Host ("Fecha:            {0}/{1}/{2}" -f $dia,$mes,$anio)
      Write-Host ("Hora:             {0}:{1}:{2}" -f $hora,$min,$seg)
      Write-Host ("ISO 8601:         {0}-{1}-{2}T{3}:{4}:{5}" -f $anio,$mes,$dia,$hora,$min,$seg)
    } else { Write-Host "date_time no presente." }
    Write-Host ""
    Write-Host "===== RESUMEN ====="
    Write-Host ("response_code : {0}" -f $r.response_code)
    Write-Host ("message       : {0}" -f $r.message)
    Write-Host ("resp_host     : {0}" -f $r.resp_host)
    Write-Host ("card          : {0}" -f $r.card)
    Write-Host ("read_type     : {0}" -f $r.read_type)
    Write-Host ("approval_code : {0}" -f $r.approval_code)
  } else {
    Write-Host "===== ERROR EN LA LLAMADA (la app termino, no quedo colgada) ====="
    if ($w.error) { Write-Host ("Error: " + $w.error) }
    if ($w.http_headers) { Write-Host ("Headers:`n" + $w.http_headers) }
    if ($w.raw_body) { Write-Host ("Body: " + $w.raw_body) }
  }
} catch { Write-Host "No parseable: $($_.Exception.Message)" }
