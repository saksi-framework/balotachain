# Install docs/context/memory into this device's Claude Code memory for this checkout.
# Claude Code keys a project's memory by the checkout's absolute path with every
# character that is not a letter or digit replaced by "-". A file already there is
# kept when it is newer than the repository copy.
$ErrorActionPreference = "Stop"

$repo = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$key = $repo -replace '[^A-Za-z0-9]', '-'
$dest = Join-Path $HOME ".claude\projects\$key\memory"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Get-ChildItem (Join-Path $PSScriptRoot "memory") -Filter *.md | ForEach-Object {
    $target = Join-Path $dest $_.Name
    if ((Test-Path $target) -and ((Get-Item $target).LastWriteTime -gt $_.LastWriteTime)) {
        Write-Output "kept (newer on this device): $($_.Name)"
    } else {
        Copy-Item $_.FullName $target -Force
        Write-Output "restored: $($_.Name)"
    }
}
Write-Output "memory: $dest"
