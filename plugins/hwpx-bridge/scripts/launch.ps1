[CmdletBinding()]
param([string]$BridgeHome)
. (Join-Path $PSScriptRoot 'common.ps1')
Assert-BridgePlatform
$bridgeBase = Get-BridgeHome $BridgeHome
if (Test-BridgeReady $bridgeBase) {
    # Pump raw streams rather than PowerShell's text pipeline: preserve UTF-8 MCP JSON.
    Add-Type -TypeDefinition @'
using System.IO;
using System.Threading.Tasks;
public static class HwpxBridgeStreams {
    public static async Task Pump(Stream source, Stream destination) {
        var buffer = new byte[8192];
        int length;
        while ((length = await source.ReadAsync(buffer, 0, buffer.Length)) > 0) {
            await destination.WriteAsync(buffer, 0, length);
            await destination.FlushAsync();
        }
    }
}
'@
    $runtime = Get-BridgeRuntime $bridgeBase
    $process = New-Object Diagnostics.Process
    $process.StartInfo.FileName = Join-Path $runtime 'node\node.exe'
    $server = Join-Path $script:PluginRoot 'server\index.mjs'
    $process.StartInfo.Arguments = '"' + $server + '" --home "' + $bridgeBase + '"'
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardInput = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    [void]$process.Start()
    $inputTask = [HwpxBridgeStreams]::Pump([Console]::OpenStandardInput(), $process.StandardInput.BaseStream)
    $outputTask = [HwpxBridgeStreams]::Pump($process.StandardOutput.BaseStream, [Console]::OpenStandardOutput())
    $errorTask = [HwpxBridgeStreams]::Pump($process.StandardError.BaseStream, [Console]::OpenStandardError())
    $inputClosed = $false
    while (-not $process.WaitForExit(100)) {
        if ($inputTask.IsCompleted -and -not $inputClosed) { $process.StandardInput.Close(); $inputClosed = $true }
    }
    [void]$outputTask.GetAwaiter().GetResult()
    [void]$errorTask.GetAwaiter().GetResult()
    exit $process.ExitCode
}

# A tiny setup-only MCP requires no Node.js. Lengthy downloads never block initialize.
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
function Read-SetupStatus {
    $statusFile = Join-Path $bridgeBase 'setup-status.json'
    $state = @{ state = 'not_installed'; message = 'Call hwpx_setup once to install all dependencies.' }
    if (Test-Path -LiteralPath $statusFile) {
        try { $state = Get-Content -LiteralPath $statusFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
    }
    return @{ home = $bridgeBase; status = $state; ready = (Test-BridgeReady $bridgeBase); next_step = 'When ready, reload the plugin/MCP connection or restart the desktop app. Do not reinstall Node.js manually.' }
}
function Start-BridgeSetup {
    New-Item -ItemType Directory -Path $bridgeBase -Force | Out-Null
    $lockPath = Join-Path $bridgeBase 'setup.lock'
    try { $probe = [IO.File]::Open($lockPath, 'OpenOrCreate', 'ReadWrite', 'None'); $probe.Dispose() }
    catch { return (Read-SetupStatus) }
    Set-BridgeStatus $bridgeBase 'starting' 'Starting automatic setup. Preparing build tools, compiling included sources and installing OCR models may take several minutes.'
    $installer = Join-Path $PSScriptRoot 'setup.ps1'
    $powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $setupArguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $installer + '" -BridgeHome "' + $bridgeBase + '"'
    Start-Process -FilePath $powerShell -ArgumentList $setupArguments -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $bridgeBase 'setup-stdout.log') `
        -RedirectStandardError (Join-Path $bridgeBase 'setup-stderr.log') | Out-Null
    return (Read-SetupStatus)
}
$setupTools = @(
    @{ name = 'hwpx_setup'; description = 'Prepare private Node.js and .NET build tools, compile included Filee and kordoc source into one HWPX plugin, and install Tesseract, Korean/English/Hanja OCR data and all pinned OCR/formula models. Windows x64 only. Runs in the background; internet is needed for initial dependencies. Poll hwpx_setup_status and reload when ready.'; inputSchema = @{ type = 'object'; properties = @{}; additionalProperties = $false }; annotations = @{ destructiveHint = $false; openWorldHint = $true } },
    @{ name = 'hwpx_setup_status'; description = 'Read automatic setup progress. After ready, reload the MCP/plugin connection to expose document tools.'; inputSchema = @{ type = 'object'; properties = @{}; additionalProperties = $false }; annotations = @{ readOnlyHint = $true; openWorldHint = $false } }
)
while ($null -ne ($line = [Console]::ReadLine())) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $request = $null
    try {
        $request = $line | ConvertFrom-Json
        if (-not $request.PSObject.Properties['id']) { continue }
        $result = $null
        switch ($request.method) {
            'initialize' {
                $version = $request.params.protocolVersion
                if ($version -notin @('2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25')) { $version = '2025-03-26' }
                $result = @{ protocolVersion = $version; capabilities = @{ tools = @{} }; serverInfo = @{ name = 'hwpx-bridge-setup'; version = $script:Assets.bundleVersion }; instructions = 'First run hwpx_setup, poll hwpx_setup_status, then reload this connection. Node.js does not need to be installed separately.' }
            }
            'ping' { $result = @{} }
            'tools/list' { $result = @{ tools = $setupTools } }
            'tools/call' {
                switch ($request.params.name) {
                    'hwpx_setup' { $data = Start-BridgeSetup }
                    'hwpx_setup_status' { $data = Read-SetupStatus }
                    default { throw 'Unknown setup tool.' }
                }
                $result = @{ content = @(@{ type = 'text'; text = ($data | ConvertTo-Json -Depth 20 -Compress) }) }
            }
            default { throw ('Unsupported method: ' + $request.method) }
        }
        $reply = @{ jsonrpc = '2.0'; id = $request.id; result = $result }
    } catch {
        $requestId = if ($request -and $request.PSObject.Properties['id']) { $request.id } else { $null }
        $reply = @{ jsonrpc = '2.0'; id = $requestId; error = @{ code = -32603; message = $_.Exception.Message } }
    }
    [Console]::WriteLine(($reply | ConvertTo-Json -Depth 40 -Compress))
}
