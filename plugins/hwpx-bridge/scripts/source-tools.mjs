import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export async function fileHash(file, algorithm = 'sha256') {
  const hash = createHash(algorithm);
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function listFiles(root) {
  const files = [];
  async function visit(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Linked source/build entry is not allowed: ${file}`);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(path.relative(root, file).replaceAll('\\', '/'));
    }
  }
  await visit(root);
  return files.sort();
}
export async function fingerprint(plugin) {
  const files = [];
  for (const dir of ['runtime', 'scripts', 'server']) {
    for (const file of await listFiles(path.join(plugin, dir))) files.push(`${dir}/${file}`);
  }
  const records = [];
  for (const file of files.sort()) records.push(`${file}:${await fileHash(path.join(plugin, file))}`);
  return createHash('sha256').update(records.join('\n')).digest('hex');
}
export async function verifySources(plugin) {
  const lock = JSON.parse(await fs.readFile(path.join(plugin, 'runtime/source-lock.json'), 'utf8'));
  for (const source of lock.sources) {
    const root = path.join(plugin, 'vendor', source.name);
    const expected = source.files.map(item => item.path).sort();
    const actual = await listFiles(root);
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`Source snapshot file list changed: ${source.name}`);
    for (const record of source.files) {
      const file = path.resolve(root, record.path);
      if (!file.startsWith(root + path.sep) || await fileHash(file) !== record.sha256) throw new Error(`Source checksum mismatch: ${source.name}/${record.path}`);
    }
  }
  return lock;
}

export async function engineFingerprint(plugin) {
  const assets = JSON.parse(await fs.readFile(path.join(plugin, 'runtime/assets.json'), 'utf8'));
  const files = ['runtime/source-lock.json', 'runtime/package-lock.json', 'server/kordoc-entry.ts', 'scripts/build-engines.mjs', 'scripts/source-tools.mjs'];
  for (const file of await listFiles(path.join(plugin, 'runtime/nuget-locks'))) files.push(`runtime/nuget-locks/${file}`);
  const records = [JSON.stringify({ filee: assets.filee, kordoc: assets.kordocSource, kordocVersion: assets.kordocVersion, dotnet: assets.dotnet, node: assets.node })];
  for (const file of files.sort()) records.push(`${file}:${await fileHash(path.join(plugin, file))}`);
  return createHash('sha256').update(records.join('\n')).digest('hex');
}
