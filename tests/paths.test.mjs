import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkPath } from '../plugins/hwpx-bridge/server/paths.mjs';

test('paths enforce absolute files and output containment', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'hwpx-paths-'));
  try {
    const documents = path.join(temp, 'documents');
    const outside = path.join(temp, 'outside');
    await fs.mkdir(documents); await fs.mkdir(outside);
    const input = path.join(documents, '한글 문서.docx');
    await fs.writeFile(input, 'fixture');
    assert.equal(await checkPath(input, { documentRoot: documents }), await fs.realpath(input));
    await assert.rejects(checkPath('relative.docx'), /absolute/);
    await assert.rejects(checkPath(path.join(documents, '*.docx')), /wildcards/);
    await assert.rejects(checkPath('\\\\server\\share\\secret.docx'), /Network/);
    await assert.rejects(checkPath(path.join(documents, '../outside/new'), { directory: true, create: true, documentRoot: documents }), /outside/);
    const output = await checkPath(path.join(documents, 'new/output'), { directory: true, create: true, documentRoot: documents });
    assert.ok((await fs.stat(output)).isDirectory());
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test('junctions cannot escape the document root', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'hwpx-junction-'));
  try {
    const documents = path.join(temp, 'documents');
    const outside = path.join(temp, 'outside');
    await fs.mkdir(documents); await fs.mkdir(outside);
    try { await fs.symlink(outside, path.join(documents, 'linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (['ENOENT', 'EPERM', 'ENOTSUP', 'EINVAL'].includes(error.code)) { t.skip(`Host cannot create test junction: ${error.code}`); return; }
      throw error;
    }
    await assert.rejects(checkPath(path.join(documents, 'linked/new'), { directory: true, create: true, documentRoot: documents }), /outside/);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
