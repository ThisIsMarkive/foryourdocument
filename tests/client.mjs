import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const plugin = path.join(repo, 'plugins/hwpx-bridge');
export const home = process.env.HWPX_BRIDGE_HOME;
if (!home) throw new Error('Set HWPX_BRIDGE_HOME to an isolated installed test runtime.');
export const assets = JSON.parse(await fs.readFile(path.join(plugin, 'runtime/assets.json'), 'utf8'));
export const runtime = path.join(home, 'versions', `${assets.bundleVersion}-win-x64`);
export const requireRuntime = createRequire(path.join(runtime, 'npm/package.json'));
const sdk = module => import(pathToFileURL(requireRuntime.resolve(`@modelcontextprotocol/sdk/${module}`)).href);
const [{ Client }, { StdioClientTransport }] = await Promise.all([sdk('client/index.js'), sdk('client/stdio.js')]);
export async function connect({ targetHome = home, pluginRoot = plugin, desktop = false } = {}) {
  const client = new Client({ name: 'hwpx-bridge-integration-tests', version: assets.bundleVersion });
  const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string'));
  // Prove the launcher does not find Node/npm on PATH.
  env.PATH = `${process.env.SystemRoot}\\System32`;
  env.HWPX_BRIDGE_HOME = targetHome;
  const transport = new StdioClientTransport({
    command: desktop ? process.execPath : path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    args: desktop ? [path.join(pluginRoot, 'desktop-launch.mjs')] : ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(pluginRoot, 'scripts/launch.ps1')],
    env, stderr: 'pipe'
  });
  let stderr = '';
  transport.onerror = error => { stderr += error.message; };
  const connecting = client.connect(transport);
  transport.stderr?.on('data', bytes => { stderr += bytes.toString('utf8'); });
  try { await connecting; } catch (error) { throw new Error(`${error.message}\n${stderr}`); }
  return { client, transport, stderr: () => stderr, close: () => client.close() };
}
