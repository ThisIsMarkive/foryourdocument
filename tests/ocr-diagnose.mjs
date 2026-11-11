import fs from 'node:fs/promises';
import path from 'node:path';
import { connect, home, runtime, assets } from './client.mjs';
import { runProcess } from '../plugins/hwpx-bridge/server/process.mjs';
const result = JSON.parse(await fs.readFile(path.join(home, 'integration-result.json'), 'utf8'));
const dir = result.testDir;
const connection = await connect();
try {
  const text = r => r.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
  for (const format of ['txt', 'pdf']) {
    const r = await connection.client.callTool({ name: 'filee_ocr', arguments: { input_path: path.join(dir, 'scan.png'), output_dir: path.join(dir, `ocr-${format}`), output_format: format } }, undefined, { timeout: 300000 });
    console.log(format, text(r));
    if (!r.isError) { const file = JSON.parse(text(r)).files[0].outputs[0]; if (format === 'txt') console.log(await fs.readFile(file, 'utf8')); else console.log(text(await connection.client.callTool({ name: 'parse_document', arguments: { file_path: file } }))); }
  }
  const o = await runProcess(path.join(runtime, assets.filee.executable), ['convert', path.join(dir, 'scan.png'), '--to', 'pdf', '-o', path.join(dir, 'scan-pdf'), '--json'], { env: { ...process.env, FILEE_DATA_DIR: path.join(dir, 'diag-config') } });
  console.log('image-to-pdf', o.stdout, o.stderr.slice(-2000));
  const pdf = JSON.parse(o.stdout).files[0].outputs[0];
  const r = await connection.client.callTool({ name: 'filee_ocr', arguments: { input_path: pdf, output_dir: path.join(dir, 'pdf-ocr'), output_format: 'hwpx' } }, undefined, { timeout: 300000 });
  console.log('pdf-ocr', text(r));
  if (!r.isError) console.log('parsed', text(await connection.client.callTool({ name: 'parse_document', arguments: { file_path: JSON.parse(text(r)).files[0].outputs[0] } })));
  console.log('kordoc-image', text(await connection.client.callTool({ name: 'parse_document', arguments: { file_path: path.join(dir, 'scan.png'), ocr: true, ocr_rec: 'printed' } }, undefined, { timeout: 300000 })));
} finally { await connection.close(); console.error(connection.stderr()); }
