---
name: setup
description: hwpx-bridge MCP 설치·등록·상태 확인. 도구(filee_convert, parse_document 등)가 보이지 않을 때 사용한다.
---

hwpx-bridge is one npm package. Installation is a single command on the user's computer (Node.js 20+ required,
same as kordoc):

```
npx -y hwpx-bridge setup
```

It asks nothing: it finds every AI app on the computer (Claude app, Claude Code, Codex app (Codex and Work modes)/CLI/IDE via
`~/.codex/config.toml`, Cursor, Gemini CLI, Windsurf) and registers hwpx-bridge in all of them. Each app is then
restarted once, after which the tools appear in every conversation of that app. `--client a,b` limits the apps.

1. If `hwpx_bridge_status` is available, call it and report what it says. Nothing needs installing.
2. If no hwpx-bridge tools exist, give the user the command above. Run it yourself only with a shell on the user's
   own computer (not in a cloud or VM workspace) and only after they agree, since it changes app settings.
3. If Node.js is missing or older than 20 (`npx` not found) on Windows, use the installer instead; it installs
   Node.js LTS (winget, or the official nodejs.org zip when winget is missing; no administrator rights) and then runs setup. Ask before running it:
   `irm https://raw.githubusercontent.com/ThisIsMarkive/foryourdocument/main/install.ps1 | iex`
   On other systems, tell the user to install the LTS version from https://nodejs.org first.
4. `npx -y hwpx-bridge doctor` checks kordoc, Filee and the MCP server and prints the result.

Filee conversion is available on Windows x64 and Linux x64. On other systems the kordoc tools still work and
`filee_convert` reports that it is unavailable. Do not claim tools are working until they appear and answer.
