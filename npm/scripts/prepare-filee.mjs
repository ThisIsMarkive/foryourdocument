#!/usr/bin/env node
// Fill npm/filee-<platform>/filee with the Filee command-line converter taken from the
// official Filee release archive (MIT, https://github.com/KnifeLemon/Filee).
//
// Nothing is compiled. The archive is pinned by SHA-256, and only the files the CLI loads
// (listed in filee-cli.deps.json) plus the bundled rhwp engine and the licenses are kept.
// The desktop app (Filee.dll, Avalonia UI, Ctrl hotkey, Explorer menu), the 7-Zip engine,
// debug symbols, XML docs and translations are left out.
//
// Usage: node npm/scripts/prepare-filee.mjs <win32-x64|linux-x64|all> [--archive <path>]
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILEE_VERSION = '2.4.0';
const RELEASES = {
  'win32-x64': {
    url: `https://github.com/KnifeLemon/Filee/releases/download/v${FILEE_VERSION}/Filee-${FILEE_VERSION}-win-Portable.zip`,
    sha256: '0ed05b876301f9bea712b948b2a1d032fd451d284a413f39f3b1ca47dee241c8',
    rid: 'win-x64',
    executable: 'filee-cli.exe'
  },
  'linux-x64': {
    url: `https://github.com/KnifeLemon/Filee/releases/download/v${FILEE_VERSION}/Filee-${FILEE_VERSION}-linux-x64.tar.gz`,
    sha256: 'bd62499c837a80216ec4a06bb8cb72ef39600338872a86e1585fb4347106c7b0',
    rid: 'linux-x64',
    executable: 'filee-cli'
  }
};
const KEEP_ALWAYS = ['filee-cli.dll', 'filee-cli.deps.json', 'filee-cli.runtimeconfig.json', 'LICENSE', 'THIRD-PARTY-NOTICES.md'];
const OPTIONAL = ['LICENSE', 'THIRD-PARTY-NOTICES.md'];
const KEEP_FOLDERS = ['engines/rhwp'];

const npmRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = file => new Promise((resolve, reject) => {
  const hash = createHash('sha256');
  fss.createReadStream(file).on('error', reject).on('data', d => hash.update(d)).on('end', () => resolve(hash.digest('hex')));
});

async function download(url, target) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  await fs.writeFile(target, Buffer.from(await response.arrayBuffer()));
}

function extract(archive, destination) {
  fss.mkdirSync(destination, { recursive: true });
  if (archive.endsWith('.zip')) {
    try { execFileSync('unzip', ['-q', archive, '-d', destination], { stdio: 'inherit' }); return; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    execFileSync('tar', ['-xf', archive, '-C', destination], { stdio: 'inherit' }); // bsdtar on Windows reads zip
  } else execFileSync('tar', ['-xzf', archive, '-C', destination], { stdio: 'inherit' });
}

async function findCliRoot(dir, executable) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name === executable) return entry.parentPath ?? entry.path;
  }
  throw new Error(`${executable} not found in the archive.`);
}

function requiredFiles(depsJson, rid) {
  const deps = JSON.parse(depsJson);
  const target = Object.entries(deps.targets).find(([name]) => name.endsWith(`/${rid}`))?.[1]
    ?? Object.values(deps.targets)[0];
  const files = new Set();
  for (const library of Object.values(target)) {
    for (const file of Object.keys(library.runtime ?? {})) files.add(path.posix.basename(file));
    for (const file of Object.keys(library.native ?? {})) files.add(path.posix.basename(file));
    for (const [file, info] of Object.entries(library.runtimeTargets ?? {})) {
      if (!info.rid || info.rid === rid || rid.startsWith(`${info.rid}-`) || info.rid === (rid.startsWith('win') ? 'win' : 'unix')) {
        files.add(path.posix.basename(file));
      }
    }
  }
  return files;
}

async function prepare(platform, archiveArg) {
  const release = RELEASES[platform];
  if (!release) throw new Error(`Unknown platform ${platform}. Use ${Object.keys(RELEASES).join(', ')} or all.`);
  const work = await fs.mkdtemp(path.join(os.tmpdir(), `filee-${platform}-`));
  try {
    const archive = archiveArg ? path.resolve(archiveArg) : path.join(work, path.basename(new URL(release.url).pathname));
    if (!archiveArg) { console.log(`Downloading ${release.url}`); await download(release.url, archive); }
    const actual = await sha256(archive);
    if (actual !== release.sha256) throw new Error(`SHA-256 mismatch for ${archive}: ${actual}`);
    const unpacked = path.join(work, 'unpacked');
    extract(archive, unpacked);
    const cliRoot = await findCliRoot(unpacked, release.executable);
    const keep = requiredFiles(await fs.readFile(path.join(cliRoot, 'filee-cli.deps.json'), 'utf8'), release.rid);
    for (const name of [release.executable, ...KEEP_ALWAYS]) keep.add(name);

    const outRoot = path.join(npmRoot, `filee-${platform}`, 'filee');
    await fs.rm(outRoot, { recursive: true, force: true });
    await fs.mkdir(outRoot, { recursive: true });
    const missing = [];
    let bytes = 0;
    for (const name of [...keep].sort()) {
      const from = path.join(cliRoot, name);
      if (!fss.existsSync(from)) {
        // Debug symbols are optional; the Windows portable archive ships no top-level license files.
        if (!name.endsWith('.pdb') && !OPTIONAL.includes(name)) missing.push(name);
        continue;
      }
      await fs.copyFile(from, path.join(outRoot, name));
      bytes += (await fs.stat(from)).size;
    }
    if (missing.length) throw new Error(`Files listed by filee-cli.deps.json are missing: ${missing.join(', ')}`);
    // Filee's own MIT license, kept in this repository, travels with every platform package.
    await fs.copyFile(path.join(npmRoot, '..', 'plugins/hwpx-bridge/notices/filee-MIT.txt'), path.join(outRoot, 'LICENSE-Filee.txt'));
    for (const folder of KEEP_FOLDERS) {
      await fs.cp(path.join(cliRoot, folder), path.join(outRoot, folder), { recursive: true });
    }
    if (platform !== 'win32-x64') {
      await fs.chmod(path.join(outRoot, release.executable), 0o755);
      const rhwp = path.join(outRoot, 'engines/rhwp/rhwp');
      if (fss.existsSync(rhwp)) await fs.chmod(rhwp, 0o755);
    }
    await fs.writeFile(path.join(outRoot, 'SOURCE.json'), JSON.stringify({
      product: 'Filee', version: FILEE_VERSION, license: 'MIT', homepage: 'https://github.com/KnifeLemon/Filee',
      archive: release.url, sha256: release.sha256, executable: release.executable,
      note: 'Unmodified files from the official release. Only the command-line converter and its dependencies are included.'
    }, null, 2) + '\n');
    console.log(`filee-${platform}: ${keep.size} files (${(bytes / 1e6).toFixed(1)} MB) + ${KEEP_FOLDERS.join(', ')}`);
  } finally {
    await fs.rm(work, { recursive: true, force: true });
  }
}

const [which, ...rest] = process.argv.slice(2);
const archiveArg = rest.includes('--archive') ? rest[rest.indexOf('--archive') + 1] : undefined;
if (!which) { console.error('Usage: prepare-filee.mjs <win32-x64|linux-x64|all> [--archive <path>]'); process.exit(2); }
if (which === 'all' && archiveArg) { console.error('--archive needs a single platform.'); process.exit(2); }
for (const platform of which === 'all' ? Object.keys(RELEASES) : [which]) await prepare(platform, archiveArg);
