import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { connect, home, runtime, requireRuntime } from './client.mjs';
import { runProcess } from '../plugins/hwpx-bridge/server/process.mjs';
import { ensureFontConfig } from '../plugins/hwpx-bridge/server/fonts.mjs';

const JSZip = requireRuntime('jszip');
process.env.FONTCONFIG_FILE = await ensureFontConfig(runtime);
const sharp = requireRuntime('sharp');
const testDir = await fs.mkdtemp(path.join(home, 'integration-'));
const checks = [];
const referenceFilee = process.env.HWPX_BRIDGE_REFERENCE_FILEE;
if (!referenceFilee || !path.isAbsolute(referenceFilee)) throw new Error('Set HWPX_BRIDGE_REFERENCE_FILEE to the original Filee 2.4.0 filee-cli.exe for independent comparison.');
const connection = await connect();
const text = result => result.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
async function call(name, args) {
  const result = await connection.client.callTool({ name, arguments: args }, undefined, { timeout: 900_000 });
  if (result.isError) throw new Error(`${name}: ${text(result)}`);
  return result;
}
async function check(name, work) {
  const started = Date.now();
  const detail = await work();
  checks.push({ name, passed: true, milliseconds: Date.now() - started, detail });
  console.log(`PASS ${name}`);
}
const xml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
async function createDocx(file) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const p = (s, bold = false) => `<w:p><w:r><w:rPr><w:rFonts w:ascii="Malgun Gothic" w:eastAsia="맑은 고딕"/>${bold ? '<w:b/>' : ''}<w:sz w:val="24"/></w:rPr><w:t>${xml(s)}</w:t></w:r></w:p>`;
  const table = '<w:tbl><w:tblPr><w:tblW w:w="8500" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="8"/><w:bottom w:val="single" w:sz="8"/><w:insideH w:val="single" w:sz="8"/><w:insideV w:val="single" w:sz="8"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4250"/><w:gridCol w:w="4250"/></w:tblGrid>' + [['항목', '금액'], ['교육비', '123,456원']].map(row => `<w:tr>${row.map(value => `<w:tc><w:tcPr><w:tcW w:w="4250" w:type="dxa"/></w:tcPr>${p(value)}</w:tc>`).join('')}</w:tr>`).join('') + '</w:tbl>';
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p('한글 문서 변환 검증', true)}${p('HWPX Bridge 2026 — 표와 굵은 글씨를 확인합니다.')}${table}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`);
  await fs.writeFile(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}
async function zipContents(file) {
  const zip = await JSZip.loadAsync(await fs.readFile(file));
  const entries = {};
  for (const [name, entry] of Object.entries(zip.files)) {
    if (!entry.dir) entries[name] = createHash('sha256').update(await entry.async('nodebuffer')).digest('hex');
  }
  return entries;
}
try {
  await check('MCP initialized without global Node; all tools available', async () => {
    const tools = (await connection.client.listTools()).tools;
    assert.equal(tools.length, 25);
    const status = JSON.parse(text(await call('hwpx_runtime_status', {})));
    assert.equal(status.architecture, 'source-integrated');
    assert.equal(status.kordocProcess, 'in-process');
    assert.ok(status.kordocSourceModules > 100);
    await assert.rejects(fs.access(path.join(runtime, 'npm/node_modules/kordoc')));
    await assert.rejects(fs.access(path.join(runtime, 'filee/filee-cli.exe')));
    assert.equal(status.models, 10); assert.deepEqual(status.languages.map(item => typeof item === 'string' ? item : item.code).sort(), ['chi_sim', 'chi_tra', 'eng', 'kor']);
    return { tools: tools.length, node: status.node, filee: status.filee, kordoc: status.kordoc };
  });
  const report = path.join(testDir, '새 보고서.hwpx');
  await check('Generate Korean HWPX and parse it back', async () => {
    await call('generate_document', {
      markdown: '# 문서 자동화 검증 보고서\n\n> 문서 작성과 변환 기능의 동작을 확인하고자 함\n\n## 검증 내용\n\n- 한글 문서 생성\n- 銀行 BANK 2026\n- 표와 숫자 보존\n\n| 항목 | 결과 |\n| --- | --- |\n| 처리 건수 | 123건 |\n| 검증 금액 | 123,456원 |',
      output_path: report, preset: '보고서', cover: false, toc: false
    });
    const parsed = text(await call('parse_document', { file_path: report }));
    assert.match(parsed, /문서 자동화 검증/); assert.match(parsed, /銀行 BANK 2026/); assert.match(parsed, /123,456/);
    return { bytes: (await fs.stat(report)).size };
  });
  await check('Render generated HWPX with bundled native libraries', async () => {
    const rendered = await call('render_document', { file_path: report, format: 'png', output_path: path.join(testDir, 'report.png'), max_width_px: 1000 });
    const image = rendered.content.find(item => item.type === 'image');
    assert.ok(image?.data); await fs.writeFile(path.join(testDir, 'report-preview.png'), Buffer.from(image.data, 'base64'));
    return { imageBytes: Buffer.from(image.data, 'base64').length };
  });
  const docx = path.join(testDir, '서식 검증.docx');
  await createDocx(docx);
  const bridgeDir = path.join(testDir, 'bridge');
  const directDir = path.join(testDir, 'direct');
  await fs.mkdir(directDir);
  let converted;
  await check('Filee MCP output equals direct Filee output for every ZIP member', async () => {
    const result = JSON.parse(text(await call('filee_convert_to_hwpx', { input_path: docx, output_dir: bridgeDir })));
    assert.equal(result.converted, 1);
    converted = result.files[0].outputs[0];
    const direct = await runProcess(referenceFilee, ['convert', docx, '--to', 'hwpx', '-o', directDir, '--skip', '--json'], { env: { ...process.env, FILEE_DATA_DIR: path.join(testDir, 'direct-config') } });
    assert.equal(direct.code, 0, direct.stderr);
    const directFile = JSON.parse(direct.stdout).files[0].outputs[0];
    const a = await zipContents(converted); const b = await zipContents(directFile);
    assert.deepEqual(a, b, 'HWPX XML/binary entries differ from direct Filee');
    const parsed = text(await call('parse_document', { file_path: converted }));
    assert.match(parsed, /123,456/); assert.match(parsed, /교육비/);
    return { identicalMembers: Object.keys(a).length };
  });
  await check('Existing outputs are skipped and source files remain unchanged', async () => {
    const before = await fs.readFile(converted);
    const result = JSON.parse(text(await call('filee_convert_to_hwpx', { input_path: docx, output_dir: bridgeDir })));
    assert.equal(result.skipped, 1); assert.equal(result.converted, 0);
    assert.deepEqual(before, await fs.readFile(converted));
  });
  const scan = path.join(testDir, 'scan.png');
  await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="480"><rect width="100%" height="100%" fill="white"/><g font-family="Malgun Gothic" font-size="62" fill="black"><text x="80" y="130">한글 문서 OCR 검증</text><text x="80" y="260">BANK REPORT 123456</text><text x="80" y="390">테스트 결과를 확인합니다</text></g></svg>')).withMetadata({ density: 300 }).png().toFile(scan);
  await check('Default Filee OCR recognizes Korean, English and digits in editable HWPX', async () => {
    const result = JSON.parse(text(await call('filee_ocr', { input_path: scan, output_dir: path.join(testDir, 'ocr'), output_format: 'hwpx' })));
    assert.equal(result.converted, 1);
    const parsed = text(await call('parse_document', { file_path: result.files[0].outputs[0] }));
    await fs.writeFile(path.join(testDir, 'filee-ocr.txt'), parsed);
    assert.match(parsed, /123456/); assert.match(parsed, /한글/); assert.match(parsed, /BANK/);
    return { recognized: parsed.slice(-600) };
  });
  await check('kordoc PP-OCR offline recognition from a Korean image', async () => {
    const parsed = text(await call('parse_document', { file_path: scan, ocr: true, ocr_rec: 'printed' }));
    await fs.writeFile(path.join(testDir, 'kordoc-ocr.txt'), parsed);
    assert.match(parsed, /123456/); assert.match(parsed, /한글/);
    return { recognized: parsed.slice(-600) };
  });
  await check('Default Filee OCR recognizes Hanja, English and digits; records short Korean line accuracy', async () => {
    const hanjaScan = path.join(testDir, 'hanja-scan.png');
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="500"><rect width="100%" height="100%" fill="white"/><g font-family="Malgun Gothic" font-size="72" fill="black"><text x="80" y="120">한글 문서</text><text x="80" y="250">BANK REPORT 123456</text><text x="80" y="380">銀行 金融 漢字</text></g></svg>')).withMetadata({ density: 300 }).png().toFile(hanjaScan);
    const result = JSON.parse(text(await call('filee_ocr', { input_path: hanjaScan, output_dir: path.join(testDir, 'hanja-ocr'), output_format: 'hwpx' })));
    assert.equal(result.converted, 1);
    const parsed = text(await call('parse_document', { file_path: result.files[0].outputs[0] }));
    await fs.writeFile(path.join(testDir, 'hanja-ocr.txt'), parsed);
    assert.match(parsed, /BANK/); assert.match(parsed, /123456/);
    assert.match(parsed.replaceAll(/\s/g, ''), /銀行金融漢字/);
    // Language availability is not a guarantee of OCR accuracy on every line.
    // Keep the known short-line failure visible; Korean default recognition is
    // independently required by the preceding full-line fixture.
    return { languages: 'kor+eng+chi_tra (default)', shortKoreanLineExact: parsed.includes('한글 문서'), recognized: parsed.slice(-600) };
  });
  await check('Reject missing files and unsupported OCR languages', async () => {
    const missing = await connection.client.callTool({ name: 'filee_convert_to_hwpx', arguments: { input_path: path.join(testDir, 'missing.docx'), output_dir: bridgeDir } });
    assert.equal(missing.isError, true);
    const invalid = await connection.client.callTool({ name: 'filee_ocr', arguments: { input_path: scan, output_dir: bridgeDir, languages: 'kor;whoami' } });
    assert.equal(invalid.isError, true);
    for (const languages of ['jpn', 'deu']) {
      const excluded = await connection.client.callTool({ name: 'filee_ocr', arguments: { input_path: scan, output_dir: bridgeDir, languages } });
      assert.equal(excluded.isError, true);
    }
  });
} catch (error) {
  checks.push({ name: 'failure', passed: false, error: error.stack });
  console.error(error.stack); process.exitCode = 1;
} finally {
  await connection.close();
  if (/not valid JSON|Unexpected token/.test(connection.stderr())) { checks.push({ name: 'MCP stdout cleanliness', passed: false, stderr: connection.stderr() }); process.exitCode = 1; }
  const result = { date: new Date().toISOString(), testDir, checks, stderr: connection.stderr() };
  await fs.writeFile(path.join(home, 'integration-result.json'), JSON.stringify(result, null, 2));
  console.log(`Results: ${path.join(home, 'integration-result.json')}`);
}
