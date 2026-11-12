# hwpx-bridge Windows installer
#
#   irm https://raw.githubusercontent.com/ThisIsMarkive/foryourdocument/main/install.ps1 | iex
#
# 1. Uses the installed Node.js if it is version 20 or newer.
# 2. Otherwise installs Node.js LTS with winget (Windows' own package manager).
# 3. Runs `npx -y hwpx-bridge@latest setup`, which registers the MCP server in every AI app on this PC.
#
# To register only some apps: $env:HWPX_BRIDGE_CLIENTS = 'claude-desktop,codex'; irm .../install.ps1 | iex
# Values: claude-desktop, claude-code, codex, cursor, gemini, windsurf
#
# Nothing else is changed. Use a normal (non-administrator) PowerShell window.

& {
    $ErrorActionPreference = 'Stop'
    $minimumMajor = 20

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
        # winget updates PATH in the registry; this window still has the old copy.
        $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
        $user = [Environment]::GetEnvironmentVariable('Path', 'User')
        $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
        $default = Join-Path $env:ProgramFiles 'nodejs'
        if ((Test-Path (Join-Path $default 'node.exe')) -and ($env:Path -notlike "*$default*")) { $env:Path = "$default;$env:Path" }
    }

    Write-Host 'hwpx-bridge 설치 (kordoc + Filee 문서 변환 MCP)' -ForegroundColor White

    Write-Step 'Node.js 확인'
    $major = Get-NodeMajor
    if ($major -ge $minimumMajor) {
        Write-Host "Node.js $(node --version) 사용"
    } else {
        if ($major -gt 0) { Write-Host "Node.js $(node --version)는 너무 오래되었습니다 ($minimumMajor 이상 필요)." }
        else { Write-Host 'Node.js가 없습니다.' }
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if (-not $winget) {
            Write-Host "`nwinget을 쓸 수 없는 PC입니다. https://nodejs.org 에서 LTS 버전을 설치한 뒤 이 명령을 다시 실행하세요." -ForegroundColor Yellow
            return
        }
        Write-Step 'Node.js LTS 설치 (winget, 설치 확인 창이 뜨면 허용하세요)'
        $wingetArgs = @('install', '--id', 'OpenJS.NodeJS.LTS', '--exact', '--source', 'winget',
            '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
        if ($major -gt 0) { $wingetArgs[0] = 'upgrade' }
        & $winget.Source @wingetArgs
        Update-SessionPath
        $major = Get-NodeMajor
        if ($major -lt $minimumMajor) {
            Write-Host "`nNode.js 설치를 확인하지 못했습니다. 새 PowerShell 창을 열어 이 명령을 다시 실행하거나, https://nodejs.org 에서 직접 설치하세요." -ForegroundColor Yellow
            return
        }
        Write-Host "Node.js $(node --version) 설치됨"
    }

    Write-Step 'hwpx-bridge 등록'
    # HWPX_BRIDGE_PACKAGE lets CI test an unpublished package (a .tgz path); users never set it.
    $package = if ($env:HWPX_BRIDGE_PACKAGE) { $env:HWPX_BRIDGE_PACKAGE } else { 'hwpx-bridge@latest' }
    $setupArgs = @('-y', '--package', $package, 'hwpx-bridge', 'setup')
    if ($env:HWPX_BRIDGE_CLIENTS) { $setupArgs += @('--client', $env:HWPX_BRIDGE_CLIENTS) }
    $npx = (Get-Command npx.cmd -ErrorAction SilentlyContinue).Source
    if (-not $npx) { $npx = Join-Path (Split-Path (Get-Command node).Source) 'npx.cmd' }
    & $npx @setupArgs
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n일부 앱 등록에 실패했습니다. 위 메시지를 확인하세요." -ForegroundColor Yellow
        $global:LASTEXITCODE = $LASTEXITCODE
        return
    }
    Write-Host "`n완료. 등록한 AI 앱을 완전히 종료했다가 다시 여세요." -ForegroundColor Green
}
