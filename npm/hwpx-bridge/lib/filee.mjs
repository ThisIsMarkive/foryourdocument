// Filee document conversion. The converter is the unmodified Filee command-line program from the
// official release, shipped in the platform package hwpx-bridge-filee-<platform>-<arch>.
import fs from 'node:fs/promises';
import fss from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { checkPath } from './paths.mjs';
import { runProcess } from './process.mjs';
import { INPUT_EXTENSIONS, OUTPUT_FORMATS } from './formats.mjs';

const require = createRequire(import.meta.url);
const PLATFORM_PACKAGE = `hwpx-bridge-filee-${process.platform}-${process.arch}`;

/** Locate the bundled Filee CLI, or return null with the reason. */
export function locateFilee() {
  if (process.env.HWPX_BRIDGE_FILEE) {
    const cli = path.resolve(process.env.HWPX_BRIDGE_FILEE);
    return fss.existsSync(cli) ? { cli, source: 'HWPX_BRIDGE_FILEE' } : { error: `HWPX_BRIDGE_FILEE does not exist: ${cli}` };
  }
  let root;
  try { root = path.dirname(require.resolve(`${PLATFORM_PACKAGE}/package.json`)); }
  catch {
    return { error: `Filee is not available for ${process.platform}-${process.arch}. Supported: Windows x64, Linux x64. kordoc tools still work.` };
  }
  const cli = path.join(root, 'filee', process.platform === 'win32' ? 'filee-cli.exe' : 'filee-cli');
  if (!fss.existsSync(cli)) return { error: `${PLATFORM_PACKAGE} is installed but ${cli} is missing.` };
  let source = {};
  try { source = JSON.parse(fss.readFileSync(path.join(root, 'filee', 'SOURCE.json'), 'utf8')); } catch { /* optional */ }
  return { cli, source: PLATFORM_PACKAGE, version: source.version };
}

export const fileeTool = {
  name: 'filee_convert',
  title: 'Filee document conversion',
  description: [
    'Convert a document file to another document format with Filee (local, no upload).',
    'Best choice for DOCX -> HWPX: keeps fonts, sizes, colors, bold/italic/underline, alignment, indentation,',
    'line spacing, lists, headers/footers, page numbers, page margins, page breaks, table shading and images.',
    'Also converts HWP/HWPX/DOCX/PPTX/XLSX/PDF/Markdown/HTML/images between each other (e.g. HWPX -> PDF or DOCX,',
    'PDF -> DOCX, DOCX -> PDF, image -> PDF).',
    'To read a document use parse_document; to write a new HWPX from text use generate_document; for scans/OCR',
    'use parse_document OCR options. Existing output files are never overwritten (they are skipped).'
  ].join(' '),
  inputSchema: {
    type: 'object',
    properties: {
      input_path: { type: 'string', description: 'Absolute path of an existing local input file.' },
      output_dir: { type: 'string', description: 'Absolute output directory (created if missing). The output keeps the input file name with the new extension.' },
      to: { type: 'string', enum: OUTPUT_FORMATS, default: 'hwpx', description: 'Target format. Default hwpx.' }
    },
    required: ['input_path', 'output_dir'],
    additionalProperties: false
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
};

export async function callFilee(args, { signal } = {}) {
  const located = locateFilee();
  if (located.error) throw new Error(located.error);
  const documentRoot = process.env.HWPX_BRIDGE_DOCUMENT_ROOT || process.env.KORDOC_ROOT;
  const input = await checkPath(args?.input_path, { documentRoot });
  const output = await checkPath(args?.output_dir, { directory: true, create: true, documentRoot });
  const extension = path.extname(input).slice(1).toLowerCase();
  if (!INPUT_EXTENSIONS.has(extension)) throw new Error(`Unsupported input type .${extension}. Only document, office, HWP, PDF, text and image files are accepted.`);
  const target = args?.to ?? 'hwpx';
  if (!OUTPUT_FORMATS.includes(target)) throw new Error(`Unsupported target format ${target}. Use one of: ${OUTPUT_FORMATS.join(', ')}.`);

  // A private Filee data folder per job: no user settings are read or written, and the optional
  // downloadable engines (LibreOffice, Pandoc, Ghostscript, FFmpeg, Tesseract ...) are never used.
  const job = await fs.mkdtemp(path.join(os.tmpdir(), 'hwpx-bridge-filee-'));
  try {
    await fs.writeFile(path.join(job, 'settings.json'), JSON.stringify({
      libreOfficeForHwp: false, libreOfficeForDocuments: false, libreOfficeForSheets: false
    }));
    const result = await runProcess(located.cli, ['convert', input, '--to', target, '-o', output, '--skip', '--json'], {
      env: { ...process.env, FILEE_DATA_DIR: job, DOTNET_CLI_TELEMETRY_OPTOUT: '1' }, signal
    });
    // --json prints progress events as JSON lines, then the summary object.
    const text = result.stdout.replace(/^﻿/, '');
    const start = text.search(/^\{\s*$/m);
    let summary;
    try { summary = JSON.parse(start >= 0 ? text.slice(start) : text); }
    catch { throw new Error(`Filee returned no result (exit ${result.code}). ${result.stderr.slice(-4000) || text.slice(-4000)}`); }
    const failed = result.code !== 0 || summary.failed > 0 || summary.converted + summary.skipped === 0;
    return {
      isError: failed,
      content: [{ type: 'text', text: JSON.stringify({ engine: `Filee ${located.version ?? ''}`.trim(), ...summary }, null, 2) }]
    };
  } finally {
    await fs.rm(job, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
