import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { claudeConfigPath, serverEntry, registerClaude, registerCodex, installStableSource } from '../plugins/hwpx-bridge/scripts/register-clients.mjs';
const run = promisify(execFile);
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await fs.mkdtemp(path.join(process.env.HWPX_BRIDGE_TEST_ROOT || os.tmpdir(), 'hwpx-registration-'));
const fixture = (...parts) => path.join(root, ...parts);
const entry = serverEntry(fixture('installed source'), fixture('runtime'), process.env.SystemRoot || path.resolve('/windows'));

test('Claude registration preserves unrelated settings, creates backup and is idempotent', async () => {
  const file = fixture('roaming/Claude/claude_desktop_config.json');
  await fs.mkdir(path.dirname(file), { recursive: true });
  const before = { preferences: { locale: 'ko-KR' }, mcpServers: { other: { command: 'example', args: ['unchanged'] } } };
  const raw = JSON.stringify(before, null, 2);
  await fs.writeFile(file, '\uFEFF' + raw);
  const first = await registerClaude(file, entry);
  assert.equal(await fs.readFile(first.backup, 'utf8'), '\uFEFF' + raw);
  const after = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.deepEqual(after.preferences, before.preferences);
  assert.deepEqual(after.mcpServers.other, before.mcpServers.other);
  assert.deepEqual(after.mcpServers['hwpx-bridge'], entry);
  assert.equal((await registerClaude(file, entry)).changed, false);
  const updated = serverEntry(fixture('upgraded source'), fixture('runtime'), process.env.SystemRoot || path.resolve('/windows'));
  assert.equal((await registerClaude(file, updated)).changed, true);
});
test('Claude discovers the Microsoft Store path and supports a regular installation', async () => {
  const env = { appData: fixture('profile/Roaming'), localAppData: fixture('profile/Local') };
  assert.equal(await claudeConfigPath(env), path.join(env.appData, 'Claude/claude_desktop_config.json'));
  const store = path.join(env.localAppData, 'Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude');
  await fs.mkdir(store, { recursive: true });
  assert.equal(await claudeConfigPath(env), path.join(store, 'claude_desktop_config.json'));
});
test('Malformed configuration and an unrelated same-name server remain untouched', async () => {
  for (const [i, raw] of ['{broken', '[]', '{"mcpServers":[]}', '{"mcpServers":{"hwpx-bridge":{"command":"independent-server"}}}'].entries()) {
    const file = fixture(`invalid-${i}.json`);
    await fs.writeFile(file, raw);
    await assert.rejects(registerClaude(file, entry));
    assert.equal(await fs.readFile(file, 'utf8'), raw);
  }
});
test('Real Codex CLI registration preserves other entries in an isolated CODEX_HOME', { skip: !process.env.HWPX_BRIDGE_TEST_CODEX }, async () => {
  const codex = process.env.HWPX_BRIDGE_TEST_CODEX;
  const env = { ...process.env, CODEX_HOME: fixture('codex-profile') };
  await fs.mkdir(env.CODEX_HOME, { recursive: true });
  const original = '# existing user settings\nmodel = "gpt-6"\n\n[mcp_servers.other]\ncommand = "unchanged"\n';
  await fs.writeFile(path.join(env.CODEX_HOME, 'config.toml'), original);
  const result = await registerCodex(codex, entry, { env });
  assert.equal(await fs.readFile(result.backup, 'utf8'), original);
  const all = JSON.parse((await run(codex, ['mcp', 'list', '--json'], { env, windowsHide: true })).stdout);
  assert.equal(all.find(x => x.name === 'other').transport.command, 'unchanged');
  assert.deepEqual(all.find(x => x.name === 'hwpx-bridge').transport.args, entry.args);
  assert.equal((await registerCodex(codex, entry, { env })).changed, false);
});
test('Installed source survives the download folder and boots from the saved Claude configuration', { skip: !process.env.HWPX_BRIDGE_TEST_SDK || process.platform !== 'win32', timeout: 120000 }, async () => {
  const home = fixture('second computer/runtime');
  const plugin = path.join(repo, 'plugins/hwpx-bridge');
  await assert.rejects(installStableSource(plugin, path.join(plugin, 'runtime-home')), /outside the source/);
  const installed = await installStableSource(plugin, home);
  assert.ok(installed.startsWith(path.join(home, 'sources') + path.sep));
  assert.equal(await installStableSource(plugin, home), installed);
  const config = fixture('second computer/roaming/Claude/claude_desktop_config.json');
  await registerClaude(config, serverEntry(installed, home));
  const saved = JSON.parse(await fs.readFile(config, 'utf8')).mcpServers['hwpx-bridge'];
  assert.ok(!saved.args.at(-1).startsWith(repo));
  const req = createRequire(path.join(process.env.HWPX_BRIDGE_TEST_SDK, 'package.json'));
  const { Client } = await import(pathToFileURL(req.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
  const { StdioClientTransport } = await import(pathToFileURL(req.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href);
  const client = new Client({ name: 'registration-test', version: '1' });
  const transport = new StdioClientTransport({ ...saved, env: { ...process.env, ...saved.env, PATH: path.join(process.env.SystemRoot, 'System32') }, stderr: 'pipe' });
  transport.stderr?.resume();
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(x => x.name), ['hwpx_setup', 'hwpx_setup_status']);
    const result = await client.callTool({ name: 'hwpx_setup_status', arguments: {} });
    assert.equal(JSON.parse(result.content[0].text).ready, false);
  } finally { await client.close(); }
  // An altered immutable installation must not be accepted on rerun.
  await fs.appendFile(path.join(installed, 'scripts/launch.ps1'), '\n# modified\n');
  await assert.rejects(installStableSource(plugin, home), /integrity mismatch/);
});
console.log(`Registration test fixtures (no real client settings changed): ${root}`);
