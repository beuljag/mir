$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonWindowless = Join-Path $projectRoot '.venv\Scripts\pythonw.exe'
$tunnelExecutable = Join-Path $projectRoot 'tools\devtunnel.exe'
if (-not (Test-Path -LiteralPath $pythonWindowless)) { throw 'Virtual environment not found' }
if (-not (Test-Path -LiteralPath $tunnelExecutable)) { throw 'Dev Tunnels CLI not found' }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'config\tunnel.json'))) { throw 'Tunnel configuration not found' }
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'CircuitAgentTunnel.lnk'
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $pythonWindowless
$shortcut.Arguments = '"' + (Join-Path $projectRoot 'scripts\run_tunnel.py') + '"'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Start persistent Circuit Agent Dev Tunnel at Windows sign-in'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Host 'Installed Startup shortcut:' $shortcutPath
