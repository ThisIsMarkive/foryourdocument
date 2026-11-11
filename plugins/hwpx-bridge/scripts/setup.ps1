[CmdletBinding()]
param([string]$BridgeHome, [switch]$PrepareNodeOnly, [switch]$Repair)
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-BridgePlatform
$bridgeBase = Get-BridgeHome $BridgeHome
$runtime = Get-BridgeRuntime $bridgeBase
$cache = Join-Path $bridgeBase 'downloads'
New-Item -ItemType Directory -Force -Path $runtime, $cache | Out-Null
$lockStream = $null
try {
    try { $lockStream = [IO.File]::Open((Join-Path $bridgeBase 'setup.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { [Console]::Error.WriteLine('Setup is already running for this runtime.'); exit 0 }
    if (-not $Repair -and (Test-BridgeReady $bridgeBase)) {
        Set-BridgeStatus $bridgeBase 'ready' 'Already installed. No network access or download is needed.'
        exit 0
    }
    $nodeDir = Join-Path $runtime 'node'
    $nodeExe = Join-Path $nodeDir 'node.exe'
    if (-not (Test-Path -LiteralPath $nodeExe)) {
        Set-BridgeStatus $bridgeBase 'installing' 'Downloading and verifying portable Node.js.'
        $archive = Join-Path $cache ($script:Assets.node.sha256 + '.zip')
        $valid = (Test-Path -LiteralPath $archive) -and ((Get-BridgeHash $archive) -eq $script:Assets.node.sha256)
        if (-not $valid) {
            $ProgressPreference = 'SilentlyContinue'
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            $downloaded = $false
            for ($attempt = 1; $attempt -le 3; $attempt++) {
                try {
                    Invoke-WebRequest -UseBasicParsing -Uri $script:Assets.node.url -OutFile ($archive + '.part') -TimeoutSec 900
                    if ((Get-BridgeHash ($archive + '.part')) -ne $script:Assets.node.sha256) { throw 'Node.js SHA-256 mismatch.' }
                    Move-Item -LiteralPath ($archive + '.part') -Destination $archive -Force
                    $downloaded = $true
                    break
                } catch { if ($attempt -eq 3) { throw }; Start-Sleep -Seconds 2 }
            }
            if (-not $downloaded) { throw 'Node.js download failed.' }
        }
        # Keep extraction short: the official npm archive has deeply nested paths.
        $stage = Join-Path $bridgeBase ('node-' + [Guid]::NewGuid().ToString('N').Substring(0, 16))
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [IO.Compression.ZipFile]::ExtractToDirectory($archive, $stage)
        $extracted = Join-Path $stage ('node-v' + $script:Assets.node.version + '-win-x64')
        if (-not (Test-Path -LiteralPath (Join-Path $extracted 'node.exe'))) { throw 'Node.js archive layout changed.' }
        $basePrefix = [IO.Path]::GetFullPath($bridgeBase).TrimEnd('\') + '\'
        foreach ($candidate in @($extracted, $nodeDir)) {
            if (-not [IO.Path]::GetFullPath($candidate).StartsWith($basePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Node.js path escapes runtime home.' }
        }
        Move-Item -LiteralPath $extracted -Destination $nodeDir
        # This is the empty extraction directory we just created, never a user directory.
        Remove-Item -LiteralPath $stage
    }
    $nodeVersion = & $nodeExe --version
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -ne ('v' + $script:Assets.node.version)) { throw 'Portable Node.js version check failed.' }
    if ($PrepareNodeOnly) { Set-BridgeStatus $bridgeBase 'prepared' 'Portable Node.js is ready.'; exit 0 }
    $readyPath = Join-Path $runtime 'ready.json'
    if (Test-Path -LiteralPath $readyPath) { Remove-Item -LiteralPath $readyPath }
    $npmDir = Join-Path $runtime 'npm'
    New-Item -ItemType Directory -Force -Path $npmDir | Out-Null
    Copy-Item -LiteralPath (Join-Path $script:PluginRoot 'runtime\package.json') -Destination $npmDir -Force
    Copy-Item -LiteralPath (Join-Path $script:PluginRoot 'runtime\package-lock.json') -Destination $npmDir -Force
    Set-BridgeStatus $bridgeBase 'installing' 'Installing locked libraries and source-build tools (no upstream kordoc package).'
    $env:PATH = $nodeDir + ';' + $env:PATH
    $env:ONNXRUNTIME_NODE_INSTALL = 'skip'
    $npmCli = Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'
    $npmLog = Join-Path $bridgeBase 'npm-install.log'
    & $nodeExe $npmCli ci --prefix $npmDir --omit=dev --ignore-scripts --no-audit --no-fund --cache (Join-Path $bridgeBase 'npm-cache') *> $npmLog
    if ($LASTEXITCODE -ne 0) { throw ('npm ci failed. See ' + $npmLog) }
    & $nodeExe (Join-Path $PSScriptRoot 'install.mjs') --home $bridgeBase --fingerprint (Get-BridgeFingerprint)
    if ($LASTEXITCODE -ne 0) {
        $detail = Get-Content -LiteralPath (Join-Path $bridgeBase 'setup-status.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        throw ('Engine/model installation failed: ' + $detail.message + ' See setup-stderr.log.')
    }
} catch {
    Set-BridgeStatus $bridgeBase 'failed' $_.Exception.Message
    [Console]::Error.WriteLine($_.ScriptStackTrace)
    exit 1
} finally { if ($lockStream) { $lockStream.Dispose() } }
