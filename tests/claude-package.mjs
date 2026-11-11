import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../plugins/hwpx-bridge/scripts/source-tools.mjs';

// Claude's cloud import checks differ from Claude Code's local validator.
// https://platform.claude.com/docs/en/manage-claude/plugins-api#upload-requirements
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=process.argv[2]?path.resolve(process.argv[2]):path.join(repo,'plugins/hwpx-bridge');
const files=await listFiles(root);
assert.ok(files.length<=5000,'Claude package file count exceeds 5000.');
assert.deepEqual(files.filter(f=>f.endsWith('.claude-plugin/plugin.json')),['.claude-plugin/plugin.json'],'A Claude package must contain exactly one plugin manifest.');
let total=0;
for(const file of files){
 assert.match(file,/^[\p{L}\p{N}_ .\-/(),]+$/u,`Unsupported Claude path character: ${file}`);
 assert.ok(!file.startsWith('bin/'),'Top-level bin/ is not supported.');
 assert.ok(!file.toLowerCase().endsWith('.zip'),`Nested ZIP is not supported: ${file}`);
 const segments=file.split('/');
 assert.ok(segments.length<=12&&file.length<=472&&segments.every(s=>s.length<=255&&s!=='.'&&s!=='..'),`Claude path limit exceeded: ${file}`);
 total+=(await fs.stat(path.join(root,file))).size;
}
assert.ok(total<=200_000_000,'Uncompressed Claude package exceeds 200 MB.');
assert.deepEqual(files.filter(f=>f.endsWith('/SKILL.md')),['skills/hwpx/SKILL.md','skills/setup/SKILL.md'],'Only the bridge skills should be active; upstream skills are archived source data.');
const manifest=JSON.parse(await fs.readFile(path.join(root,'.claude-plugin/plugin.json'),'utf8'));
assert.match(manifest.name,/^[\p{Ll}\p{N}-]{1,64}$/u);
assert.ok((manifest.displayName??'').length<=64&&(manifest.description??'').length<=500);
console.log(`Claude cloud package layout passed: one manifest, two active skills, ${files.length} files, ${total} bytes, supported paths.`);
