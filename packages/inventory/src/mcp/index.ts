// Inventory MCP tool registry barrel. `inventoryMcpTools` is the array the MCP
// server iterates to register inventory tools alongside the other modules'.

export type { McpScope, McpToolDefinition, AnyMcpTool } from './registry';

import { readTools, writeTools } from './tools';
import { managementWriteTools } from './write-management-tools';

export * from './tools';
export { managementWriteTools } from './write-management-tools';

/** The full Inventory tool set the MCP server publishes. */
export const inventoryMcpTools = [...readTools, ...writeTools, ...managementWriteTools];
