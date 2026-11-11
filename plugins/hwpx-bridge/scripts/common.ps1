Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$script:PluginRoot = Split-Path -Parent $PSScriptRoot
$script:Assets = Get-Content -LiteralPath (Join-Path $script:PluginRoot 'runtime\assets.json') -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-BridgeHome([string]$Value) {
    if (-not $Value) { $Value = $env:HWPX_BRIDGE_HOME }
    if (-not $Value) { $Value = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'HwpxBridge' }
    if (-not [IO.Path]::IsPathRooted($Value)) { throw 'HWPX_BRIDGE_HOME must be an absolute path.' }
    return [IO.Path]::GetFullPath($Value).TrimEnd('\')
}
function Get-BridgeRuntime([string]$Base) {
    return Join-Path $Base ('versions\' + $script:Assets.bundleVersion + '-win-x64')
}
function Get-BridgeFingerprint {
    $paths = New-Object 'System.Collections.Generic.List[string]'
    foreach ($folder in @('runtime', 'scripts', 'server')) {
        foreach ($file in (Get-ChildItem -LiteralPath (Join-Path $script:PluginRoot $folder) -Recurse -File -Force)) {
            $paths.Add($file.FullName.Substring($script:PluginRoot.Length + 1).Replace('\', '/'))
        }
    }
    $paths.Sort([StringComparer]::Ordinal)
    $lines = foreach ($relative in $paths) { $relative + ':' + (Get-BridgeHash (Join-Path $script:PluginRoot $relative)) }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($lines -join "`n")))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function Get-BridgeHash([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
}
function Test-BridgeReady([string]$Base) {
    $runtime = Get-BridgeRuntime $Base
    $marker = Join-Path $runtime 'ready.json'
    if (-not (Test-Path -LiteralPath $marker)) { return $false }
    try {
        $ready = Get-Content -LiteralPath $marker -Raw -Encoding UTF8 | ConvertFrom-Json
        return ($ready.fingerprint -eq (Get-BridgeFingerprint)) -and
            (Test-Path -LiteralPath (Join-Path $runtime 'node\node.exe')) -and
            ($ready.architecture -eq 'source-integrated') -and
            (Test-Path -LiteralPath (Join-Path $runtime $script:Assets.kordocSource.module)) -and
            (Test-Path -LiteralPath (Join-Path $runtime $script:Assets.filee.executable)) -and
            (Test-Path -LiteralPath (Join-Path $runtime 'build-receipt.json'))
    } catch { [Console]::Error.WriteLine('Runtime check: ' + $_.Exception.Message); return $false }
}
function Write-BridgeJson([string]$Path, $Value) {
    $temporary = $Path + '.' + $PID + '.tmp'
    [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temporary -Destination $Path -Force
}
function Set-BridgeStatus([string]$Base, [string]$State, [string]$Message) {
    Write-BridgeJson (Join-Path $Base 'setup-status.json') @{
        state = $State; message = $Message; pid = $PID; updatedAt = [DateTime]::UtcNow.ToString('o')
        version = $script:Assets.bundleVersion
    }
    [Console]::Error.WriteLine($Message)
}
function Assert-BridgePlatform {
    if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitOperatingSystem -or
        $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
        throw 'HWPX Bridge supports native Windows x64 only. Linux/Cowork VM, macOS and ARM64 are not supported.'
    }
}
