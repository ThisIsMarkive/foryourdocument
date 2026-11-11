[CmdletBinding()]
param([string]$OutputDirectory, [string]$BridgeHome)
$repository = Split-Path -Parent $PSScriptRoot
. (Join-Path $repository 'plugins\hwpx-bridge\scripts\common.ps1')
$bridgeBase = Get-BridgeHome $BridgeHome
$runtime = Get-BridgeRuntime $bridgeBase
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $repository 'dist' }
& (Join-Path $runtime 'node\node.exe') (Join-Path $repository 'scripts\build-packages.mjs') --home $bridgeBase --output $OutputDirectory
if ($LASTEXITCODE -ne 0) { throw 'Package build failed.' }
