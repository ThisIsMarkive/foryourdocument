import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { connect, home, requireRuntime } from './client.mjs';
import { verifySources } from '../plugins/hwpx-bridge/scripts/source-tools.mjs';
const archive = process.argv[2];
if (!archive) throw new Error('Pass the built .mcpb path.');
const JSZip = requireRuntime('jszip');
const zip = await JSZip.loadAsync(await fs.readFile(archive), { checkCRC32: true });
const directory = await fs.mkdtemp(path.join(home, 'desktop-package-'));
for (const entry of Object.values(zip.files)) {
  const destination = path.resolve(directory, entry.name);
  if (!destination.startsWith(`${directory}${path.sep}`)) throw new Error('Unsafe archive path.');
  if (entry.dir) await fs.mkdir(destination, { recursive: true });
  else { await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, await entry.async('nodebuffer')); }
}
for (const installed of [false, true]) {
  if (!installed) await verifySources(directory);
  const connection = await connect({ pluginRoot: directory, targetHome: installed ? home : path.join(home, 'desktop-empty'), desktop: true });
  try {
    const tools = (await connection.client.listTools()).tools;
    assert.equal(tools.length, installed ? 25 : 2);
    if (installed) {
      const output = path.join(directory, 'desktop-test.hwpx');
      const result = await connection.client.callTool({ name: 'generate_document', arguments: { markdown: '# Desktop 확장 검증\n\n정상 연결 확인', output_path: output } });
      assert.ok(!result.isError, JSON.stringify(result));
      assert.ok((await fs.stat(output)).size > 0);
    }
  } finally { await connection.close(); }
}
console.log('Built MCPB: clean/bootstrap and installed/full MCP startup passed; HWPX creation passed.');
