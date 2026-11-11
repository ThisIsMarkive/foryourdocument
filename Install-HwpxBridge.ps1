[CmdletBinding()]
param(
    [ValidateSet('ClaudeDesktop','Codex')][string[]]$Clients,
    [string]$BridgeHome,
    [switch]$RegisterOnly,
    [switch]$Offline
)
$ErrorActionPreference = 'Stop'
$version = '0.2.2'
if (-not $Clients) {
    Write-Host 'HWPX Bridge: choose where to register the local MCP.'
    Write-Host '1. Claude Windows app'
    Write-Host '2. Codex (standalone MCP; unnecessary if its marketplace MCP already works)'
    Write-Host '3. Both'
    switch (Read-Host 'Select 1, 2 or 3') {
        '1' { $Clients = @('ClaudeDesktop') }
        '2' { $Clients = @('Codex') }
        '3' { $Clients = @('ClaudeDesktop','Codex') }
        default { throw 'No installation performed: choose 1, 2 or 3.' }
    }
}
$sourceRoot = $PSScriptRoot
$entry = Join-Path $sourceRoot 'plugins\hwpx-bridge\scripts\client-setup.ps1'
if (-not (Test-Path -LiteralPath $entry)) {
    if ($Offline) { throw 'Offline registration must run from the exported marketplace folder.' }
    $stage = Join-Path ([IO.Path]::GetTempPath()) ('hwpx-bridge-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    $sourceRoot = Join-Path $stage 'source'
    $archive = Join-Path $stage 'source.zip'
    $baseUrl = 'https://github.com/ThisIsMarkive/foryourdocument/releases/download/v' + $version
    $assetName = 'hwpx-bridge-' + $version + '-github.zip'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'
    Write-Output ('Downloading HWPX Bridge ' + $version + ' source...')
    Invoke-WebRequest -UseBasicParsing -Uri ($baseUrl + '/' + $assetName) -OutFile $archive
    $sums = (Invoke-WebRequest -UseBasicParsing -Uri ($baseUrl + '/SHA256SUMS.txt')).Content
    $match = [regex]::Match($sums, '(?m)^([a-fA-F0-9]{64})\s+' + [regex]::Escape($assetName) + '\s*$')
    if (-not $match.Success -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $match.Groups[1].Value) { throw 'Source archive checksum mismatch.' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $prefix = [IO.Path]::GetFullPath($sourceRoot).TrimEnd('\') + '\'
        foreach ($item in $zip.Entries) {
            $candidate = [IO.Path]::GetFullPath((Join-Path $sourceRoot $item.FullName))
            if (-not $candidate.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe archive entry.' }
        }
    } finally { $zip.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($archive, $sourceRoot)
    $entry = Join-Path $sourceRoot 'plugins\hwpx-bridge\scripts\client-setup.ps1'
}
& $entry -Clients $Clients -BridgeHome $BridgeHome -RegisterOnly:$RegisterOnly -Offline:$Offline
