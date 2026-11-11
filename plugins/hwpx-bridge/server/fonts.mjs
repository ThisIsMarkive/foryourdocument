import fs from 'node:fs/promises';
import path from 'node:path';

export async function ensureFontConfig(runtime) {
  const cache = path.join(runtime, 'font-cache');
  await fs.mkdir(cache, { recursive: true });
  const xml = value => value.replaceAll('\\', '/').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const folders = [path.join(process.env.SystemRoot, 'Fonts')];
  if (process.env.LOCALAPPDATA) folders.push(path.join(process.env.LOCALAPPDATA, 'Microsoft/Windows/Fonts'));
  const content = `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd"><fontconfig>${folders.map(folder => `<dir>${xml(folder)}</dir>`).join('')}<cachedir>${xml(cache)}</cachedir></fontconfig>`;
  const file = path.join(runtime, 'fonts.conf');
  await fs.writeFile(file, content);
  return file.replaceAll('\\', '/');
}
