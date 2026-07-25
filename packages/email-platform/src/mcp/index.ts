// Email MCP tool registry barrel. `emailMcpTools` is the array the MCP server
// iterates to register tools (mirrors crmMcpTools).

export type { McpScope, McpToolDefinition, AnyMcpTool } from './registry';

import { readTools } from './read-tools';
import { writeTools } from './write-tools';
import { managementWriteTools } from './write-management-tools';

export * from './read-tools';
export * from './write-tools';
export { managementWriteTools } from './write-management-tools';

/** The full email tool set the MCP server publishes. */
export const emailMcpTools = [...readTools, ...writeTools, ...managementWriteTools];
