// @wizeworks/site-mcp — the shopper-facing tool catalog (docs/113).
//
// A thin, declarative set of tools over the public /v1/public/* REST API,
// shared by the mcp-site service and the site concierge (docs/56).
// No DB, no module packages — every tool is an HTTP adapter over the public
// API contract, so a fix in a public route fixes the tool.

export type { SiteTool, SiteCtx, SiteToolResult, ToolKind, ToolModule } from './types.js';
export {
  SiteApiClient,
  SiteApiError,
  type SiteMeta,
  type SiteResponse,
  type SiteRequest,
  type HttpMethod,
} from './client.js';
export { SITE_TOOLS, TOOLS_BY_NAME, getSiteTool, toolsForModules } from './catalog/index.js';
export { toAnthropicTools, mcpAnnotations, type AnthropicToolDef } from './adapters.js';
