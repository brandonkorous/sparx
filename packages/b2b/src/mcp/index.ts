// The B2B tool set the MCP server publishes (docs/10). Read + write:b2b scopes;
// additionally gated on the `b2b` module flag in api-mcp's server.ts.

import { readTools, writeTools } from './tools.js';
import type { McpToolDefinition } from './registry.js';

export const b2bMcpTools: McpToolDefinition[] = [...readTools, ...writeTools];

export { readTools, writeTools };
export type { McpToolDefinition, McpScope, B2bMcpCtx, AnyMcpTool } from './registry.js';
