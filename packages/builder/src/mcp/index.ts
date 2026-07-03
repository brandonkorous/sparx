// Builder MCP tool registry barrel. `builderMcpTools` is the array the MCP server
// iterates to register tools. Imported via the `@sparx/builder/mcp` subpath so the
// api-mcp process never evaluates the surface-css service (and its heavy Tailwind
// compiler) — these tools wrap only the page service.

export type { McpScope, McpToolDefinition, AnyMcpTool } from './registry';
export { BUILDER_STYLE_GUIDE, type BuilderStyleGuide } from './vocabulary';

import { readTools } from './read-tools';
import { writeTools } from './write-tools';
import { layoutReadTools, layoutWriteTools } from './layout-tools';

export * from './read-tools';
export * from './write-tools';
export * from './layout-tools';

export const builderMcpTools = [
  ...readTools,
  ...writeTools,
  ...layoutReadTools,
  ...layoutWriteTools,
];
