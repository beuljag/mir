param([switch]$NoTunnel)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$python = Join-Path $projectRoot '.venv\Scripts\python.exe'
$pythonWindowless = Join-Path $projectRoot '.venv\Scripts\pythonw.exe'

function Test-CircuitApi {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2
        $schema = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/openapi.json' -TimeoutSec 2
        return ($health.status -eq 'ok' -and $schema.info.title -eq 'Circuit Agent API')
    } catch { return $false }
}

try {
    if (-not (Test-Path -LiteralPath $pythonWindowless)) {
        throw 'Virtual environment is missing. Run start.ps1 once to install dependencies.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'config\local-api-keys.json'))) {
        & $python (Join-Path $PSScriptRoot 'setup_local_key.py')
        if ($LASTEXITCODE -ne 0) { throw 'Persistent key setup failed.' }
    }

    if (Test-CircuitApi) {
        Write-Host '[OK] API server is already running.'
    } else {
        $runFile = Join-Path $projectRoot 'run.py'
        Start-Process -FilePath $pythonWindowless -ArgumentList ('"' + $runFile + '" --background') -WorkingDirectory $projectRoot -WindowStyle Hidden
        $ready = $false
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            if (Test-CircuitApi) { $ready = $true; break }
            Start-Sleep -Seconds 1
        }
        if (-not $ready) { throw 'API did not start. Check logs\startup.log and logs\server.log. Port 8000 may be occupied.' }
        Write-Host '[OK] API server started in the background.'
    }

    if (-not $NoTunnel) {
        $configPath = Join-Path $projectRoot 'config\tunnel.json'
        if (-not (Test-Path -LiteralPath $configPath)) { throw 'config\tunnel.json is missing.' }
        if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'tools\devtunnel.exe'))) { throw 'tools\devtunnel.exe is missing.' }
        $tunnelConfig = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        $tunnelPattern = [regex]::Escape($tunnelConfig.tunnel_id)
        $runningTunnel = Get-CimInstance Win32_Process -Filter "Name = 'devtunnel.exe'" |
            Where-Object { $_.CommandLine -match $tunnelPattern -and $_.CommandLine -match '\bhost\b' }
        if ($runningTunnel) {
            Write-Host '[OK] The saved tunnel process is already running.'
        } else {
            $tunnelScript = Join-Path $PSScriptRoot 'run_tunnel.py'
            # run_tunnel.py also holds a lock so repeated clicks do not create extra supervisors.
            Start-Process -FilePath $pythonWindowless -ArgumentList ('"' + $tunnelScript + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden
            Write-Host '[INFO] Starting the saved tunnel in the background...'
        }

        $publicReady = $false
        for ($attempt = 0; $attempt -lt 5; $attempt++) {
            try {
                $health = Invoke-RestMethod -Uri ($tunnelConfig.public_url.TrimEnd('/') + '/health') -Headers @{Accept='application/json'} -TimeoutSec 5
                if ($health.status -eq 'ok') { $publicReady = $true; break }
            } catch { }
            Start-Sleep -Seconds 1
        }
        if (-not $publicReady) { throw 'Local API is ready, but the public tunnel is not responding. Check logs\tunnel.log. Dev Tunnels may need login again.' }
        Write-Host ('[OK] Public MCP: ' + $tunnelConfig.public_url.TrimEnd('/') + '/mcp')
    }
    Write-Host '[OK] Editor: http://127.0.0.1:8000'
    Write-Host '[OK] API docs: http://127.0.0.1:8000/docs'
    Write-Host 'The fixed API key is unchanged. Closing this window does not stop the services.'
    exit 0
} catch {
    Write-Host ('[ERROR] ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
