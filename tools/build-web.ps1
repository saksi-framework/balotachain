#Requires -Version 5.1
<#
.SYNOPSIS
Build the four browser apps the saksi-campaign console serves.

.DESCRIPTION
Assembles them into the layout the console's --web-dir expects:

  dist-web\board\     <- apps\auditor  (public bulletin board, base /board/)
  dist-web\trustee\   <- apps\trustee  (trustee console,       base /trustee/)
  dist-web\admin\     <- apps\admin    (admin console,         base /admin/)
  dist-web\vote\      <- apps\vote     (phone voter app,       base /vote/)

Then run the console pointed at it:

  saksi-campaign serve --demo <saksi-demo> --web-dir "<repo>\dist-web"

Serving them from the console keeps them same-origin with the API, which is
what keeps its cross-origin POST guard protecting the write endpoints and
lets the session cookie reach the API.
#>
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# dist-web is what the console serves on demo day. The vote app must never
# carry the local test election (VITE_LIVE_LOCAL, with its throwaway
# credential), make the mock its default client (VITE_LIVE_MOCK), or let
# `?mock=1` open the mock's practice election (VITE_LIVE_MOCK_SWITCH). Refuse
# any of them from the environment or from an (untracked, gitignored) .env
# file, then pin all three off for the build: Vite never lets a .env file
# override a variable already in the environment.
foreach ($var in @("VITE_LIVE_LOCAL", "VITE_LIVE_MOCK", "VITE_LIVE_MOCK_SWITCH")) {
  $val = [Environment]::GetEnvironmentVariable($var)
  if ($val -and $val -ne "0") {
    throw "$var=$val is set; dist-web must not carry the local test election or the mock. Unset it (build those with vite build --outDir elsewhere)."
  }
}
Get-ChildItem -Force -Path (Join-Path $root "apps\vote") -Filter ".env*" -File -ErrorAction SilentlyContinue | ForEach-Object {
  if (Select-String -Quiet -Path $_.FullName -Pattern '^\s*(export\s+)?VITE_LIVE_(LOCAL|MOCK|MOCK_SWITCH)\s*=') {
    throw "$($_.FullName) sets VITE_LIVE_LOCAL, VITE_LIVE_MOCK or VITE_LIVE_MOCK_SWITCH; remove that line before building dist-web."
  }
}

# The apps import @balotachain/ui through its package `exports`, which point at
# dist — so the shared package has to be built first.
pnpm --filter "@balotachain/ui" build
if ($LASTEXITCODE -ne 0) { throw "ui build failed" }
pnpm --filter auditor build
if ($LASTEXITCODE -ne 0) { throw "auditor build failed" }
pnpm --filter trustee build
if ($LASTEXITCODE -ne 0) { throw "trustee build failed" }
pnpm --filter admin build
if ($LASTEXITCODE -ne 0) { throw "admin build failed" }
$env:VITE_LIVE_LOCAL = "0"
$env:VITE_LIVE_MOCK = "0"
$env:VITE_LIVE_MOCK_SWITCH = "0"
try {
  pnpm --filter vote build
  if ($LASTEXITCODE -ne 0) { throw "vote build failed" }
} finally {
  Remove-Item Env:VITE_LIVE_LOCAL, Env:VITE_LIVE_MOCK, Env:VITE_LIVE_MOCK_SWITCH -ErrorAction SilentlyContinue
}

$web = Join-Path $root "dist-web"
if (Test-Path $web) { Remove-Item -Recurse -Force $web }
New-Item -ItemType Directory -Force (Join-Path $web "board") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $web "trustee") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $web "admin") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $web "vote") | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\auditor\dist\*") (Join-Path $web "board")
Copy-Item -Recurse -Force (Join-Path $root "apps\trustee\dist\*") (Join-Path $web "trustee")
Copy-Item -Recurse -Force (Join-Path $root "apps\admin\dist\*") (Join-Path $web "admin")
Copy-Item -Recurse -Force (Join-Path $root "apps\vote\dist\*") (Join-Path $web "vote")

# Belt and braces: fail if any trace of the test election reached the bundle.
$fixture = Get-Content -Raw (Join-Path $root "apps\vote\src\test\fixture\live-election.json") | ConvertFrom-Json
$markers = @("vote-fixture", $fixture.credential.s_cred)
$hit = Get-ChildItem -Recurse -File (Join-Path $web "vote") | Select-String -SimpleMatch -Quiet -Pattern $markers
if ($hit) {
  Remove-Item -Recurse -Force (Join-Path $web "vote")
  throw "dist-web\vote contains the local test election; removed it. Check VITE_LIVE_LOCAL and apps\vote\.env*."
}
# ...or the mock: its election id and its IndexedDB name are in any bundle
# that can run it, and in no other.
$mockHit = Get-ChildItem -Recurse -File (Join-Path $web "vote") | Select-String -SimpleMatch -Quiet -Pattern @("live-mock", "balotachain-vote-mock")
if ($mockHit) {
  Remove-Item -Recurse -Force (Join-Path $web "vote")
  throw "dist-web\vote contains the mock (practice election); removed it. Check VITE_LIVE_MOCK, VITE_LIVE_MOCK_SWITCH and apps\vote\.env*."
}

Write-Output ""
Write-Output "built: $web"
Write-Output "serve: saksi-campaign serve --demo <saksi-demo> --web-dir `"$web`""
