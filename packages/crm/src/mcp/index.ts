// CRM MCP tool registry barrel.
//
// `crmMcpTools` is the array the MCP server iterates to register tools.
// Each tool is a thin wrapper over a service function (locked decision #7).
// Read tools open; write tools confirmation-gated; bulk writes get the
// stricter 'write:crm_bulk' scope.

export type { McpScope, McpToolDefinition, AnyMcpTool } from './registry';

import { readTools } from './read-tools';
import { writeTools } from './write-tools';
import { OBJECT_TOOLS } from './object-tools';
import { ASSOCIATION_TOOLS } from './association-tools';
import { ENGAGEMENT_TOOLS } from './engagement-tools';
import { CALL_TOOLS } from './call-tools';

export * from './read-tools';
export * from './write-tools';
export * from './object-tools';
export * from './association-tools';
export * from './engagement-tools';
export * from './call-tools';

/** The full CRM tool set the MCP server publishes. */
export const crmMcpTools = [
  ...readTools,
  ...writeTools,
  ...OBJECT_TOOLS,
  ...ASSOCIATION_TOOLS,
  ...ENGAGEMENT_TOOLS,
  ...CALL_TOOLS,
];

// Invoicing (docs/87 §12) — a first-class module with its own scopes, so it ships
// as a SEPARATE array (not merged into crmMcpTools).
export {
  invoicingMcpTools,
  type InvoicingMcpScope,
  type InvoicingMcpTool,
} from './invoicing-tools';
