Get-Service | Where-Object { $_.Name -match 'HGATEWAY|PINPAD|IZIPAY|QR|BILLETERA|WALLET' } | Format-Table Name, Status, DisplayName -AutoSize
Write-Host "---- Listening ports ----"
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 8080, 8090, 8091, 8092, 9090, 9091, 9092, 4137, 4138 } | Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize
