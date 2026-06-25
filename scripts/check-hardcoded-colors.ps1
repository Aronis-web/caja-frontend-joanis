$root = (Get-Location).Path
Get-ChildItem src -Recurse -Include *.tsx, *.ts | ForEach-Object {
    $file = $_.FullName
    $rel = $file.Substring($root.Length)
    if ($rel -match 'design-system') { return }
    $hits = Select-String -Path $file -Pattern "'#[0-9A-Fa-f]" -List
    if ($hits) { Write-Host $rel }
}
