// Automation MCP tool registry barrel.
//
// `automationMcpTools` is the array the MCP server (`services/api-mcp`) iterates
// to register tools. Read tools open (`read:automations`); write tools
// confirmation-gated (`write:automations`). Each is a thin wrapper over the
// automation service layer (one service, three transports).

export type { AutomationMcpScope, McpToolDefinition, AnyMcpTool } from './registry';

import { readTools } from './read-tools';
import { writeTools } from './write-tools';

export * from './read-tools';
export * from './write-tools';

/** The full automation tool set the MCP server publishes. */
export const automationMcpTools = [...readTools, ...writeTools];
