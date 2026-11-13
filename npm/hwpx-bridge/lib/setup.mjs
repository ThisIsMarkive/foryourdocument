// `npx -y hwpx-bridge setup` — register the MCP server in every AI app found on this computer.
//
// No questions: wherever the command runs (a terminal, Codex, Claude Code ...), every installed app gets
// the same entry. `--client a,b` limits it to some apps. Config files are merged in place with a backup;
// Claude Code is registered through its own CLI. Nothing else on the computer is changed.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const NAME = 'hwpx-bridge';
const isWin = process.platform === 'win32';
const home = () => os.homedir();

/** Pinned so a client never silently runs a newer (or hijacked) npm release. */
export function packageSpec(version = pkg.version) {
  return /^\d+\.\d+\.\d+$/.test(version) ? `${NAME}@${version}` : NAME;
}

/** Apps on Windows cannot start npx.cmd directly, hence `cmd /c`. */
export function serverEntry() {
  return isWin
    ? { command: 'cmd', args: ['/c', 'npx', '-y', packageSpec(), 'mcp'] }
    : { command: 'npx', args: ['-y', packageSpec(), 'mcp'] };
}

function onPath(command) {
  const result = spawnSync(isWin ? 'where' : 'which', [command], { stdio: 'ignore', windowsHide: true });
  return result.status === 0;
}

const exists = file => fss.existsSync(file);

const CONFIG_NAME = 'claude_desktop_config.json';
// Folders inside a Claude data tree that never hold the config file but can be large.
const SKIP_DIR = /^(app-\d|resources$|node_modules$|logs$|.*cache$|crashpad$|indexeddb$|local storage$|session storage$|blob_storage$|service worker$|vm_bundles$|claude-code|sentry$|webstorage$|shared dictionary$)/i;

/** Find claude_desktop_config.json files below `dir` (depth-limited, skipping cache folders). */
function findConfigs(dir, depth, found) {
  let entries;
  try { entries = fss.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === CONFIG_NAME) found.add(path.join(dir, entry.name));
    else if (entry.isDirectory() && depth > 0 && !SKIP_DIR.test(entry.name)) findConfigs(path.join(dir, entry.name), depth - 1, found);
  }
}

/**
 * Every Claude app config file on this computer. Builds differ in where they keep it: the regular installer
 * uses %APPDATA%\Claude, a virtualized Microsoft Store build reads %LOCALAPPDATA%\Packages\Claude_*\LocalCache\
 * Roaming\Claude, and other Store builds have been seen using %LOCALAPPDATA%\claude-data\Claude_*. Rather than
 * guess one, look in every Claude folder under %APPDATA% and %LOCALAPPDATA% (and Packages) and register in each
 * config file found. With none found, use the regular location.
 */
function claudeDesktopConfigs() {
  if (isWin) {
    const appData = process.env.APPDATA ?? path.join(home(), 'AppData/Roaming');
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home(), 'AppData/Local');
    const found = new Set();
    for (const root of [appData, localAppData, path.join(localAppData, 'Packages')]) {
      let entries = [];
      try { entries = fss.readdirSync(root, { withFileTypes: true }); } catch { /* missing */ }
      for (const entry of entries) {
        if (entry.isDirectory() && /claude/i.test(entry.name) && !/^claude-code/i.test(entry.name)) findConfigs(path.join(root, entry.name), 5, found);
      }
    }
    // A Claude data folder without a config file yet (the app creates it on first settings change).
    for (const dir of [path.join(appData, 'Claude'), path.join(localAppData, 'Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude')]) {
      if (exists(dir)) found.add(path.join(dir, CONFIG_NAME));
    }
    return found.size ? [...found] : [path.join(appData, 'Claude', CONFIG_NAME)];
  }
  if (process.platform === 'darwin') return [path.join(home(), 'Library/Application Support/Claude', CONFIG_NAME)];
  return [path.join(home(), '.config/Claude', CONFIG_NAME)];
}

function claudeDesktopInstalled() {
  if (claudeDesktopConfigs().some(config => exists(path.dirname(config)))) return true;
  if (isWin) return exists(path.join(process.env.LOCALAPPDATA ?? path.join(home(), 'AppData/Local'), 'AnthropicClaude'));
  if (process.platform === 'darwin') return exists('/Applications/Claude.app');
  return false;
}

async function registerClaudeDesktop() {
  const results = [];
  for (const config of claudeDesktopConfigs()) results.push(await registerJson(config));
  return results.join(', ');
}

const codexHome = () => process.env.CODEX_HOME || path.join(home(), '.codex');

export const CLIENTS = [
  { id: 'claude-desktop', label: 'Claude 앱', found: claudeDesktopInstalled, register: registerClaudeDesktop },
  { id: 'claude-code', label: 'Claude Code', found: () => onPath('claude'), register: registerClaudeCode },
  { id: 'codex', label: 'Codex (ChatGPT 데스크톱·CLI·IDE)', found: () => exists(codexHome()) || onPath('codex'), register: registerCodex },
  { id: 'cursor', label: 'Cursor', found: () => exists(path.join(home(), '.cursor')), register: () => registerJson(path.join(home(), '.cursor/mcp.json')) },
  { id: 'gemini', label: 'Gemini CLI', found: () => exists(path.join(home(), '.gemini')), register: () => registerJson(path.join(home(), '.gemini/settings.json')) },
  { id: 'windsurf', label: 'Windsurf', found: () => exists(path.join(home(), '.codeium/windsurf')), register: () => registerJson(path.join(home(), '.codeium/windsurf/mcp_config.json')) }
];

async function backup(file) {
  if (exists(file)) await fs.copyFile(file, `${file}.bak-${Date.now()}`);
}

async function registerJson(file) {
  let config = {};
  if (exists(file)) {
    const raw = (await fs.readFile(file, 'utf8')).replace(/^﻿/, '');
    config = raw.trim() ? JSON.parse(raw) : {};
  }
  if (typeof config !== 'object' || config === null || Array.isArray(config)) throw new Error(`설정 파일 형식이 올바르지 않아 그대로 두었습니다: ${file}`);
  const entry = serverEntry();
  if (JSON.stringify(config.mcpServers?.[NAME]) === JSON.stringify(entry)) return `이미 등록됨 (${file})`;
  await backup(file);
  config.mcpServers = { ...(config.mcpServers ?? {}), [NAME]: entry };
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return `등록 완료 (${file})`;
}

/** Codex keeps MCP servers in config.toml, shared by the Codex app, CLI and IDE extension. */
export function codexBlock() {
  const entry = serverEntry();
  return [
    `[mcp_servers.${NAME}]`,
    `command = ${JSON.stringify(entry.command)}`,
    `args = [${entry.args.map(a => JSON.stringify(a)).join(', ')}]`,
    'startup_timeout_sec = 180   # first start downloads the engines',
    'tool_timeout_sec = 1800     # OCR model download, long conversions',
    ''
  ].join('\n');
}

/** Replace an existing [mcp_servers.hwpx-bridge] table (and its sub-tables) or append one. */
export function mergeCodexToml(text) {
  const header = /^\s*\[\s*mcp_servers\s*\.\s*(?:"hwpx-bridge"|hwpx-bridge)\s*(?:\.[^\]]*)?\]\s*(#.*)?$/;
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const kept = [];
  let skipping = false;
  for (const line of lines) {
    if (/^\s*\[/.test(line)) skipping = header.test(line);
    if (!skipping) kept.push(line);
  }
  const body = kept.join('\n').replace(/\s+$/, '');
  return (body ? `${body}\n\n` : '') + codexBlock();
}

async function registerCodex() {
  const file = path.join(codexHome(), 'config.toml');
  const before = exists(file) ? await fs.readFile(file, 'utf8') : '';
  const after = mergeCodexToml(before);
  if (before.replace(/\r\n/g, '\n') === after) return `이미 등록됨 (${file})`;
  await backup(file);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, after, 'utf8');
  return `등록 완료 (${file})`;
}

async function registerClaudeCode() {
  const entry = serverEntry();
  // claude is a .cmd shim on Windows; start it through cmd.exe instead of shell: true.
  const claude = (args) => isWin
    ? run(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'claude', ...args], { windowsHide: true, timeout: 60_000 })
    : run('claude', args, { timeout: 60_000 });
  // Replace an earlier registration (e.g. an older pinned version).
  await claude(['mcp', 'remove', '--scope', 'user', NAME]).catch(() => {});
  await claude(['mcp', 'add', '--scope', 'user', NAME, '--', entry.command, ...entry.args]);
  return '등록 완료 (claude mcp add --scope user)';
}

export async function runSetup(argv) {
  const flag = argv.indexOf('--client');
  let clients;
  if (flag >= 0) {
    const ids = (argv[flag + 1] ?? '').split(',').filter(Boolean);
    clients = ids.map(id => CLIENTS.find(c => c.id === id));
    if (!ids.length || clients.some(c => !c)) throw new Error(`--client 값: ${CLIENTS.map(c => c.id).join(', ')}`);
  } else {
    clients = CLIENTS.filter(client => client.found());
    const missing = CLIENTS.filter(client => !clients.includes(client)).map(client => client.label);
    console.log(`\nhwpx-bridge ${pkg.version}: 이 PC에서 찾은 AI 앱 모두에 등록합니다.`);
    if (missing.length) console.log(`  (설치되지 않아 건너뜀: ${missing.join(', ')})`);
    if (!clients.length) {
      console.log('\n등록할 AI 앱을 찾지 못했습니다. 앱을 설치한 뒤 다시 실행하거나, 아래 설정을 앱에 직접 넣으세요.\n');
      printConfig();
      process.exitCode = 1;
      return;
    }
  }
  console.log('');
  let failed = false;
  for (const client of clients) {
    try {
      console.log(`  + ${client.label}: ${await client.register()}`);
    } catch (error) {
      failed = true;
      console.log(`  x ${client.label}: ${error.code === 'ENOENT' ? '명령을 찾을 수 없습니다.' : error.message.split('\n')[0]}`);
    }
  }
  if (!failed || clients.length > 1) prewarm();
  console.log('\n등록한 앱을 완전히 종료했다가 다시 열면 hwpx-bridge 도구(kordoc 전체 + filee_convert)가 모든 대화에서 보입니다.');
  if (failed) process.exitCode = 1;
}

/**
 * Download the exact package the apps will start (`npx -y hwpx-bridge@<version>`), so their first start does
 * not spend minutes downloading and hit the app's MCP startup timeout. npx caches per package spec, so the
 * spec must match the registered one exactly.
 */
function prewarm() {
  if (process.env.HWPX_BRIDGE_SKIP_PREWARM) return;
  const entry = serverEntry();
  const args = [...entry.args.slice(0, -1), '--version']; // same spec as the apps, but just print the version
  console.log(`\n엔진 준비: ${packageSpec()} 내려받는 중 (처음 한 번, 몇 분 걸릴 수 있습니다)...`);
  const result = spawnSync(entry.command, args, { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', windowsHide: true, timeout: 20 * 60_000 });
  if (result.status === 0) console.log(`  + 준비 완료 (${result.stdout.trim()})`);
  else console.log(`  x 미리 내려받지 못했습니다. 앱 첫 실행이 오래 걸리면 'npx -y ${packageSpec()} doctor'를 한 번 실행하세요.`);
}

export function printConfig() {
  console.log(JSON.stringify({ mcpServers: { [NAME]: serverEntry() } }, null, 2));
  console.log(`\nCodex (~/.codex/config.toml):\n\n${codexBlock()}`);
}
