import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { buildEngines } from './build-engines.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const home = path.resolve(args[args.indexOf('--home') + 1]);
const fingerprint = args[args.indexOf('--fingerprint') + 1];
const assets = JSON.parse(await fs.readFile(path.join(root, 'runtime/assets.json'), 'utf8'));
const runtime = path.join(home, 'versions', `${assets.bundleVersion}-win-x64`);
const cache = path.join(home, 'downloads');
const log = message => process.stderr.write(`${message}\n`);
async function json(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2));
  await fs.rename(temp, file);
}
let statusQueue = Promise.resolve();
function status(message, state = 'installing') {
  log(message);
  statusQueue = statusQueue.then(() => json(path.join(home, 'setup-status.json'), {
    state, message, pid: process.pid, version: assets.bundleVersion, updatedAt: new Date().toISOString()
  }));
  return statusQueue;
}
async function hash(file, algorithm = 'sha256') {
  const h = createHash(algorithm);
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest('hex');
}
async function valid(file, sha, algorithm = 'sha256') {
  try { return (await hash(file, algorithm)) === sha.toLowerCase(); } catch { return false; }
}
async function download(asset) {
  const checksum = asset.sha256 || asset.sha512;
  const algorithm = asset.sha256 ? 'sha256' : 'sha512';
  if (!/^https:\/\//.test(asset.url) || !(algorithm === 'sha256' ? /^[a-f0-9]{64}$/i : /^[a-f0-9]{128}$/i).test(checksum)) throw new Error(`Invalid locked asset: ${asset.id || asset.url}`);
  const target = path.join(cache, `${checksum.toLowerCase()}${path.extname(new URL(asset.url).pathname) || '.bin'}`);
  if (await valid(target, checksum, algorithm)) return target;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(asset.url, { signal: AbortSignal.timeout(900_000), headers: { 'User-Agent': `hwpx-bridge/${assets.bundleVersion}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${new URL(asset.url).hostname}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(`${target}.part`));
      if (!await valid(`${target}.part`, checksum, algorithm)) throw new Error(`${algorithm} mismatch: ${asset.id || asset.url}`);
      await fs.rename(`${target}.part`, target);
      return target;
    } catch (error) {
      if (attempt === 3) throw error;
      log(`Retry ${attempt}: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
    }
  }
}
async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, shell: false, ...options });
    let out = ''; let err = '';
    child.stdout.on('data', b => { out += b; });
    child.stderr.on('data', b => { err += b; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(`${path.basename(command)} exited ${code}: ${err.slice(-5000)} ${out.slice(-1500)}`)));
  });
}
async function unzip(archive, target) {
  const require = createRequire(path.join(runtime, 'npm/package.json'));
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(await fs.readFile(archive));
  await fs.mkdir(target, { recursive: true });
  for (const entry of Object.values(zip.files)) {
    const destination = path.resolve(target, entry.name);
    if (!destination.startsWith(`${target}${path.sep}`)) throw new Error('Archive entry escapes destination');
    if (entry.dir) { await fs.mkdir(destination, { recursive: true }); continue; }
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await pipeline(entry.nodeStream(), createWriteStream(destination));
  }
}
async function pool(items, concurrency, fn) {
  let index = 0;
  const results = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
    while (index < items.length) await fn(items[index++]);
  }));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) throw failure.reason;
}
try {
  const buildReceipt = await buildEngines({ plugin: root, home, runtime, assets, download, unzip, status });
  await status('Preparing standalone 7-Zip and Tesseract; validating SHA-256.');
  const [sevenzipMsi, tessExe, rhwpArchive, vcArchive] = await Promise.all([download(assets.sevenzip), download(assets.tesseract), download(assets.rhwp), download(assets.vcruntime)]);
  const fileeDir = path.join(runtime, 'filee');
  const rhwpDir = path.join(fileeDir, 'engines/rhwp');
  await unzip(rhwpArchive, rhwpDir);
  for (const entry of await fs.readdir(rhwpDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(rhwpDir, entry.name);
    if (!await fs.access(path.join(nested, 'rhwp.exe')).then(() => true, () => false)) continue;
    for (const item of await fs.readdir(nested)) await fs.cp(path.join(nested, item), path.join(rhwpDir, item), { recursive: true });
    if (!(await fs.realpath(nested)).startsWith((await fs.realpath(rhwpDir)) + path.sep)) throw new Error('rhwp staging escaped its engine directory.');
    await fs.rm(nested, { recursive: true, force: true });
  }
  await fs.access(path.join(rhwpDir, 'rhwp.exe'));
  // Extract the embedded CAB directly; never run MSI actions or modify the registry.
  const requireInstall = createRequire(path.join(runtime, 'npm/package.json'));
  const compound = requireInstall('cfb').read(await fs.readFile(sevenzipMsi), { type: 'buffer' });
  const cabinets = compound.FileIndex.filter(item => item.content?.subarray(0, 4).toString() === 'MSCF');
  if (cabinets.length !== 1) throw new Error('Unexpected pinned 7-Zip MSI cabinet layout.');
  const archiveStage = await fs.mkdtemp(path.join(home, 'sevenzip-'));
  const cabinet = path.join(archiveStage, 'files.cab');
  await fs.writeFile(cabinet, cabinets[0].content);
  const sevenzipDir = path.join(runtime, 'sevenzip');
  await fs.mkdir(sevenzipDir, { recursive: true });
  for (const file of ['_7z.exe', '_7z.dll', 'License.txt', 'readme.txt']) {
    await run(path.join(process.env.SystemRoot, 'System32/expand.exe'), [`-F:${file}`, cabinet, archiveStage]);
    await fs.copyFile(path.join(archiveStage, file), path.join(sevenzipDir, file.replace(/^_/, '')));
  }
  const checkedStage = await fs.realpath(archiveStage);
  if (!checkedStage.startsWith((await fs.realpath(home)) + path.sep)) throw new Error('Archive staging escaped home.');
  await fs.rm(checkedStage, { recursive: true, force: true });
  const sevenzip = path.join(sevenzipDir, '7z.exe');
  // Match Filee's portable package: supply VC runtime DLLs beside native executables.
  // This avoids requiring a separate system-wide VC++ Redistributable installation.
  const vcStage = await fs.mkdtemp(path.join(home, 'vcruntime-'));
  await unzip(vcArchive, vcStage);
  const vcFiles = path.join(vcStage, 'expanded');
  await fs.mkdir(vcFiles);
  for (const file of await fs.readdir(vcStage)) {
    if (!file.endsWith('.tar.zst')) continue;
    await run(sevenzip, ['x', '-y', `-o${vcFiles}`, path.join(vcStage, file)]);
    const tar = path.join(vcFiles, file.slice(0, -4));
    await run(sevenzip, ['x', '-y', `-o${vcFiles}`, tar]);
  }
  for (const file of await fs.readdir(path.join(vcFiles, 'Library/bin'))) {
    if (!file.toLowerCase().endsWith('.dll')) continue;
    for (const target of [fileeDir, rhwpDir]) await fs.copyFile(path.join(vcFiles, 'Library/bin', file), path.join(target, file));
  }
  await fs.cp(path.join(vcFiles, 'info'), path.join(fileeDir, 'notices/vcruntime'), { recursive: true });
  if (!(await fs.realpath(vcStage)).startsWith((await fs.realpath(home)) + path.sep)) throw new Error('VC runtime staging escaped home.');
  await fs.rm(vcStage, { recursive: true, force: true });
  await run(path.join(rhwpDir, 'rhwp.exe'), ['--version']);
  const tessDir = path.join(runtime, 'tesseract');
  await fs.mkdir(tessDir, { recursive: true });
  // Extract the verified NSIS archive; do not execute its installer or change the registry.
  await run(sevenzip, ['x', '-y', `-o${tessDir}`, tessExe]);
  const modelAssets = [...assets.models, ...assets.languages.map(asset => ({ ...asset, path: `tesseract/tessdata/${asset.code}.traineddata` }))];
  let done = 0;
  await pool(modelAssets, 4, async asset => {
    const relative = asset.path;
    const destination = path.resolve(runtime, relative);
    if (!destination.startsWith(`${runtime}${path.sep}`)) throw new Error('Asset path escapes runtime');
    if (!await valid(destination, asset.sha256)) {
      const downloaded = await download(asset);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(downloaded, destination);
    }
    await status(`OCR models and language data: ${++done}/${modelAssets.length} verified (${asset.id || path.basename(relative)}).`);
  });
  await status('Verifying native OCR modules and executable versions.');
  const require = createRequire(path.join(runtime, 'npm/package.json'));
  const ort = require('onnxruntime-node');
  const detector = await ort.InferenceSession.create(path.join(runtime, 'models/ppocr/det.onnx'), { executionProviders: ['cpu'] });
  await detector.release();
  const sharp = require('sharp');
  await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const fileeVersion = await run(path.join(runtime, assets.filee.executable), ['version'], { env: { ...process.env, FILEE_DATA_DIR: path.join(runtime, 'filee-data') } });
  if (!fileeVersion.includes(assets.filee.version)) throw new Error(`Unexpected Filee version: ${fileeVersion}`);
  const tessVersion = await run(path.join(tessDir, 'tesseract.exe'), ['--version']);
  const tessLanguages = await run(path.join(tessDir, 'tesseract.exe'), ['--list-langs', '--tessdata-dir', path.join(tessDir, 'tessdata')]);
  for (const language of assets.languages) {
    const code = language.code;
    if (!tessLanguages.split(/\r?\n/).includes(code)) throw new Error(`Tesseract cannot find language ${code}`);
  }
  await json(path.join(runtime, 'ready.json'), {
    version: assets.bundleVersion, fingerprint, platform: process.platform, arch: process.arch,
    architecture: 'source-integrated', sourceCommits: Object.fromEntries(buildReceipt.sources.map(source => [source.name, source.commit])),
    kordocSourceModules: buildReceipt.kordocSourceModules, dotnetSdk: buildReceipt.dotnetSdk,
    installedAt: new Date().toISOString(), node: process.version, filee: fileeVersion,
    kordoc: assets.kordocVersion, tesseract: tessVersion.split(/\r?\n/)[0],
    models: assets.models.length, languages: assets.languages.length
  });
  await status('Setup complete. Reload the plugin/MCP connection to use all document tools.', 'ready');
} catch (error) {
  await status(`Setup failed: ${error.message}`, 'failed');
  log(error.stack);
  process.exitCode = 1;
}
