import fs from 'node:fs/promises';
import path from 'node:path';
import { connect, home } from './client.mjs';
const connection = await connect();
try {
  const tools = (await connection.client.listTools()).tools;
  await fs.writeFile(path.join(home, 'tool-schemas.json'), JSON.stringify(tools, null, 2));
  console.log(tools.map(tool => tool.name).join(', '));
  if (tools.some(tool => tool.name === 'hwpx_setup_status')) console.log(await connection.client.callTool({ name: 'hwpx_setup_status', arguments: {} }));
  for (const name of ['parse_document', 'render_document', 'patch_document']) {
    console.log(JSON.stringify(tools.find(tool => tool.name === name)?.inputSchema, null, 2));
  }
} finally { await connection.close(); console.error(connection.stderr()); }
