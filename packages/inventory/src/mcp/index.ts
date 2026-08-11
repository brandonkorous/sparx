// Inventory MCP tool registry barrel. `inventoryMcpTools` is the array the MCP
// server iterates to register inventory tools alongside the other modules'.

export type { McpScope, McpToolDefinition, AnyMcpTool } from './registry';

import { binReadTools, binWriteTools } from './bin-tools';
import { integrityReadTools, integrityWriteTools } from './integrity-tools';
import { readTools, writeTools } from './tools';
import { scanReadTools, scanWriteTools } from './scan-tools';
import { managementWriteTools } from './write-management-tools';

export * from './tools';
export { managementWriteTools } from './write-management-tools';
export { integrityReadTools, integrityWriteTools } from './integrity-tools';
export { binReadTools, binWriteTools } from './bin-tools';
export { scanReadTools, scanWriteTools } from './scan-tools';

/** The full Inventory tool set the MCP server publishes. */
export const inventoryMcpTools = [
  ...readTools,
  ...writeTools,
  ...managementWriteTools,
  // The "can I trust this number" tools (docs/146 Phase 1). Kept in their own
  // file because they are diagnosis rather than operation, and mixing them into
  // the supply loop would bury them.
  ...integrityReadTools,
  ...integrityWriteTools,
  // "Where is it, what's on that shelf, where should this go" (docs/146 Phase 2).
  ...binReadTools,
  ...binWriteTools,
  // "What is this, and put twelve of it on the delivery" (docs/146 Phase 3).
  // Also the path by which a phone with a camera but no barcode app becomes a
  // scanner: read the digits, pass them to `resolve_scan`.
  ...scanReadTools,
  ...scanWriteTools,
];
