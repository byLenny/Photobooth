<#
.SYNOPSIS
  Start, stop, restart, or check the local backend/frontend dev servers.

.USAGE
  powershell -File scripts/dev.ps1 start
  powershell -File scripts/dev.ps1 stop
  powershell -File scripts/dev.ps1 restart
  powershell -File scripts/dev.ps1 status

  Logs are written to logs/backend.log and logs/frontend.log (combined
  stdout+stderr, matching `npm run dev:backend > log 2>&1`).
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "restart", "status")]
    [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$LogsDir = Join-Path $RepoRoot "logs"

# Matches how npm actually runs each script on Windows (via a cmd.exe
# wrapper spawning a further node/tsx or node/vite child) — searching by
# command-line substring finds every process in that chain regardless of
# depth, which a saved top-level PID would miss after a tsx watch restart.
# Matched against the full command line, so these need to work for every
# process in the chain: npm's own invocation, its workspace-scoped re-exec,
# and the actual tsx/vite child (whose args don't put "tsx" and "watch"
# adjacent to each other — it's `cli.mjs" watch src/index.ts`).
$Patterns = @{
    backend  = "dev:backend|workspace backend|src/index\.ts"
    frontend = "dev:frontend|workspace frontend|vite\.js"
}

function Get-DevProcesses {
    param([string]$Role)
    $pattern = $Patterns[$Role]
    Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'" |
        Where-Object { $_.CommandLine -match $pattern }
}

function Stop-Dev {
    param([string]$Role = "both")
    $roles = if ($Role -eq "both") { @("backend", "frontend") } else { @($Role) }
    $stoppedAny = $false
    foreach ($r in $roles) {
        $procs = Get-DevProcesses -Role $r
        if ($procs) {
            Write-Host "Stopping $r ($($procs.Count) process(es))..."
            $procs | ForEach-Object {
                Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            }
            $stoppedAny = $true
        }
    }
    if (-not $stoppedAny) {
        Write-Host "Nothing running."
    }
}

function Start-Dev {
    param([string]$Role = "both")
    $roles = if ($Role -eq "both") { @("backend", "frontend") } else { @($Role) }

    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir | Out-Null
    }

    foreach ($r in $roles) {
        if (Get-DevProcesses -Role $r) {
            Write-Host "$r already running, skipping (use 'restart' to relaunch)."
            continue
        }
        $log = Join-Path $LogsDir "$r.log"
        Start-Process -FilePath "cmd.exe" `
            -ArgumentList "/c", "npm run dev:$r > `"$log`" 2>&1" `
            -WorkingDirectory $RepoRoot `
            -WindowStyle Hidden
        Write-Host "Started $r (log: $log)"
    }
}

function Show-Status {
    foreach ($r in @("backend", "frontend")) {
        $procs = Get-DevProcesses -Role $r
        if ($procs) {
            Write-Host "$r`: running ($($procs.Count) process(es): $($procs.ProcessId -join ', '))"
        } else {
            Write-Host "$r`: not running"
        }
    }
    $backendUrl = "https://localhost:8080/api/settings"
    $frontendUrl = "https://localhost:5173/"
    foreach ($pair in @(@("backend", $backendUrl), @("frontend", $frontendUrl))) {
        $name, $url = $pair
        try {
            $code = & curl.exe -sk -o NUL -w "%{http_code}" --max-time 3 $url
            Write-Host "$name HTTP check ($url): $code"
        } catch {
            Write-Host "$name HTTP check ($url): unreachable"
        }
    }
}

switch ($Action) {
    "start" { Start-Dev }
    "stop" { Stop-Dev }
    "restart" { Stop-Dev; Start-Sleep -Milliseconds 800; Start-Dev }
    "status" { Show-Status }
}
