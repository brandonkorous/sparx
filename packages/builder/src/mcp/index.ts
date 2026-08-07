// Builder MCP tool registry barrel. `builderMcpTools` is the array the MCP server
// iterates to register tools. Imported via the `@sparx/builder/mcp` subpath so the
// api-mcp process never evaluates the surface-css service (and its heavy Tailwind
// compiler) — these tools wrap only the page service.

export type { McpScope, McpToolDefinition, AnyMcpTool } from './registry';
export { BUILDER_STYLE_GUIDE, type BuilderStyleGuide } from './vocabulary';
export { SILICA_STYLE_GUIDE, type SilicaStyleGuide } from './silica-vocabulary';

import { readTools } from './read-tools';
import { writeTools } from './write-tools';
import { silicaReadTools } from './silica-read-tools';
import { silicaWriteTools } from './silica-write-tools';
import { silicaVersionTools } from './silica-version-tools';

export * from './read-tools';
export * from './write-tools';
export * from './silica-read-tools';
export * from './silica-write-tools';
export * from './silica-version-tools';
export * from './silica-blocks';
export { readRelay, withRelay, type BuilderRelaySideChannel } from './relay';

// NOTE — there are deliberately no site-LAYOUT tools here. `list/get/create/update/
// publish/set_active/delete_builder_layout` used to sit between the page and silica
// sets, and every one of them was a write nothing could render: they read and wrote
// `builder_layouts.draft_tree` / `.published_tree` (the legacy `.bx-*` columns) while
// the site's ONLY chrome tier reads `.silica_published_tree` (apps/site/app/
// layout.tsx — the sparx-Builder header/footer renderer was deleted with it). An agent
// following their docs authored a whole header, published it, got `published: true`,
// and the site kept serving the starter frame. Chrome is `set_silica_frame` +
// `publish_silica_site`; the page BODY tools below still render through the legacy
// fallback in `[...slug]/page.tsx`, which is why they stay.
export const builderMcpTools = [
  ...readTools,
  ...writeTools,
  ...silicaReadTools,
  ...silicaWriteTools,
  ...silicaVersionTools,
];
