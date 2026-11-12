// One MCP server = every kordoc tool + Filee document conversion.
//
// kordoc runs as its own MCP server (the unmodified kordoc npm package) in a child process; this server
// lists its tools next to filee_convert and forwards calls. kordoc's OCR models are downloaded by kordoc
// on first use, as kordoc normally does.
import path from 'node:path';
import { createRequire } from 'node:module';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileeTool, callFilee, locateFilee } from './filee.mjs';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const KORDOC_CALL_TIMEOUT = 30 * 60_000; // OCR model downloads and long renders

function kordocInfo() {
  const main = require.resolve('kordoc'); // dist/index.cjs; the package exports only "."
  const dist = path.dirname(main);
  return { mcp: path.join(dist, 'mcp.js'), version: pkg.dependencies.kordoc };
}

const statusTool = {
  name: 'hwpx_bridge_status',
  title: 'HWPX Bridge status',
  description: 'Show hwpx-bridge, kordoc and Filee versions and whether each engine is available on this computer.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, openWorldHint: false }
};

const INSTRUCTIONS = `hwpx-bridge: kordoc (read/write/edit Korean documents) + Filee (document format conversion).
- Existing DOCX -> HWPX (or any document format change: HWPX->PDF/DOCX, PDF->DOCX, PPTX/XLSX->PDF ...): filee_convert. Do not re-create a DOCX through parse_document + generate_document; that loses fonts, colors and layout.
- Read HWP/HWPX/PDF/DOCX/XLSX/images (incl. OCR): parse_document. New HWPX from text: generate_document. Fill or edit an existing HWPX keeping its layout: fill_form / patch_document. HWP -> HWPX keeping formatting: convert_to_hwpx.
- Use absolute local paths and a new output path; never overwrite the source file without permission.`;

export async function startServer() {
  let kordoc;          // Client once connected
  let kordocError;     // string when kordoc failed to start
  let kordocTools = [];
  let kordocInstructions = '';
  const info = kordocInfo();

  const kordocReady = (async () => {
    try {
      const client = new Client({ name: 'hwpx-bridge', version: pkg.version });
      await client.connect(new StdioClientTransport({
        command: process.execPath, args: [info.mcp], env: process.env, stderr: 'inherit'
      }));
      kordocTools = (await client.listTools()).tools.filter(tool => tool.name !== fileeTool.name && tool.name !== statusTool.name);
      kordocInstructions = client.getInstructions() ?? '';
      kordoc = client;
    } catch (error) {
      kordocError = `kordoc MCP failed to start: ${error.message}`;
      process.stderr.write(`[hwpx-bridge] ${kordocError}\n`);
    }
  })();

  // kordoc starts in about a second; waiting lets its own usage guide travel with ours.
  await kordocReady;
  const server = new Server(
    { name: 'hwpx-bridge', version: pkg.version },
    { capabilities: { tools: {} }, instructions: kordocInstructions ? `${INSTRUCTIONS}\n\n${kordocInstructions}` : INSTRUCTIONS }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    await kordocReady;
    return { tools: [fileeTool, ...kordocTools, statusTool] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    try {
      if (name === fileeTool.name) return await callFilee(args, { signal: extra.signal });
      if (name === statusTool.name) {
        await kordocReady;
        const filee = locateFilee();
        return { content: [{ type: 'text', text: JSON.stringify({
          hwpxBridge: pkg.version, node: process.version, platform: `${process.platform}-${process.arch}`,
          kordoc: kordoc ? { version: info.version, tools: kordocTools.length } : { error: kordocError },
          filee: filee.error ? { error: filee.error } : { version: filee.version, executable: filee.cli }
        }, null, 2) }] };
      }
      await kordocReady;
      if (!kordoc) throw new Error(kordocError ?? 'kordoc is not available.');
      if (!kordocTools.some(tool => tool.name === name)) throw new Error(`Unknown tool: ${name}`);
      return await kordoc.callTool({ name, arguments: args ?? {} }, undefined, {
        signal: extra.signal, timeout: KORDOC_CALL_TIMEOUT, resetTimeoutOnProgress: true
      });
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: error.message }] };
    }
  });

  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    await kordoc?.close().catch(() => {});
    await server.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  process.stdin.on('end', close);
  await server.connect(new StdioServerTransport());
}
