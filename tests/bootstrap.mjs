import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { connect, home } from './client.mjs';

const targetHome = path.join(home, 'bootstrap-empty');
await fs.mkdir(targetHome, { recursive: true });
const connection = await connect({ targetHome });
try {
  const tools = (await connection.client.listTools()).tools;
  assert.deepEqual(tools.map(tool => tool.name), ['hwpx_setup', 'hwpx_setup_status']);
  const result = await connection.client.callTool({ name: 'hwpx_setup_status', arguments: {} });
  assert.equal(JSON.parse(result.content[0].text).ready, false);
  console.log('Bootstrap MCP initialize/list/status passed without Node.js on PATH or installed in its home.');
} finally { await connection.close(); }
