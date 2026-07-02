// @sparx/storefront-mcp — the shopper-facing tool catalog (docs/113).
//
// A thin, declarative set of tools over the public /v1/public/* REST API,
// shared by the mcp-storefront service and the storefront concierge (docs/56).
// No DB, no module packages — every tool is an HTTP adapter over the public
// API contract, so a fix in a public route fixes the tool.

export type {
  StorefrontTool,
  StorefrontCtx,
  StorefrontToolResult,
  ToolKind,
  ToolModule,
} from './types.js';
export {
  StorefrontApiClient,
  StorefrontApiError,
  type StorefrontMeta,
  type StorefrontResponse,
  type StorefrontRequest,
  type HttpMethod,
} from './client.js';
export {
  STOREFRONT_TOOLS,
  TOOLS_BY_NAME,
  getStorefrontTool,
  toolsForModules,
} from './catalog/index.js';
export { toAnthropicTools, mcpAnnotations, type AnthropicToolDef } from './adapters.js';
