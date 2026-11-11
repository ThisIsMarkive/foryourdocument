// Registration workflow adapted from kordoc src/setup.ts (MIT, copyright chrisryugj).
// The vendored engine snapshot remains unchanged. No app is launched or restarted here.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileHash, listFiles, verifySources } from './source-tools.mjs';
const run = promisify(execFile);
const exists = async p => fs.access(p).then(() => true, () => false);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const managed = x => x?.env?.HWPX_BRIDGE_REGISTRATION === '1';

export async function claudeConfigPath({ appData = process.env.APPDATA, localAppData = process.env.LOCALAPPDATA } = {}) {
  if (!appData || !localAppData) throw new Error('Windows APPDATA and LOCALAPPDATA are required.');
  const packaged = path.join(localAppData, 'Packages/Claude_pzs8sxrjxfjjc/LocalCache/Roaming/Claude');
  // Microsoft Store Claude reads its package-local roaming directory.
  return path.join(await exists(packaged) ? packaged : path.join(appData, 'Claude'), 'claude_desktop_config.json');
}
export function serverEntry(plugin, home, systemRoot = process.env.SystemRoot) {
  if (![plugin, home, systemRoot].every(p => typeof p === 'string' && path.isAbsolute(p))) throw new Error('Absolute installation and Windows paths are required.');
  return {
    command: path.join(systemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(plugin, 'scripts/launch.ps1')],
    env: { HWPX_BRIDGE_HOME: home, HWPX_BRIDGE_REGISTRATION: '1' }
  };
}
async function backup(file) {
  if (!await exists(file)) return null;
  const dest = `${file}.hwpx-bridge-${Date.now()}-${process.pid}.bak`;
  await fs.copyFile(file, dest, fs.constants.COPYFILE_EXCL);
  return dest;
}
export async function registerClaude(file, entry) {
  let config = {};
  if (await exists(file)) config = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
  if (!object(config) || (config.mcpServers !== undefined && !object(config.mcpServers))) throw new Error(`Invalid Claude configuration; left unchanged: ${file}`);
  const previous = config.mcpServers?.['hwpx-bridge'];
  if (JSON.stringify(previous) === JSON.stringify(entry)) return { client: 'ClaudeDesktop', changed: false, configPath: file };
  if (previous && !managed(previous)) throw new Error(`An independently configured hwpx-bridge already exists; left unchanged: ${file}`);
  const saved = await backup(file);
  config.mcpServers = { ...config.mcpServers, 'hwpx-bridge': entry };
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(config, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  await fs.rename(temp, file);
  return { client: 'ClaudeDesktop', changed: true, configPath: file, backup: saved };
}
export async function registerCodex(command, entry, { env = process.env } = {}) {
  if (!command) throw new Error('Codex CLI was not found. Use the Codex marketplace installation, or run this setup where codex.exe is available.');
  const configPath = path.join(env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'config.toml');
  const options = { env, windowsHide: true, timeout: 30000, maxBuffer: 2 * 1024 * 1024 };
  // Query the entire list so an actual CLI/configuration failure is never mistaken for absence.
  const listed = JSON.parse((await run(command, ['mcp', 'list', '--json'], options)).stdout);
  if (!Array.isArray(listed)) throw new Error('Unexpected Codex MCP list response.');
  const previous = listed.find(x => x.name === 'hwpx-bridge');
  if (previous && !managed(previous.transport)) throw new Error('An independently configured hwpx-bridge exists in Codex; left unchanged.');
  if (previous?.transport.command === entry.command && JSON.stringify(previous.transport.args) === JSON.stringify(entry.args)
      && Object.keys(previous.transport.env || {}).length === Object.keys(entry.env).length
      && Object.entries(entry.env).every(([key, value]) => previous.transport.env?.[key] === value)) {
    return { client: 'Codex', changed: false, configPath };
  }
  const saved = await backup(configPath);
  const args = ['mcp', 'add', 'hwpx-bridge'];
  for (const [key, value] of Object.entries(entry.env)) args.push('--env', `${key}=${value}`);
  args.push('--', entry.command, ...entry.args);
  await run(command, args, options);
  const actual = JSON.parse((await run(command, ['mcp', 'get', 'hwpx-bridge', '--json'], options)).stdout);
  if (actual.transport?.command !== entry.command || JSON.stringify(actual.transport?.args) !== JSON.stringify(entry.args) || !managed(actual.transport)) throw new Error('Codex registration read-back did not match.');
  return { client: 'Codex', changed: true, configPath, backup: saved };
}
async function snapshotDigest(root) {
  const records = [];
  for (const file of await listFiles(root)) records.push(`${file}:${await fileHash(path.join(root, file))}`);
  return createHash('sha256').update(records.join('\n')).digest('hex');
}
export async function installStableSource(plugin, home) {
  const relative = path.relative(path.resolve(plugin), path.resolve(home));
  if (relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('Choose a runtime home outside the source plugin directory.');
  await verifySources(plugin);
  const { bundleVersion } = JSON.parse(await fs.readFile(path.join(plugin, 'runtime/assets.json'), 'utf8'));
  const digest = await snapshotDigest(plugin);
  const destination = path.join(home, 'sources', `${bundleVersion}-${digest.slice(0, 16)}`);
  if (await exists(destination)) {
    if (await snapshotDigest(destination) !== digest) throw new Error('Installed source integrity mismatch. Existing files were not replaced.');
    return destination;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const stage = `${destination}.staging-${process.pid}`;
  if (await exists(stage)) throw new Error(`Installation staging directory already exists: ${stage}`);
  await fs.cp(plugin, stage, { recursive: true, errorOnExist: true, force: false });
  if (await snapshotDigest(stage) !== digest) throw new Error('Source copy verification failed.');
  await fs.rename(stage, destination);
  return destination;
}
async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Native Windows x64 is required.');
  const args = process.argv.slice(2);
  const arg = name => args[args.indexOf(name) + 1];
  if (!args.includes('--home') || !args.includes('--clients')) throw new Error('--home and --clients are required.');
  const clients = arg('--clients').split(',');
  if (!clients.length || clients.some(c => !['ClaudeDesktop', 'Codex'].includes(c))) throw new Error('Choose ClaudeDesktop and/or Codex.');
  const home = path.resolve(arg('--home'));
  const plugin = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const installed = await installStableSource(plugin, home);
  const entry = serverEntry(installed, home);
  const results = [];
  for (const client of [...new Set(clients)]) {
    try {
      results.push(client === 'ClaudeDesktop'
        ? await registerClaude(await claudeConfigPath(), entry)
        : await registerCodex(args.includes('--codex') ? arg('--codex') : null, entry));
    } catch (error) { results.push({ client, error: error.message }); }
  }
  console.log(JSON.stringify({ pluginRoot: installed, results, enginesReady: false }, null, 2));
  if (results.some(r => r.error)) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
