import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inside } from '../plugins/hwpx-bridge/server/paths.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = key => args[args.indexOf(key) + 1];
if (!args.includes('--home') || !args.includes('--destination')) throw new Error('Use --home and --destination with absolute directories.');
const home = path.resolve(value('--home'));
if (!path.isAbsolute(value('--destination'))) throw new Error('Destination must be an absolute path.');
const destination = path.resolve(value('--destination'));
const assets = JSON.parse(await fs.readFile(path.join(repository, 'plugins/hwpx-bridge/runtime/assets.json'), 'utf8'));
const runtimeName = `${assets.bundleVersion}-win-x64`;
const runtime = path.join(home, 'versions', runtimeName);
await fs.access(path.join(runtime, 'ready.json'));
if (inside(home, destination) || inside(repository, destination)) throw new Error('Export outside the runtime and repository to prevent recursive copying.');
await fs.mkdir(destination); // Never overwrite an existing export.
const marketplace = path.join(destination, 'marketplace');
await fs.mkdir(marketplace);
for (const item of ['.agents', '.claude-plugin', '.github', '.gitattributes', '.gitignore', 'plugins', 'scripts', 'packaging', 'tests', 'docs', 'README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'Install-HwpxBridge.ps1', 'Setup.cmd']) {
  await fs.cp(path.join(repository, item), path.join(marketplace, item), { recursive: true, errorOnExist: true });
}
const outputRuntime = path.join(destination, 'runtime', runtimeName);
await fs.mkdir(outputRuntime, { recursive: true });
// Deliberately omit jobs, conversion files, caches, logs, user paths and client credentials.
for (const item of ['node', 'npm', 'filee', 'sevenzip', 'tesseract', 'models', 'ready.json', 'build-receipt.json']) {
  console.log(`Copying ${item}...`);
  await fs.cp(path.join(runtime, item), path.join(outputRuntime, item), { recursive: true, errorOnExist: true });
}
await fs.copyFile(path.join(repository, 'scripts/Import-Offline.ps1'), path.join(destination, 'Import-Offline.ps1'));
await fs.writeFile(path.join(destination, 'README.txt'), 'Windows x64 offline bundle. Run PowerShell -NoProfile -ExecutionPolicy Bypass -File .\\Import-Offline.ps1\r\nThen register the printed local marketplace path in Codex/Claude. No Node.js install or network download is needed.\r\n');
const records = [];
async function inventory(directory) {
  for (const item of await fs.readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, item.name);
    if (item.isDirectory()) await inventory(absolute);
    else if (item.isFile()) {
      const h = createHash('sha256');
      for await (const chunk of createReadStream(absolute)) h.update(chunk);
      records.push({ path: path.relative(destination, absolute).replaceAll('\\', '/'), sha256: h.digest('hex'), bytes: (await fs.stat(absolute)).size });
      if (records.length % 1000 === 0) console.log(`Hashed ${records.length} files...`);
    } else throw new Error(`Unsupported linked file in export: ${absolute}`);
  }
}
await inventory(destination);
await fs.writeFile(path.join(destination, 'offline-manifest.json'), JSON.stringify({ version: assets.bundleVersion, platform: 'win32-x64', runtimeName, files: records }, null, 2));
console.log(`Offline bundle: ${destination}\nVerified file inventory: ${records.length}\nTotal bytes: ${records.reduce((n, item) => n + item.bytes, 0)}`);
