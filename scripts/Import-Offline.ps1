[CmdletBinding()]
param([string]$BridgeHome)
$ErrorActionPreference = 'Stop'
$bundle = $PSScriptRoot
$manifestFile = Join-Path $bundle 'offline-manifest.json'
if (-not (Test-Path -LiteralPath $manifestFile)) { throw 'Run this copy from an exported offline bundle, next to offline-manifest.json.' }
$manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.platform -ne 'win32-x64' -or $manifest.runtimeName -notmatch '^\d+\.\d+\.\d+-win-x64$') { throw 'Invalid offline bundle platform or version.' }
$bundleRoot = [IO.Path]::GetFullPath($bundle).TrimEnd('\') + '\'
Write-Output 'Verifying every bundled file before installing...'
$expectedFiles = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
foreach ($record in $manifest.files) {
    if ([IO.Path]::IsPathRooted($record.path) -or $record.path -match '(^|[\\/])\.\.([\\/]|$)') { throw 'Unsafe manifest path.' }
    $file = [IO.Path]::GetFullPath((Join-Path $bundle $record.path))
    if (-not $file.StartsWith($bundleRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Manifest path escapes bundle.' }
    if (-not $expectedFiles.Add($file)) { throw 'Duplicate manifest file.' }
    $stream = [IO.File]::OpenRead($file)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
    if ($hash -ne $record.sha256) { throw ('Corrupt offline bundle: ' + $record.path) }
}
foreach ($entry in (Get-ChildItem -LiteralPath $bundle -Recurse -Force)) {
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw ('Linked entries are not allowed in an offline bundle: ' + $entry.FullName) }
    if (-not $entry.PSIsContainer -and $entry.FullName -ne $manifestFile -and -not $expectedFiles.Contains([IO.Path]::GetFullPath($entry.FullName))) { throw ('Unlisted bundle file: ' + $entry.FullName) }
}
. (Join-Path $bundle 'marketplace\plugins\hwpx-bridge\scripts\common.ps1')
Assert-BridgePlatform
$bridgeBase = Get-BridgeHome $BridgeHome
$runtime = Get-BridgeRuntime $bridgeBase
if (Test-Path -LiteralPath $runtime) { throw 'The destination runtime already exists. Use a fresh -BridgeHome, or keep your existing installation.' }
$marketplace = Join-Path $bridgeBase 'offline-marketplace'
if (Test-Path -LiteralPath $marketplace) { throw 'The destination offline marketplace already exists. Choose a fresh -BridgeHome.' }
New-Item -ItemType Directory -Path (Split-Path -Parent $runtime) -Force | Out-Null
$stage = Join-Path (Split-Path -Parent $runtime) ('import-' + [Guid]::NewGuid().ToString('N'))
Copy-Item -LiteralPath (Join-Path $bundle ('runtime\' + $manifest.runtimeName)) -Destination $stage -Recurse
Move-Item -LiteralPath $stage -Destination $runtime
Copy-Item -LiteralPath (Join-Path $bundle 'marketplace') -Destination $marketplace -Recurse
if (-not (Test-BridgeReady $bridgeBase)) { throw 'Offline runtime validation failed.' }
Set-BridgeStatus $bridgeBase 'ready' 'Offline runtime imported. No network download was performed.'
Write-Output ('Runtime: ' + $bridgeBase)
Write-Output ('Local marketplace: ' + $marketplace)
Write-Output ('codex plugin marketplace add "' + $marketplace + '"')
Write-Output 'codex plugin add hwpx-bridge@hwpx-tools'
Write-Output ('claude plugin marketplace add "' + $marketplace + '"')
Write-Output 'claude plugin install hwpx-bridge@hwpx-tools'
Write-Output 'If you chose -BridgeHome, set HWPX_BRIDGE_HOME to that same path in the client environment.'
Write-Output ('Claude Windows registration: powershell -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $marketplace 'Install-HwpxBridge.ps1') + '" -Clients ClaudeDesktop -Offline -BridgeHome "' + $bridgeBase + '"')
