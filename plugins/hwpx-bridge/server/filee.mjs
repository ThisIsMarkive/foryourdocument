import fs from 'node:fs/promises';
import path from 'node:path';
import { checkPath } from './paths.mjs';
import { runProcess } from './process.mjs';

const inputProperty = { type: 'string', description: 'Absolute path to an existing local input file.' };
const outputProperty = { type: 'string', description: 'Absolute output directory. Existing files are skipped, never overwritten.' };
export const fileeTools = [
  {
    name: 'filee_convert_to_hwpx',
    description: 'Convert an existing DOCX, HWP, text PDF, Markdown or text file to HWPX using the internal converter built from pinned Filee source with unchanged conversion logic. Prefer this for DOCX formatting preservation. For scanned PDFs/images use filee_ocr. Does not rewrite the result with AI or kordoc.',
    inputSchema: { type: 'object', properties: { input_path: inputProperty, output_dir: outputProperty }, required: ['input_path', 'output_dir'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  },
  {
    name: 'filee_ocr',
    description: 'Recognize scanned PDF/image text locally with Filee + Tesseract. Export editable HWPX/DOCX/text/Markdown or a searchable PDF. OCR can misread text and reconstructs layout; it does not guarantee exact scanned-page formatting. Korean, English and traditional/simplified Chinese language data are installed for Korean, English, Hanja and digits.',
    inputSchema: { type: 'object', properties: {
      input_path: inputProperty, output_dir: outputProperty,
      output_format: { type: 'string', enum: ['hwpx', 'docx', 'txt', 'md', 'pdf'], default: 'hwpx' },
      languages: { type: 'string', default: 'kor+eng+chi_tra', description: 'Installed codes: kor, eng, chi_tra, chi_sim; join with +. Default kor+eng+chi_tra covers Korean, English and traditional Hanja. Use chi_sim for simplified characters. Digits need no separate model.' }
    }, required: ['input_path', 'output_dir'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false }
  }
];

export async function callFilee(name, args, { runtime, assets, signal }) {
  const documentRoot = process.env.HWPX_BRIDGE_DOCUMENT_ROOT;
  const input = await checkPath(args.input_path, { documentRoot });
  const output = await checkPath(args.output_dir, { directory: true, create: true, documentRoot });
  const extension = path.extname(input).toLowerCase();
  const ocr = name === 'filee_ocr';
  const supported = ocr ? ['.pdf', '.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'] : ['.docx', '.hwp', '.pdf', '.md', '.txt'];
  if (!supported.includes(extension)) throw new Error(`Unsupported input extension: ${extension}`);
  const target = ocr ? (args.output_format ?? 'hwpx') : 'hwpx';
  if (!['hwpx', 'docx', 'txt', 'md', 'pdf'].includes(target)) throw new Error('Unsupported OCR output format.');
  const languages = args.languages ?? 'kor+eng+chi_tra';
  const available = new Set(assets.languages.map(language => language.code));
  if (ocr && (typeof languages !== 'string' || !/^[a-z_]+(?:\+[a-z_]+)*$/.test(languages) || languages.split('+').some(code => !available.has(code)))) {
    throw new Error('Unknown OCR language. Use installed codes listed by hwpx_runtime_status.');
  }
  const jobs = path.join(runtime, 'jobs');
  await fs.mkdir(jobs, { recursive: true });
  const job = await fs.mkdtemp(path.join(jobs, 'filee-'));
  try {
    await fs.writeFile(path.join(job, 'settings.json'), JSON.stringify({
      engineOwnCopies: { tesseract: path.join(runtime, 'tesseract/tesseract.exe') },
      libreOfficeForHwp: false, libreOfficeForDocuments: false, libreOfficeForSheets: false
    }));
    const engineEnv = { ...process.env, FILEE_DATA_DIR: job, TESSDATA_PREFIX: path.join(runtime, 'tesseract/tessdata') };
    let engineInput = input;
    if (ocr && extension !== '.pdf' && target !== 'pdf') {
      // Filee 2.4.0's small-image OCR path can nest the text layer in a PDF form
      // that its editable-document reader misses. Its PDF OCR path reads it.
      // Keep this adaptation entirely inside Filee; DOCX conversion is untouched.
      const prepared = await runProcess(path.join(runtime, assets.filee.executable),
        ['convert', input, '--to', 'pdf', '-o', path.join(job, 'input-pdf'), '--json'], { env: engineEnv, signal });
      if (prepared.code !== 0) throw new Error(`Filee image-to-PDF preparation failed: ${prepared.stderr.slice(-3000)}`);
      const preparedResult = JSON.parse(prepared.stdout);
      engineInput = preparedResult.files?.[0]?.outputs?.[0];
      if (!engineInput) throw new Error('Filee produced no intermediate PDF for OCR.');
    }
    const options = ['convert', engineInput];
    if (ocr) {
      // Filee deliberately ignores TESSDATA_PREFIX for language discovery. Seed its
      // own pinned component layout from our verified portable data, per job.
      for (const code of new Set(languages.split('+'))) {
        const language = assets.languages.find(item => item.code === code);
        const folder = path.join(job, 'engines/ocr-languages', code);
        await fs.mkdir(folder, { recursive: true });
        await fs.copyFile(path.join(runtime, 'tesseract/tessdata', `${code}.traineddata`), path.join(folder, `${code}.traineddata`));
        await fs.writeFile(path.join(folder, '.filee-component'), language.sha256);
      }
      await fs.writeFile(path.join(job, 'presets.json'), JSON.stringify([{
        id: 'bridge-ocr', name: 'HWPX Bridge OCR', targetFormat: target,
        pdf: { ocr: true, ocrLanguage: languages }
      }]));
      options.push('--preset', 'bridge-ocr');
    } else options.push('--to', target);
    options.push('-o', output, '--skip', '--json');
    const result = await runProcess(path.join(runtime, assets.filee.executable), options, {
      env: engineEnv, signal
    });
    let parsed;
    try { parsed = JSON.parse(result.stdout.replace(/^\uFEFF/, '')); }
    catch { throw new Error(`Filee returned no valid JSON (exit ${result.code}): ${result.stderr.slice(-4000)}`); }
    if (engineInput !== input) {
      parsed.pipeline = 'Filee image-to-PDF, then Filee OCR-to-document';
      for (const file of parsed.files ?? []) file.source = input;
    }
    return {
      isError: result.code !== 0 || parsed.failed > 0,
      content: [{ type: 'text', text: JSON.stringify({ engine: `Filee ${assets.filee.version} (source-built inside HWPX Bridge)`, ...parsed }, null, 2) }]
    };
  } finally {
    // mkdtemp created this private configuration directory, never a caller-supplied path.
    await fs.rm(job, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
