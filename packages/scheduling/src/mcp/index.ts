// Scheduling MCP tool registry barrel (docs/79 §11, docs/07).
//
// `schedulingMcpTools` is the array the MCP server (`services/api-mcp`) iterates to
// register tools. Read tools open (`read:scheduling`); write tools confirmation-
// gated (`write:scheduling`). Each is a thin wrapper over the scheduling service
// layer (one service, many transports). The api-mcp server additionally gates these
// on the `scheduling` module flag, beyond the global `ai` module gate.

export type {
  SchedulingMcpScope,
  SchedulingMcpCtx,
  McpToolDefinition,
  AnyMcpTool,
} from './registry';

import { readTools } from './read-tools';
import { writeTools } from './write-tools';
import { lifecycleWriteTools } from './write-lifecycle-tools';

export * from './read-tools';
export * from './write-tools';
export { lifecycleWriteTools } from './write-lifecycle-tools';

/** The full scheduling tool set the MCP server publishes. */
export const schedulingMcpTools = [...readTools, ...writeTools, ...lifecycleWriteTools];
