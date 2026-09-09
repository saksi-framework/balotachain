#Requires -Version 5.1
<#
.SYNOPSIS
Build the two browser apps the saksi-campaign console serves.

.DESCRIPTION
Assembles them into the layout the console's --web-dir expects:

  dist-web\board\     <- apps\auditor  (public bulletin board, base /board/)
  dist-web\trustee\   <- apps\trustee  (trustee console,       base /trustee/)

Then run the console pointed at it:

  saksi-campaign serve --demo <saksi-demo> --web-dir "<repo>\dist-web"

Serving them from the console keeps them same-origin with the API, which is
what keeps its cross-origin POST guard protecting the ceremony endpoints.
#>
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# The apps import @balotachain/ui through its package `exports`, which point at
# dist — so the shared package has to be built first.
pnpm --filter "@balotachain/ui" build
if ($LASTEXITCODE -ne 0) { throw "ui build failed" }
pnpm --filter auditor build
if ($LASTEXITCODE -ne 0) { throw "auditor build failed" }
pnpm --filter trustee build
if ($LASTEXITCODE -ne 0) { throw "trustee build failed" }

$web = Join-Path $root "dist-web"
if (Test-Path $web) { Remove-Item -Recurse -Force $web }
New-Item -ItemType Directory -Force (Join-Path $web "board") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $web "trustee") | Out-Null
Copy-Item -Recurse -Force (Join-Path $root "apps\auditor\dist\*") (Join-Path $web "board")
Copy-Item -Recurse -Force (Join-Path $root "apps\trustee\dist\*") (Join-Path $web "trustee")

Write-Output ""
Write-Output "built: $web"
Write-Output "serve: saksi-campaign serve --demo <saksi-demo> --web-dir `"$web`""
