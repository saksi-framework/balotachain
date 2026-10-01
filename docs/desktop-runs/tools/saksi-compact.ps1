# Thesis study: shrink Docker Desktop's data disk between capstone runs.
# Registered once as an elevated scheduled task ("SaksiCompactDocker") so it runs without a UAC prompt.
# Run it with: schtasks /run /tn SaksiCompactDocker ; it writes its result to C:\Users\User\saksi-compact.log
$ErrorActionPreference = 'Continue'
$log = 'C:\Users\User\saksi-compact.log'
$vhdx = 'Q:\DockerDesktop\DockerDesktopWSL\disk\docker_data.vhdx'
function L($m) { "$(Get-Date -Format s) $m" | Add-Content $log }
L "start; vhdx $([math]::Round((Get-Item $vhdx).Length/1GB,1)) GB; Q free $([math]::Round((Get-PSDrive Q).Free/1GB,1)) GB"
Get-Process | Where-Object { $_.Name -match '^(Docker Desktop|com.docker.backend|com.docker.build|docker-agent|docker)$' } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 5
wsl.exe --shutdown
Start-Sleep 8
$s = "$env:TEMP\saksi-compact-diskpart.txt"
@"
select vdisk file="$vhdx"
attach vdisk readonly
compact vdisk
detach vdisk
"@ | Set-Content -Encoding ascii $s
diskpart /s $s | Out-String | Add-Content $log
L "done; vhdx $([math]::Round((Get-Item $vhdx).Length/1GB,1)) GB; Q free $([math]::Round((Get-PSDrive Q).Free/1GB,1)) GB"
Start-Process "C:\Users\User\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe"
L "docker relaunched"
