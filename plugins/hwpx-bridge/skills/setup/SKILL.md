---
name: setup
description: hwpx-bridge MCP 설치·등록·상태 확인. 도구(filee_convert, parse_document 등)가 보이지 않을 때 사용한다.
---

hwpx-bridge is one npm package. Installation is a single command on the user's computer (Node.js 20+ required,
same as kordoc):

```
npx -y hwpx-bridge setup
```

It asks which apps to register (Claude app, Claude Code, Codex, Cursor, Gemini CLI, Windsurf) and writes their MCP
configuration. Non-interactive: `npx -y hwpx-bridge setup --client claude-desktop,claude-code,codex`.
Then the app is restarted once.

1. If `hwpx_bridge_status` is available, call it and report what it says. Nothing needs installing.
2. If no hwpx-bridge tools exist, give the user the command above. Run it yourself only with a shell on the user's
   own computer (not in a cloud or VM workspace) and only after they agree, since it changes app settings.
3. If Node.js is missing (`npx` not found), tell the user to install the LTS version from https://nodejs.org first.
4. `npx -y hwpx-bridge doctor` checks kordoc, Filee and the MCP server and prints the result.

Filee conversion is available on Windows x64 and Linux x64. On other systems the kordoc tools still work and
`filee_convert` reports that it is unavailable. Do not claim tools are working until they appear and answer.
