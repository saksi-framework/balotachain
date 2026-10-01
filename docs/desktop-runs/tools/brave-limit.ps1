# Keeps Brave on 2 of the 16 logical CPUs, at below-normal priority, so it can never push
# host CPU past ~12.5 % and trip the study's 25 % contention rule. Re-applies every 10 s
# because Brave starts new processes for tabs. Stop it with: Stop-Process -Id (Get-Content $env:TEMP\brave-limit.pid)
$PID | Set-Content "$env:TEMP\brave-limit.pid"
$mask = [IntPtr]0xC000   # logical CPUs 14 and 15
while ($true) {
    Get-Process brave -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            if ($_.ProcessorAffinity -ne $mask) { $_.ProcessorAffinity = $mask }
            if ($_.PriorityClass -ne 'BelowNormal') { $_.PriorityClass = 'BelowNormal' }
        } catch {}
    }
    Start-Sleep -Seconds 10
}
