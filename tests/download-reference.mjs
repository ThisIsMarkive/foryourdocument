// Independent upstream release for tests only. Never used by the product installer.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = JSON.parse(await fs.readFile(path.join(repo, 'plugins/hwpx-bridge/runtime/assets.json'), 'utf8'));
const reference = JSON.parse(await fs.readFile(path.join(repo, 'tests/filee-reference.json'), 'utf8'));
if (!process.env.HWPX_BRIDGE_HOME) throw new Error('Set HWPX_BRIDGE_HOME to an installed test runtime.');
const require = createRequire(path.join(process.env.HWPX_BRIDGE_HOME, `versions/${assets.bundleVersion}-win-x64/npm/package.json`));
const directory = path.resolve(process.argv[2] || path.join(repo, '.test-reference'));
await fs.mkdir(directory, { recursive: true });
const archive = path.join(directory, `Filee-${reference.version}.zip`);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let bytes = await fs.readFile(archive).catch(() => null);
if (!bytes || digest(bytes) !== reference.sha256) {
  const response = await fetch(reference.url);
  if (!response.ok) throw new Error(`Reference download HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== reference.sha256) throw new Error('Independent reference checksum mismatch.');
  await fs.writeFile(archive, bytes);
}
const zip = await require('jszip').loadAsync(bytes, { checkCRC32: true });
const target = path.join(directory, 'original');
for (const entry of Object.values(zip.files)) {
  const file = path.resolve(target, entry.name);
  if (!file.startsWith(target + path.sep)) throw new Error('Unsafe reference archive.');
  if (entry.dir) await fs.mkdir(file, { recursive: true });
  else { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, await entry.async('nodebuffer')); }
}
console.log(path.join(target, 'filee-cli.exe'));
