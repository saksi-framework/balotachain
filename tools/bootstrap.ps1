$ErrorActionPreference = "Stop"

$commands = @("git", "gh", "rustc", "cargo", "go", "node", "corepack", "docker", "flutter", "dart")
$missing = @()

foreach ($command in $commands) {
  if (Get-Command $command -ErrorAction SilentlyContinue) {
    Write-Host "ok: $command"
  } else {
    Write-Host "missing: $command"
    $missing += $command
  }
}

if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Install the missing tools, then run this script again."
  Write-Host "See docs/dev-environment.md for platform-specific setup notes."
  exit 1
}

Write-Host ""
Write-Host "All expected tool commands are available."
Write-Host "Next: corepack enable; pnpm install"

