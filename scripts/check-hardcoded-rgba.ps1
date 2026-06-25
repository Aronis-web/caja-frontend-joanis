$root = (Get-Location).Path
Get-ChildItem src -Recurse -Include *.tsx, *.ts | ForEach-Object {
    $file = $_.FullName
    $rel = $file.Substring($root.Length)
    if ($rel -match 'design-system') { return }
    $hits = Select-String -Path $file -Pattern "rgba\(" -List
    if ($hits) { Write-Host $rel }
}
