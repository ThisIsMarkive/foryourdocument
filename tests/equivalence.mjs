import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { connect, home, runtime, requireRuntime } from './client.mjs';
import { runProcess } from '../plugins/hwpx-bridge/server/process.mjs';
const JSZip = requireRuntime('jszip');
const files = process.argv.slice(2).map(file => path.resolve(file));
if (!files.length) throw new Error('Pass one or more DOCX fixtures.');
const directory = await fs.mkdtemp(path.join(home, 'equivalence-'));
const connection = await connect();
const results = [];
const referenceFilee = process.env.HWPX_BRIDGE_REFERENCE_FILEE;
if (!referenceFilee || !path.isAbsolute(referenceFilee)) throw new Error('Set HWPX_BRIDGE_REFERENCE_FILEE to the original Filee 2.4.0 CLI.');
const hash = data => createHash('sha256').update(data).digest('hex');
async function entries(file) {
  const result = {};
  const zip = await JSZip.loadAsync(await fs.readFile(file));
  for (const [name, entry] of Object.entries(zip.files)) if (!entry.dir) result[name] = hash(await entry.async('nodebuffer'));
  return result;
}
try {
  for (const [i, file] of files.entries()) {
    const sourceHash = hash(await fs.readFile(file));
    const result = await connection.client.callTool({ name: 'filee_convert_to_hwpx', arguments: { input_path: file, output_dir: path.join(directory, `${i}-bridge`) } }, undefined, { timeout: 300000 });
    assert.ok(!result.isError, JSON.stringify(result));
    const bridge = JSON.parse(result.content[0].text).files[0].outputs[0];
    const directResult = await runProcess(referenceFilee, ['convert', file, '--to', 'hwpx', '-o', path.join(directory, `${i}-direct`), '--skip', '--json'], { env: { ...process.env, FILEE_DATA_DIR: path.join(directory, 'config') } });
    assert.equal(directResult.code, 0, directResult.stderr);
    const direct = JSON.parse(directResult.stdout).files[0].outputs[0];
    const bridgeEntries = await entries(bridge);
    assert.deepEqual(bridgeEntries, await entries(direct));
    assert.equal(hash(await fs.readFile(file)), sourceHash);
    results.push({ fixture: path.basename(file), sourceUnchanged: true, identicalMembers: Object.keys(bridgeEntries).length, passed: true });
  }
  await fs.writeFile(path.join(home, 'equivalence-result.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await connection.close(); }
