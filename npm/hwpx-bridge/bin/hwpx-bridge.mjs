#!/usr/bin/env node
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const [command = 'help', ...rest] = process.argv.slice(2);

const HELP = `hwpx-bridge ${pkg.version} — kordoc + Filee document conversion as one MCP server

  npx -y hwpx-bridge setup            이 PC의 AI 앱(Claude 앱, Claude Code, Codex, Cursor ...) 모두에 등록
  npx -y hwpx-bridge setup --client claude-desktop,codex   일부 앱에만 등록
  npx -y hwpx-bridge config           직접 붙여 넣을 MCP 설정 JSON 출력
  npx -y hwpx-bridge doctor           kordoc·Filee 실행 확인
  npx -y hwpx-bridge mcp              MCP 서버 실행 (앱이 이 명령을 실행합니다)
`;

try {
  switch (command) {
    case 'mcp': await (await import('../lib/server.mjs')).startServer(); break;
    case 'setup': await (await import('../lib/setup.mjs')).runSetup(rest); break;
    case 'config': (await import('../lib/setup.mjs')).printConfig(); break;
    case 'doctor': await (await import('../lib/doctor.mjs')).runDoctor(); break;
    case '-v': case '--version': case 'version': console.log(pkg.version); break;
    default: console.log(HELP);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
