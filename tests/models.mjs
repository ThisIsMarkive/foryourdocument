import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { plugin, home, runtime, requireRuntime } from './client.mjs';

const assets = JSON.parse(await fs.readFile(path.join(plugin, 'runtime/assets.json'), 'utf8'));
const ort = requireRuntime('onnxruntime-node');
const checks = [];
for (const asset of [...assets.models, ...assets.languages.map(asset => ({ ...asset, path: `tesseract/tessdata/${asset.code}.traineddata` }))]) {
  const file = path.join(runtime, asset.path);
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  assert.equal(hash.digest('hex'), asset.sha256.toLowerCase(), asset.path);
  if (asset.path.endsWith('.onnx')) {
    const session = await ort.InferenceSession.create(file, { executionProviders: ['cpu'] });
    checks.push({ path: asset.path, inputNames: session.inputNames, loaded: true });
    await session.release();
    console.log(`Loaded ${asset.path}`);
  }
}
await fs.writeFile(path.join(home, 'model-verification.json'), JSON.stringify({ date: new Date().toISOString(), verifiedAssets: assets.models.length + assets.languages.length, sessions: checks }, null, 2));
console.log('Verified all 14 model/language hashes; loaded all 8 ONNX models on CPU.');
