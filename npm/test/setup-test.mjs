// `hwpx-bridge setup` with no arguments must find the AI apps on the computer and register all of them,
// keeping existing settings. Runs against a throw-away home folder; run from a folder where hwpx-bridge
// is installed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'hwpx-bridge-home-'));
const isWin = process.platform === 'win32';
const appData = path.join(home, 'AppData', 'Roaming');
const desktopDir = isWin ? path.join(appData, 'Claude') : path.join(home, '.config', 'Claude');
// A leftover Microsoft Store folder must not hide the regular %APPDATA%\Claude config (seen on a real PC).
const storeDir = path.join(home, 'AppData', 'Local', 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude');
for (const dir of [desktopDir, path.join(home, '.codex'), path.join(home, '.cursor'), ...(isWin ? [storeDir] : [])]) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(home, '.codex', 'config.toml'), 'model = "x"\n\n[mcp_servers.other]\ncommand = "other"\n');
fs.writeFileSync(path.join(home, '.cursor', 'mcp.json'), '{"mcpServers":{"other":{"command":"other"}}}');

const env = { ...process.env, HWPX_BRIDGE_SKIP_PREWARM: '1', HOME: home, USERPROFILE: home, APPDATA: appData, LOCALAPPDATA: path.join(home, 'AppData', 'Local'), CODEX_HOME: '' };
// Keep a real Claude Code CLI on the test machine out of this test.
env.PATH = (env.PATH ?? env.Path ?? '').split(path.delimiter).filter(p => !fs.existsSync(path.join(p, isWin ? 'claude.cmd' : 'claude'))).join(path.delimiter);
const result = spawnSync(isWin ? 'npx.cmd' : 'npx', ['hwpx-bridge', 'setup'], { env, encoding: 'utf8', shell: isWin });
console.log(result.stdout, result.stderr);
assert.equal(result.status, 0, 'setup failed');

const pinned = /hwpx-bridge@\d+\.\d+\.\d+/;
const desktop = JSON.parse(fs.readFileSync(path.join(desktopDir, 'claude_desktop_config.json'), 'utf8'));
assert.match(desktop.mcpServers['hwpx-bridge'].args.join(' '), pinned);
if (isWin) {
  const store = JSON.parse(fs.readFileSync(path.join(storeDir, 'claude_desktop_config.json'), 'utf8'));
  assert.match(store.mcpServers['hwpx-bridge'].args.join(' '), pinned, 'Store-build config not registered');
}
const cursor = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8'));
assert.ok(cursor.mcpServers.other && pinned.test(cursor.mcpServers['hwpx-bridge'].args.join(' ')), 'Cursor entry missing or other server lost');
const toml = fs.readFileSync(path.join(home, '.codex', 'config.toml'), 'utf8');
assert.ok(toml.includes('[mcp_servers.other]') && toml.includes('[mcp_servers.hwpx-bridge]') && pinned.test(toml), 'Codex config.toml not merged');
assert.ok(!fs.existsSync(path.join(home, '.gemini')), 'apps that are not installed must be skipped');
fs.rmSync(home, { recursive: true, force: true });
console.log('SETUP TEST PASSED');
