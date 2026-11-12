// `npx -y hwpx-bridge doctor` — start the MCP server once, as an AI app would, and report what works.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { locateFilee } from './filee.mjs';
import { runProcess } from './process.mjs';

export async function runDoctor() {
  const filee = locateFilee();
  if (filee.error) console.log(`x Filee: ${filee.error}`);
  else {
    const version = await runProcess(filee.cli, ['version'], { timeout: 60_000 }).catch(error => ({ code: 1, stdout: '', stderr: error.message }));
    console.log(version.code === 0 ? `+ Filee: ${version.stdout.trim()} (${filee.cli})` : `x Filee: ${version.stderr.trim() || 'failed to start'}`);
  }
  const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '../bin/hwpx-bridge.mjs');
  const client = new Client({ name: 'hwpx-bridge-doctor', version: '0' });
  try {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [bin, 'mcp'], stderr: 'inherit' }));
    const { tools } = await client.listTools();
    console.log(`+ MCP: ${tools.length} tools — ${tools.map(t => t.name).join(', ')}`);
    const status = await client.callTool({ name: 'hwpx_bridge_status', arguments: {} });
    console.log(status.content[0].text);
  } catch (error) {
    console.log(`x MCP: ${error.message}`);
    process.exitCode = 1;
  } finally { await client.close().catch(() => {}); }
}
