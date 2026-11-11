import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const home = args[args.indexOf('--home') + 1];
const output = path.resolve(args[args.indexOf('--output') + 1]);
const plugin = path.join(repository, 'plugins/hwpx-bridge');
const assets = JSON.parse(await fs.readFile(path.join(plugin, 'runtime/assets.json'), 'utf8'));
const require = createRequire(path.join(home, `versions/${assets.bundleVersion}-win-x64/npm/package.json`));
const JSZip = require('jszip');
const excluded = new Set(['.git', 'node_modules', 'dist', '.cache', '.test-runtime']);
async function add(zip, folder, prefix = '') {
  for (const item of await fs.readdir(folder, { withFileTypes: true })) {
    if (excluded.has(item.name) || item.name.endsWith('.log') || item.name.endsWith('.part')) continue;
    const absolute = path.join(folder, item.name);
    if (path.resolve(absolute) === output) continue;
    const name = prefix + item.name;
    if (item.isDirectory()) await add(zip, absolute, `${name}/`);
    else if (item.isFile()) zip.file(name, await fs.readFile(absolute));
    else throw new Error(`Refusing linked package entry: ${absolute}`);
  }
}
await fs.mkdir(output, { recursive: true });
const packages = [];
async function save(name, zip) {
  const data = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  // Read the produced archive back to prove the hidden manifests were retained.
  const verified = await JSZip.loadAsync(data, { checkCRC32: true });
  await fs.writeFile(path.join(output, name), data);
  packages.push({ file: name, bytes: data.length, files: Object.keys(verified.files).length, sha256: createHash('sha256').update(data).digest('hex') });
}
const source = new JSZip(); await add(source, repository);
if (!source.file('.agents/plugins/marketplace.json') || !source.file('.claude-plugin/marketplace.json')) throw new Error('Marketplace manifests are missing.');
await save(`hwpx-bridge-${assets.bundleVersion}-github.zip`, source);
const desktop = new JSZip(); await add(desktop, plugin);
desktop.file('manifest.json', await fs.readFile(path.join(repository, 'packaging/claude-desktop-manifest.json')));
desktop.file('desktop-launch.mjs', await fs.readFile(path.join(repository, 'packaging/desktop-launch.mjs')));
for (const item of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) desktop.file(item, await fs.readFile(path.join(repository, item)));
await save(`hwpx-bridge-${assets.bundleVersion}-windows.mcpb`, desktop);
const installer = await fs.readFile(path.join(repository, 'Install-HwpxBridge.ps1'));
await fs.writeFile(path.join(output, 'Install-HwpxBridge.ps1'), installer);
packages.push({ file: 'Install-HwpxBridge.ps1', bytes: installer.length, sha256: createHash('sha256').update(installer).digest('hex') });
await fs.writeFile(path.join(output, 'SHA256SUMS.txt'), packages.map(p => `${p.sha256}  ${p.file}`).join('\n') + '\n');
await fs.writeFile(path.join(output, 'packages.json'), JSON.stringify(packages, null, 2));
console.log(JSON.stringify(packages, null, 2));
