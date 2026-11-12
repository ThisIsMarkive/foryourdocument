// From HWPX Bridge 0.2.x server/paths.mjs (unchanged).
import fs from 'node:fs/promises';
import path from 'node:path';

export function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export async function checkPath(value, { directory = false, create = false, documentRoot } = {}) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\0*?]/.test(value)) {
    throw new Error('Use an absolute local file/directory path without wildcards.');
  }
  // Avoid UNC/network paths so the local-only tools cannot send file data to a share.
  if (/^\\\\|^\/\//.test(value) || /^\\\?\//.test(value)) throw new Error('Network and device paths are not supported.');
  let resolved = path.resolve(value);
  let ancestor = resolved;
  const missing = [];
  while (true) {
    try { ancestor = await fs.realpath(ancestor); break; }
    catch (error) {
      if (error.code !== 'ENOENT' || !create) throw error;
      missing.unshift(path.basename(ancestor));
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }
  resolved = path.join(ancestor, ...missing);
  if (documentRoot && !inside(await fs.realpath(documentRoot), resolved)) throw new Error('Path is outside HWPX_BRIDGE_DOCUMENT_ROOT.');
  if (create) await fs.mkdir(resolved, { recursive: true });
  const stat = await fs.stat(resolved);
  if (directory ? !stat.isDirectory() : !stat.isFile()) throw new Error(directory ? 'Expected a directory.' : 'Expected a regular file.');
  return resolved;
}
