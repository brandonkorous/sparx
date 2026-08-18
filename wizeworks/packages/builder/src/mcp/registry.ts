// Builder MCP tool registry (the docs/61 node-tree page builder).
//
// Each tool is a thin wrapper over a page-service function — one service, many
// transports. The MCP server imports `builderMcpTools` (via the `@wizeworks/builder/mcp`
// subpath, which deliberately avoids the surface-css service so the heavy Tailwind
// compiler never loads at MCP boot) and exposes them; REST exercises the same
// service functions. Mirrors wizeworks/packages/sitebuilder/src/mcp/registry.ts.
//
// NOTE these are the NEW node-tree page tools (Tailwind-native `class` authoring).
// @wizeworks/sitebuilder's tools (add_section, select_theme, …) drive the separate
// theme/brand + section surface; both share the read:builder / write:builder
// scopes but have distinct tool names.

import type { z } from 'zod';
import type { ServiceContext } from '../errors';

export type McpScope = 'read:builder' | 'write:builder';

export interface McpToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  scope: McpScope;
  input: z.ZodType<TInput>;
  /** Go-live / destructive writes — the MCP server surfaces a confirmation
   *  prompt before invoking. */
  confirmation: boolean;
  run(ctx: ServiceContext, input: TInput): Promise<TOutput>;
}

export type AnyMcpTool = McpToolDefinition<unknown, unknown>;
