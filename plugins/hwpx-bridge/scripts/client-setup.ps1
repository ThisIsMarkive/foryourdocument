[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('ClaudeDesktop','Codex')][string[]]$Clients,
    [string]$BridgeHome,
    [switch]$RegisterOnly,
    [switch]$Offline
)
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-BridgePlatform
$bridgeBase = Get-BridgeHome $BridgeHome
$runtime = Get-BridgeRuntime $bridgeBase
$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
if ($Offline) {
    if (-not (Test-BridgeReady $bridgeBase)) { throw 'Import a matching offline runtime before registering clients with -Offline.' }
} else {
    & $powershellExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'setup.ps1') -BridgeHome $bridgeBase -PrepareNodeOnly
    if ($LASTEXITCODE -ne 0) { throw 'Portable Node.js preparation failed.' }
}
$nodeExe = Join-Path $runtime 'node\node.exe'
$registrationArgs = @((Join-Path $PSScriptRoot 'register-clients.mjs'), '--home', $bridgeBase, '--clients', ($Clients -join ','))
if ($Clients -contains 'Codex') {
    $codexCommand = Get-Command codex.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($codexCommand) { $registrationArgs += @('--codex', $codexCommand.Source) }
}
$registrationText = & $nodeExe @registrationArgs
$registrationExit = $LASTEXITCODE
Write-Output $registrationText
if ($registrationExit -ne 0) { throw 'One or more clients could not be registered. See the per-client results above; successful registrations were retained.' }
$registration = ($registrationText -join "`n") | ConvertFrom-Json
# Validate against the immutable installed copy, even if a marketplace refresh changes the original cache during setup.
. (Join-Path $registration.pluginRoot 'scripts\common.ps1')
if (-not $RegisterOnly -and -not $Offline) {
    & $powershellExe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $registration.pluginRoot 'scripts\setup.ps1') -BridgeHome $bridgeBase
    if ($LASTEXITCODE -ne 0) { throw 'MCP registration succeeded, but engine setup failed. The registered setup tools can report/retry installation.' }
    if (-not (Test-BridgeReady $bridgeBase)) { throw 'Engine setup has not completed. Check setup-status.json; do not report this as a completed installation.' }
}
Write-Output 'MCP configuration saved. Close and reopen the selected app once to load it.'
Write-Output 'Verify the actual tool list in the app; writing configuration alone does not prove app connectivity.'
if ($RegisterOnly) { Write-Output 'Engine preparation was deferred. Ask the connected hwpx_setup tool to finish setup.' }
