import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { verifySources } from '../plugins/hwpx-bridge/scripts/source-tools.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = path.join(repo, 'plugins/hwpx-bridge');
const read = async file => JSON.parse(await fs.readFile(path.join(repo, file), 'utf8'));
const portable = await read('plugins/hwpx-bridge/plugin.json');
const codex = await read('.agents/plugins/marketplace.json');
const claude = await read('.claude-plugin/marketplace.json');
const cm = await read('plugins/hwpx-bridge/.claude-plugin/plugin.json');
assert.equal(codex.name, claude.name);
assert.equal(portable.name, cm.name);
assert.equal(portable.version, cm.version);
assert.equal(codex.plugins[0].source.path, claude.plugins[0].source);
assert.equal(path.resolve(repo, claude.plugins[0].source), plugin);
const assets = await read('plugins/hwpx-bridge/runtime/assets.json');
const lock = await read('plugins/hwpx-bridge/runtime/package-lock.json');
assert.equal(lock.packages['node_modules/kordoc'], undefined, 'Do not download the upstream kordoc package.');
const sources = await verifySources(plugin);
assert.equal(sources.sources.find(s => s.name === 'kordoc').version, assets.kordocVersion);
assert.equal(sources.sources.find(s => s.name === 'filee').commit, assets.filee.commit);
assert.equal(assets.filee.url, undefined, 'Do not download the original Filee release during setup.');
assert.equal(assets.models.length, 10);
assert.deepEqual(assets.languages.map(item => item.code).sort(), ['chi_sim', 'chi_tra', 'eng', 'kor']);
assert.equal(portable.version, assets.bundleVersion);
assert.equal(lock.version, assets.bundleVersion);
assert.equal(lock.packages[''].version, assets.bundleVersion);
for (const asset of [assets.node, assets.sevenzip, assets.rhwp, assets.vcruntime, assets.tesseract, ...assets.models, ...assets.languages]) {
  assert.match(asset.sha256, /^[a-f0-9]{64}$/i);
  assert.ok(asset.url.startsWith('https://'));
}
assert.match(assets.dotnet.sha512, /^[a-f0-9]{128}$/i);
assert.ok(assets.dotnet.url.startsWith('https://builds.dotnet.microsoft.com/'));
for (const [name, entry] of Object.entries(lock.packages)) {
  if (name) { assert.ok(entry.integrity, `Missing integrity: ${name}`); assert.ok(entry.resolved?.startsWith('https://registry.npmjs.org/')); }
}
for (const config of ['mcp.json', '.mcp.json', 'codex.mcp.json']) {
  const value = await read(`plugins/hwpx-bridge/${config}`);
  const server = value.mcpServers['hwpx-bridge'];
  assert.equal(server.type, 'stdio'); assert.equal(server.command, 'powershell.exe');
  assert.ok(server.args.includes('-File'));
  const script = server.args.at(-1).replace(/\$\{(?:CLAUDE_)?PLUGIN_ROOT\}/, plugin);
  await fs.access(script);
}
for (const name of ['hwpx', 'setup']) {
  const skill = await fs.readFile(path.join(plugin, `skills/${name}/SKILL.md`), 'utf8');
  assert.match(skill, /^---\r?\nname: .+\r?\ndescription: .+\r?\n---/);
}
console.log('Validated source snapshots, marketplace manifests, MCP paths, locked libraries, SDK checksum and all 14 OCR assets.');
