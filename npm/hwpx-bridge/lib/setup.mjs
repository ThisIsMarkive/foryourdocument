// `npx -y hwpx-bridge setup` — register the MCP server in AI clients.
// Same approach as kordoc's src/setup.ts (MIT, chrisryugj): JSON config files are merged in place,
// Claude Code and Codex are registered through their own CLIs. Nothing else on the computer is changed.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { createRequire } from 'node:module';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const NAME = 'hwpx-bridge';
const isWin = process.platform === 'win32';

/** Pinned so a client never silently runs a newer (or hijacked) npm release. */
export function packageSpec(version = pkg.version) {
  return /^\d+\.\d+\.\d+$/.test(version) ? `${NAME}@${version}` : NAME;
}

/** Claude Desktop on Windows cannot start npx.cmd directly, hence `cmd /c`. */
export function serverEntry() {
  return isWin
    ? { command: 'cmd', args: ['/c', 'npx', '-y', packageSpec(), 'mcp'] }
    : { command: 'npx', args: ['-y', packageSpec(), 'mcp'] };
}

function claudeDesktopConfig() {
  const home = os.homedir();
  if (isWin) {
    const appData = process.env.APPDATA ?? path.join(home, 'AppData/Roaming');
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, 'AppData/Local');
    // The Microsoft Store build of Claude reads a package-local copy of %APPDATA%.
    const store = path.join(localAppData, 'Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude');
    return path.join(fss.existsSync(store) ? store : path.join(appData, 'Claude'), 'claude_desktop_config.json');
  }
  if (process.platform === 'darwin') return path.join(home, 'Library/Application Support/Claude/claude_desktop_config.json');
  return path.join(home, '.config/Claude/claude_desktop_config.json');
}

export const CLIENTS = [
  { id: 'claude-desktop', label: 'Claude 앱 (Claude Desktop)', kind: 'json', file: claudeDesktopConfig },
  { id: 'claude-code', label: 'Claude Code (사용자 전체)', kind: 'cli', cli: 'claude' },
  { id: 'codex', label: 'Codex (ChatGPT)', kind: 'cli', cli: 'codex' },
  { id: 'cursor', label: 'Cursor', kind: 'json', file: () => path.join(os.homedir(), '.cursor/mcp.json') },
  { id: 'gemini', label: 'Gemini CLI', kind: 'json', file: () => path.join(os.homedir(), '.gemini/settings.json') },
  { id: 'windsurf', label: 'Windsurf', kind: 'json', file: () => path.join(os.homedir(), '.codeium/windsurf/mcp_config.json') }
];

async function registerJson(file) {
  let config = {};
  if (fss.existsSync(file)) {
    const raw = (await fs.readFile(file, 'utf8')).replace(/^﻿/, '');
    config = raw.trim() ? JSON.parse(raw) : {};
  }
  if (typeof config !== 'object' || config === null || Array.isArray(config)) throw new Error(`설정 파일 형식이 올바르지 않아 그대로 두었습니다: ${file}`);
  const entry = serverEntry();
  if (JSON.stringify(config.mcpServers?.[NAME]) === JSON.stringify(entry)) return `이미 등록됨 (${file})`;
  if (fss.existsSync(file)) await fs.copyFile(file, `${file}.bak-${Date.now()}`);
  config.mcpServers = { ...(config.mcpServers ?? {}), [NAME]: entry };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return `등록 완료 (${file})`;
}

async function registerCli(cli) {
  const options = { windowsHide: true, timeout: 60_000, shell: isWin }; // claude/codex are .cmd shims on Windows
  const entry = serverEntry();
  const scope = cli === 'claude' ? ['--scope', 'user'] : [];
  // Replace an earlier hwpx-bridge registration (e.g. an older pinned version).
  await run(cli, ['mcp', 'remove', ...scope, NAME], options).catch(() => {});
  await run(cli, ['mcp', 'add', ...scope, NAME, '--', entry.command, ...entry.args], options);
  return `등록 완료 (${cli} mcp add)`;
}

async function choose() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log('\nhwpx-bridge를 등록할 AI 앱을 고르세요 (여러 개는 쉼표로, 예: 1,3)\n');
    CLIENTS.forEach((client, i) => console.log(`  ${i + 1}. ${client.label}`));
    const answer = await rl.question('\n번호: ');
    const picked = answer.split(/[,\s]+/).filter(Boolean).map(n => CLIENTS[Number(n) - 1]);
    if (!picked.length || picked.some(c => !c)) throw new Error('올바른 번호를 입력하세요.');
    return picked;
  } finally { rl.close(); }
}

export async function runSetup(argv) {
  const flag = argv.indexOf('--client');
  let clients;
  if (flag >= 0) {
    const ids = (argv[flag + 1] ?? '').split(',').filter(Boolean);
    clients = ids.map(id => CLIENTS.find(c => c.id === id));
    if (!ids.length || clients.some(c => !c)) throw new Error(`--client 값: ${CLIENTS.map(c => c.id).join(', ')}`);
  } else if (process.stdin.isTTY) clients = await choose();
  else throw new Error(`대화형 터미널이 아닙니다. --client ${CLIENTS.map(c => c.id).join(',')} 중에서 지정하세요.`);

  let failed = false;
  for (const client of clients) {
    try {
      const message = client.kind === 'json' ? await registerJson(client.file()) : await registerCli(client.cli);
      console.log(`  + ${client.label}: ${message}`);
    } catch (error) {
      failed = true;
      const hint = error.code === 'ENOENT' ? `${client.cli} 명령을 찾을 수 없습니다.` : error.message;
      console.log(`  x ${client.label}: ${hint}`);
    }
  }
  console.log(`\n앱을 다시 시작하면 'hwpx-bridge' 도구가 나타납니다 (kordoc 도구 + filee_convert).`);
  console.log(`직접 설정하려면: npx -y ${packageSpec()} config`);
  if (failed) process.exitCode = 1;
}

export function printConfig() {
  console.log(JSON.stringify({ mcpServers: { [NAME]: serverEntry() } }, null, 2));
}
