// End-to-end test of the packed npm packages, run from a folder where they are installed:
//   npm i <platform>.tgz <hwpx-bridge>.tgz && node e2e.mjs
// Starts the server exactly as an AI app does (`npx hwpx-bridge mcp`) and calls the tools.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sample = path.join(here, 'fixtures/sample.docx');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'hwpx-bridge-e2e-'));
const isWin = process.platform === 'win32';

const client = new Client({ name: 'e2e', version: '0' });
await client.connect(new StdioClientTransport(isWin
  ? { command: 'cmd', args: ['/c', 'npx', 'hwpx-bridge', 'mcp'], stderr: 'inherit' }
  : { command: 'npx', args: ['hwpx-bridge', 'mcp'], stderr: 'inherit' }));
const call = async (name, args) => {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 600_000 });
  const text = result.content?.map(item => item.text ?? '').join('\n') ?? '';
  console.log(`## ${name} ${result.isError ? 'ERROR' : 'ok'}\n${text.slice(0, 400)}\n`);
  return { ...result, text };
};

try {
  const { tools } = await client.listTools();
  const names = tools.map(tool => tool.name);
  for (const name of ['filee_convert', 'parse_document', 'generate_document', 'patch_document', 'fill_form', 'convert_to_hwpx', 'render_document', 'hwpx_bridge_status']) {
    assert.ok(names.includes(name), `missing tool ${name}`);
  }
  assert.equal(tools.length, 24, `expected 24 tools, got ${tools.length}`);

  const status = JSON.parse((await call('hwpx_bridge_status', {})).text);
  assert.equal(status.filee.version, '2.4.0', 'Filee not found');
  assert.equal(status.kordoc.tools, 22);

  const converted = await call('filee_convert', { input_path: sample, output_dir: out });
  assert.ok(!converted.isError);
  const hwpx = path.join(out, 'sample.hwpx');
  assert.ok(fs.statSync(hwpx).size > 1000, 'no HWPX written');

  const skipped = await call('filee_convert', { input_path: sample, output_dir: out });
  assert.equal(JSON.parse(skipped.text).skipped, 1, 'existing output must be skipped, not overwritten');

  const pdf = await call('filee_convert', { input_path: hwpx, output_dir: path.join(out, 'pdf'), to: 'pdf' });
  assert.ok(!pdf.isError && fs.existsSync(path.join(out, 'pdf', 'sample.pdf')));

  assert.ok((await call('filee_convert', { input_path: path.join(here, 'e2e.mjs'), output_dir: out })).isError, 'non-document input must be refused');
  assert.ok((await call('filee_convert', { input_path: 'sample.docx', output_dir: out })).isError, 'relative path must be refused');

  const parsed = await call('parse_document', { file_path: hwpx });
  assert.ok(!parsed.isError && parsed.text.includes('제목 수준 1') && parsed.text.includes('**굵게**'), 'kordoc could not read the Filee HWPX');

  const generated = await call('generate_document', { markdown: '# 보고서\n\n본문입니다.\n\n| 구분 | 값 |\n|---|---|\n| A | 1 |\n', output_path: path.join(out, 'new.hwpx') });
  assert.ok(!generated.isError && fs.existsSync(path.join(out, 'new.hwpx')));
  console.log('E2E PASSED');
} finally {
  await client.close().catch(() => {});
  fs.rmSync(out, { recursive: true, force: true });
}
