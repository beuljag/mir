$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonWindowless = Join-Path $projectRoot '.venv\Scripts\pythonw.exe'
if (-not (Test-Path -LiteralPath $pythonWindowless)) { throw 'Python virtual environment is missing.' }
$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'CircuitAgentAPI.lnk'
$shellObject = New-Object -ComObject WScript.Shell
$shortcut = $shellObject.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $pythonWindowless
$shortcut.Arguments = '"' + (Join-Path $projectRoot 'run.py') + '" --background'
$shortcut.WorkingDirectory = $projectRoot
$shortcut.Description = 'Start local Circuit Agent API at Windows sign-in'
$shortcut.WindowStyle = 7
$shortcut.Save()
Write-Host 'Installed Startup shortcut:' $shortcutPath
