# hwpx-bridge Windows installer
#
#   irm https://raw.githubusercontent.com/ThisIsMarkive/foryourdocument/main/install.ps1 | iex
#
# 1. Uses the installed Node.js if it is version 20 or newer.
# 2. Otherwise installs Node.js LTS: with winget when this PC has it, else (or if winget fails) by downloading
#    the official Node.js LTS zip from nodejs.org, checking it against nodejs.org's SHA-256 list and unpacking it
#    to %LOCALAPPDATA%\Programs\nodejs-portable (no administrator rights, no installer window).
# 3. Runs `npx -y hwpx-bridge@latest setup`, which registers the MCP server in every AI app on this PC.
#
# To register only some apps: $env:HWPX_BRIDGE_CLIENTS = 'claude-desktop,codex'; irm .../install.ps1 | iex
# Values: claude-desktop, claude-code, codex, cursor, gemini, windsurf
#
# Nothing else is changed. Use a normal (non-administrator) PowerShell window.

& {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'   # Windows PowerShell downloads very slowly with the progress bar on
    $minimumMajor = 20
    $portableDir = Join-Path $env:LOCALAPPDATA 'Programs\nodejs-portable'

    function Write-Step([string]$text) { Write-Host "`n== $text" -ForegroundColor Cyan }

    function Get-NodeMajor {
        $node = Get-Command node -ErrorAction SilentlyContinue
        if (-not $node) { return 0 }
        try {
            $version = (& $node.Source --version 2>$null) -replace '^v', ''
            return [int]($version.Split('.')[0])
        } catch { return 0 }
    }

    function Update-SessionPath {
        # Installers update PATH in the registry; this window still has the old copy.
        $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
        $user = [Environment]::GetEnvironmentVariable('Path', 'User')
        $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
        foreach ($dir in @($portableDir, (Join-Path $env:ProgramFiles 'nodejs'))) {
            if ((Test-Path (Join-Path $dir 'node.exe')) -and ($env:Path -notlike "*$dir*")) { $env:Path = "$dir;$env:Path" }
        }
    }

    function Add-UserPath([string]$dir) {
        # Keep the user's PATH type (REG_EXPAND_SZ) and its %VARIABLES% unexpanded.
        $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
        try {
            $current = $key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
            $parts = @($current -split ';' | Where-Object { $_ -and ($_.TrimEnd('\') -ne $dir.TrimEnd('\')) })
            $key.SetValue('Path', ((@($dir) + $parts) -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)
        } finally { $key.Close() }
        # Tell Windows (Explorer and apps started from it, e.g. Claude or ChatGPT after a restart) that PATH changed.
        if (-not ('HwpxBridge.EnvNotify' -as [type])) {
            Add-Type -Namespace HwpxBridge -Name EnvNotify -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("user32.dll", SetLastError = true, CharSet = System.Runtime.InteropServices.CharSet.Auto)]
public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint Msg, System.UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out System.UIntPtr lpdwResult);
'@
        }
        $result = [UIntPtr]::Zero
        [void][HwpxBridge.EnvNotify]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$result)
    }

    function Install-PortableNode {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
        # Assign first: Windows PowerShell 5.1 passes a JSON array down the pipeline as one object.
        $index = Invoke-RestMethod -UseBasicParsing 'https://nodejs.org/dist/index.json'
        $release = $index | Where-Object { $_.lts -and ($_.files -contains "win-$arch-zip") } | Select-Object -First 1
        if (-not $release) { throw "nodejs.org 목록에서 Windows $arch 용 LTS를 찾지 못했습니다." }
        $name = "node-$($release.version)-win-$arch"
        $base = "https://nodejs.org/dist/$($release.version)"
        Write-Host "Node.js $($release.version) LTS ($($release.lts)) 내려받는 중..."

        $work = Join-Path ([IO.Path]::GetTempPath()) ("hwpx-bridge-node-" + [Guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $work | Out-Null
        try {
            $zip = Join-Path $work "$name.zip"
            Invoke-WebRequest -UseBasicParsing "$base/$name.zip" -OutFile $zip
            $sums = (Invoke-WebRequest -UseBasicParsing "$base/SHASUMS256.txt").Content
            $line = ($sums -split "`n") | Where-Object { $_ -match "\s$([regex]::Escape("$name.zip"))\s*$" } | Select-Object -First 1
            if (-not $line) { throw "SHASUMS256.txt에 $name.zip 항목이 없습니다." }
            $expected = ($line -split '\s+')[0].ToLowerInvariant()
            $actual = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLowerInvariant()
            if ($actual -ne $expected) { throw "내려받은 Node.js 파일의 SHA-256이 nodejs.org 값과 다릅니다. 설치하지 않았습니다." }
            Write-Host 'SHA-256 확인 완료'

            Expand-Archive -Path $zip -DestinationPath $work -Force
            if (Test-Path $portableDir) { Remove-Item -Recurse -Force $portableDir }
            New-Item -ItemType Directory -Path (Split-Path $portableDir) -Force | Out-Null
            Move-Item -Path (Join-Path $work $name) -Destination $portableDir
            Set-Content -Path (Join-Path $portableDir 'INSTALLED-BY-HWPX-BRIDGE.txt') -Encoding UTF8 -Value @(
                "Node.js $($release.version) from $base/$name.zip (SHA-256 $expected)",
                'Installed by the hwpx-bridge installer. To remove: delete this folder and remove it from your user PATH.')
        } finally {
            Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
        }
        Add-UserPath $portableDir
        $env:Path = "$portableDir;$env:Path"
        Write-Host "설치 위치: $portableDir (사용자 PATH에 추가함)"

        # A machine-wide old Node.js listed in the system PATH would still win in newly started apps.
        $machineNode = ([Environment]::GetEnvironmentVariable('Path', 'Machine') -split ';') |
            Where-Object { $_ -and (Test-Path (Join-Path $_ 'node.exe')) } | Select-Object -First 1
        if ($machineNode) {
            Write-Host "주의: 시스템 PATH의 기존 Node.js($machineNode)가 먼저 쓰입니다. 오래된 버전이면 '앱 및 기능'에서 Node.js를 제거한 뒤 이 명령을 다시 실행하세요." -ForegroundColor Yellow
        }
    }

    Write-Host 'hwpx-bridge 설치 (kordoc + Filee 문서 변환 MCP)' -ForegroundColor White

    Write-Step 'Node.js 확인'
    $major = Get-NodeMajor
    # HWPX_BRIDGE_NODE_METHOD=portable forces the nodejs.org download (used by CI); users never set it.
    $forcePortable = $env:HWPX_BRIDGE_NODE_METHOD -eq 'portable'
    if ($major -ge $minimumMajor -and -not $forcePortable) {
        Write-Host "Node.js $(node --version) 사용"
    } else {
        if ($forcePortable) { Write-Host 'nodejs.org에서 직접 설치합니다 (HWPX_BRIDGE_NODE_METHOD=portable).' }
        elseif ($major -gt 0) { Write-Host "Node.js $(node --version)는 너무 오래되었습니다 ($minimumMajor 이상 필요)." }
        else { Write-Host 'Node.js가 없습니다.' }

        $winget = if ($forcePortable) { $null } else { Get-Command winget -ErrorAction SilentlyContinue }
        if ($winget) {
            Write-Step 'Node.js LTS 설치 (winget, 설치 확인 창이 뜨면 허용하세요)'
            $wingetArgs = @('install', '--id', 'OpenJS.NodeJS.LTS', '--exact', '--source', 'winget',
                '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
            if ($major -gt 0) { $wingetArgs[0] = 'upgrade' }
            try { & $winget.Source @wingetArgs } catch { Write-Host "winget 오류: $($_.Exception.Message)" -ForegroundColor Yellow }
            Update-SessionPath
            $major = Get-NodeMajor
        }
        if ($major -lt $minimumMajor -or $forcePortable) {
            Write-Step 'Node.js LTS 설치 (nodejs.org 공식 파일, 관리자 권한 불필요)'
            try { Install-PortableNode }
            catch {
                Write-Host "`nNode.js를 설치하지 못했습니다: $($_.Exception.Message)" -ForegroundColor Yellow
                Write-Host 'https://nodejs.org 에서 LTS 버전을 직접 설치한 뒤, 새 PowerShell 창에서 이 명령을 다시 실행하세요.' -ForegroundColor Yellow
                $global:LASTEXITCODE = 1
                return
            }
            $major = Get-NodeMajor
        }
        if ($major -lt $minimumMajor) {
            Write-Host "`nNode.js 설치를 확인하지 못했습니다. 새 PowerShell 창을 열어 이 명령을 다시 실행하거나, https://nodejs.org 에서 직접 설치하세요." -ForegroundColor Yellow
            $global:LASTEXITCODE = 1
            return
        }
        Write-Host "Node.js $(node --version) 설치됨"
    }

    Write-Step 'hwpx-bridge 등록'
    # HWPX_BRIDGE_PACKAGE lets CI test an unpublished package (a .tgz path); users never set it.
    $package = if ($env:HWPX_BRIDGE_PACKAGE) { $env:HWPX_BRIDGE_PACKAGE } else { 'hwpx-bridge@latest' }
    $setupArgs = @('-y', '--package', $package, 'hwpx-bridge', 'setup')
    if ($env:HWPX_BRIDGE_CLIENTS) { $setupArgs += @('--client', $env:HWPX_BRIDGE_CLIENTS) }
    $npx = Join-Path (Split-Path (Get-Command node).Source) 'npx.cmd'
    if (-not (Test-Path $npx)) { $npx = (Get-Command npx.cmd).Source }
    & $npx @setupArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n일부 앱 등록에 실패했습니다. 위 메시지를 확인하세요." -ForegroundColor Yellow
        $global:LASTEXITCODE = $LASTEXITCODE
        return
    }
    Write-Host "`n완료. 등록한 AI 앱을 완전히 종료했다가 다시 여세요." -ForegroundColor Green
}
