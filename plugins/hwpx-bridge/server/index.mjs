import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { fileeTools, callFilee } from './filee.mjs';
import { ensureFontConfig } from './fonts.mjs';
import { fingerprint } from '../scripts/source-tools.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const home = path.resolve(argv[argv.indexOf('--home') + 1] || process.env.HWPX_BRIDGE_HOME || path.join(process.env.LOCALAPPDATA, 'HwpxBridge'));
const assets = JSON.parse(await fs.readFile(path.join(root, 'runtime/assets.json'), 'utf8'));
const runtime = path.join(home, 'versions', `${assets.bundleVersion}-win-x64`);
const ready = JSON.parse(await fs.readFile(path.join(runtime, 'ready.json'), 'utf8'));
if (ready.fingerprint !== await fingerprint(root)) throw new Error('Source/build configuration changed. Run setup.ps1 before starting the MCP server.');
process.env.FONTCONFIG_FILE = await ensureFontConfig(runtime);
process.env.KORDOC_OFFLINE = '1';
process.env.KORDOC_MODEL_CACHE = path.join(runtime, 'models');
if (process.env.HWPX_BRIDGE_DOCUMENT_ROOT) process.env.KORDOC_ROOT = process.env.HWPX_BRIDGE_DOCUMENT_ROOT;
const require = createRequire(path.join(runtime, 'npm/package.json'));
const sdk = module => import(pathToFileURL(require.resolve(`@modelcontextprotocol/sdk/${module}`)).href);
const [{ McpServer }, { StdioServerTransport }, { z }, kordoc] = await Promise.all([
  sdk('server/mcp.js'), sdk('server/stdio.js'),
  import(pathToFileURL(require.resolve('zod')).href),
  import(pathToFileURL(path.join(runtime, assets.kordocSource.module)).href)
]);
kordoc.routeConsoleToStderr();
kordoc.reexecInSandbox(false);
if (kordoc.VERSION !== assets.kordocVersion) throw new Error('Unexpected source-built kordoc version.');
const server = new McpServer({ name: 'hwpx-bridge', version: assets.bundleVersion }, { instructions:
  'One source-integrated HWPX plugin. Use filee_convert_to_hwpx for existing DOCX-to-HWPX conversion. Use generate_document for new HWPX reports, parse_document for reading, and patch_document/fill_form for existing layouts. Use filee_ocr for scanned PDF/image conversion, or parse_document OCR options for structured reading. The kordoc source runs inside this MCP; the Filee source is compiled into an internal converter. Processing is local. Do not promise lossless conversion or perfect OCR. Use absolute local paths and never overwrite source files without authorization.'
});
kordoc.registerKordocTools(server);
server.registerTool('hwpx_runtime_status', {
  description: 'Show integrated engine source commits, build receipt, versions and installed OCR languages.',
  inputSchema: z.object({}), annotations: { readOnlyHint: true, openWorldHint: false }
}, async () => ({ content: [{ type: 'text', text: JSON.stringify({ ...ready, home, languages: assets.languages.map(l => l.code), kordocTools: 22, processing: 'local', offlineModels: true, architecture: 'source-integrated', kordocProcess: 'in-process', fileeExecutable: assets.filee.executable }, null, 2) }] }));
for (const tool of fileeTools) {
  const fields = {
    input_path: z.string().describe(tool.inputSchema.properties.input_path.description),
    output_dir: z.string().describe(tool.inputSchema.properties.output_dir.description)
  };
  if (tool.name === 'filee_ocr') {
    fields.output_format = z.enum(['hwpx', 'docx', 'txt', 'md', 'pdf']).default('hwpx');
    fields.languages = z.string().default('kor+eng+chi_tra').describe(tool.inputSchema.properties.languages.description);
  }
  server.registerTool(tool.name, { description: tool.description, inputSchema: z.object(fields).strict(), annotations: tool.annotations }, async (args, extra) => {
    try { return await callFilee(tool.name, args, { runtime, assets, signal: extra.signal }); }
    catch (error) { return { isError: true, content: [{ type: 'text', text: error.message }] }; }
  });
}
let closing = false;
async function close() { if (!closing) { closing = true; await server.close().catch(() => {}); } }
process.on('SIGINT', () => { void close(); });
process.on('SIGTERM', () => { void close(); });
process.stdin.on('end', () => { void close(); });
await server.connect(new StdioServerTransport());
