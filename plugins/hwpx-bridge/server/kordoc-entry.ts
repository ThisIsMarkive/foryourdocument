// Build-time integration of the pinned source. No kordoc MCP child process.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerParseTools } from '../vendor/kordoc/src/mcp/tools-parse.js';
import { registerFormTools } from '../vendor/kordoc/src/mcp/tools-form.js';
import { registerRenderTools } from '../vendor/kordoc/src/mcp/tools-render.js';
import { registerGenerateTools } from '../vendor/kordoc/src/mcp/tools-generate.js';
import { registerLintTools } from '../vendor/kordoc/src/mcp/tools-lint.js';
import { registerConvertTools } from '../vendor/kordoc/src/mcp/tools-convert.js';
export { routeConsoleToStderr, VERSION } from '../vendor/kordoc/src/utils.js';
export { reexecInSandbox } from '../vendor/kordoc/src/shared/sandbox.js';

export function registerKordocTools(server: McpServer): void {
  registerParseTools(server);
  registerFormTools(server);
  registerRenderTools(server);
  registerGenerateTools(server);
  registerLintTools(server);
  registerConvertTools(server);
}
