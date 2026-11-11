---
name: setup
description: HWPX Bridge 최초 설정, 설치 상태 확인, 엔진 준비. Node.js를 따로 설치하지 않고 Filee·kordoc·OCR을 자동으로 준비할 때 사용한다.
---

HWPX Bridge is a local MCP plugin for native Windows x64.

1. If `hwpx_runtime_status` is available, call it. A ready runtime needs no reinstall.
2. If `hwpx_setup` is available, call it once. It prepares private Node.js and .NET SDK/build dependencies, verifies and compiles the included Filee and kordoc source, and installs Tesseract, 4 OCR language packs (kor, eng, chi_tra, chi_sim), and all pinned text/formula OCR models. User-initiated setup authorizes these installation downloads. Do not ask the user to install Node.js, .NET SDK, npm, Python, Hancom, or a separate Filee application.
3. Poll `hwpx_setup_status` at reasonable intervals (about 15 seconds); keep the user informed. Do not claim success until `ready` is true. On failure, show the actual error and log path, fix only the specific cause, then retry setup. Never bypass a hash mismatch.
4. On completion, tell the user to reload the plugin/MCP connection or restart the desktop app once. The setup-only connection is intentionally small; the document tools appear on the next connection.
5. Verify `hwpx_runtime_status` after reconnect. Then normal document requests can use the plugin automatically.

If NEITHER runtime nor setup tools exist, MCP registration has not been verified. Do not claim the plugin is operational, call nonexistent tools, or repeatedly ask for restarts. A marketplace skill can load without an MCP connection.

Use the independent client setup, following kordoc's setup registration workflow:
- On a native Windows shell, the packaged installer is `scripts/client-setup.ps1` relative to the plugin root (two directories above this skill directory). Run Windows PowerShell `-NoProfile -ExecutionPolicy Bypass -File` with the quoted absolute script path and `-Clients ClaudeDesktop`. Use `-Clients Codex` only for a standalone Codex registration when its marketplace MCP is not already active. Do not register every app without the user's choice.
- In Claude without a native Windows shell, provide the [versioned common installer](https://github.com/ThisIsMarkive/foryourdocument/releases/download/v0.2.2/Install-HwpxBridge.ps1). The user runs this ONCE on their Windows PC, choosing Claude or Codex. It automatically prepares private Node, copies a stable source installation, backs up/merges MCP configuration, and prepares engines/OCR. It works independently of missing MCP tools. A downloaded PowerShell script can be run with `powershell -NoProfile -ExecutionPolicy Bypass -File "<downloaded absolute path>" -Clients ClaudeDesktop`.
- This is a per-computer setup step, like kordoc's `npx kordoc setup`; marketplace installation alone is NOT promised to register MCP in every Claude Windows conversation. Never claim the original kordoc marketplace automatically registers a Desktop MCP: its skill runs the CLI; its separate setup writes client configuration.
- Do not execute the Windows installer inside a Linux/Cowork/cloud VM or edit the user's Claude plugin caches. After successful registration/setup, reload the app once and verify real tools. If absent, obtain the actual MCP error; do not repeat a restart loop.

Setup requires internet and several GB of free disk for downloads and installed files. It uses the current user's local application data directory. No administrator rights or system PATH changes are required. The conversion/OCR engine can work offline after setup; Codex/Claude AI service connectivity is separate. Never describe this as making the cloud AI model itself offline.
