---
name: setup
description: HWPX Bridge 최초 설정, 설치 상태 확인, 엔진 준비. Node.js를 따로 설치하지 않고 Filee·kordoc·OCR을 자동으로 준비할 때 사용한다.
---

HWPX Bridge is a local MCP plugin for native Windows x64.

1. If `hwpx_runtime_status` is available, call it. A ready runtime needs no reinstall.
2. Otherwise call `hwpx_setup` once. It prepares private Node.js and .NET SDK/build dependencies, verifies and compiles the included Filee and kordoc source, and installs Tesseract, 4 OCR language packs (kor, eng, chi_tra, chi_sim), and all pinned text/formula OCR models. User-initiated setup authorizes these installation downloads. Do not ask the user to install Node.js, .NET SDK, npm, Python, Hancom, or a separate Filee application.
3. Poll `hwpx_setup_status` at reasonable intervals (about 15 seconds); keep the user informed. Do not claim success until `ready` is true. On failure, show the actual error and log path, fix only the specific cause, then retry setup. Never bypass a hash mismatch.
4. On completion, tell the user to reload the plugin/MCP connection or restart the desktop app once. The setup-only connection is intentionally small; the document tools appear on the next connection.
5. Verify `hwpx_runtime_status` after reconnect. Then normal document requests can use the plugin automatically.

If the host has not started the MCP server yet and provides a native Windows shell, the same installer is `scripts/setup.ps1` relative to this skill's plugin root (two directories above this skill directory). Run with Windows PowerShell `-NoProfile -ExecutionPolicy Bypass -File` and a quoted absolute path. Do not run it inside a Linux/Cowork VM.

Setup requires internet and several GB of free disk for downloads and installed files. It uses the current user's local application data directory. No administrator rights or system PATH changes are required. The conversion/OCR engine can work offline after setup; Codex/Claude AI service connectivity is separate. Never describe this as making the cloud AI model itself offline.
