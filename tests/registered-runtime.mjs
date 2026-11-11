import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireRuntime } from './client.mjs';
const file = process.argv[2];
if (!file || !path.isAbsolute(file)) throw new Error('Pass the absolute test-profile Claude configuration path.');
const entry = JSON.parse(await fs.readFile(file, 'utf8')).mcpServers['hwpx-bridge'];
const { Client } = await import(pathToFileURL(requireRuntime.resolve('@modelcontextprotocol/sdk/client/index.js')).href);
const { StdioClientTransport } = await import(pathToFileURL(requireRuntime.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href);
const client = new Client({ name: 'registered-runtime-test', version: '1' });
const transport = new StdioClientTransport({ ...entry, env: { ...process.env, ...entry.env, PATH: path.join(process.env.SystemRoot, 'System32') }, stderr: 'pipe' });
const text = result => result.content.filter(x => x.type === 'text').map(x => x.text).join('\n');
async function call(name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, text(result));
  return result;
}
try {
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 25);
  const status = JSON.parse(text(await call('hwpx_runtime_status', {})));
  assert.equal(status.architecture, 'source-integrated');
  const output = path.join(entry.env.HWPX_BRIDGE_HOME, `registered-client-${Date.now()}.hwpx`);
  await call('generate_document', { markdown: '# 설치 검증 보고서\n\n銀行 BANK 2026\n\n| 항목 | 값 |\n| --- | --- |\n| 금액 | 123,456원 |', output_path: output });
  const parsed = text(await call('parse_document', { file_path: output }));
  assert.match(parsed, /銀行 BANK 2026/);
  assert.match(parsed, /123,456/);
  console.log(JSON.stringify({ passed: true, tools: tools.length, configuredLauncher: entry.args.at(-1), output, bytes: (await fs.stat(output)).size, scope: 'Saved client configuration and MCP protocol, not Claude application UI' }, null, 2));
} finally { await client.close(); }
