// CMS MCP tool registry barrel (docs/12, docs/07).
//
// `cmsMcpTools` is the array the MCP server (`services/api-mcp`) iterates to
// register tools. Read tools open (`read:cms`); write tools confirmation-gated
// (`write:cms`). Each is a thin wrapper over the @sparx/cms service layer (one
// service, many transports). The api-mcp server additionally gates these on the
// `cms` module flag, beyond the global `ai` module gate.

export type { CmsMcpScope, CmsMcpCtx, McpToolDefinition, AnyMcpTool } from './registry.js';

import { readTools } from './read-tools.js';
import { writeTools } from './write-tools.js';

export * from './read-tools.js';
export * from './write-tools.js';

/** The full CMS tool set the MCP server publishes. */
export const cmsMcpTools = [...readTools, ...writeTools];
