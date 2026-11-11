[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Destination, [string]$BridgeHome)
$repository = Split-Path -Parent $PSScriptRoot
. (Join-Path $repository 'plugins\hwpx-bridge\scripts\common.ps1')
$bridgeBase = Get-BridgeHome $BridgeHome
if (-not (Test-BridgeReady $bridgeBase)) { throw 'Complete setup before exporting an offline bundle.' }
$runtime = Get-BridgeRuntime $bridgeBase
& (Join-Path $runtime 'node\node.exe') (Join-Path $repository 'scripts\export-offline.mjs') --home $bridgeBase --destination $Destination
if ($LASTEXITCODE -ne 0) { throw 'Offline export failed.' }
