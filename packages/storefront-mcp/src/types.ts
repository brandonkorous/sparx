// Storefront MCP tool contract (docs/113 §3.3).
//
// A StorefrontTool is a declarative adapter over ONE public REST endpoint. The
// tool never touches a database or a module service — it validates its input,
// calls the public route via a StorefrontApiClient, and returns the unwrapped
// payload. The SAME catalog powers the shopper MCP service AND the storefront
// concierge (docs/56), so a tool added here reaches both at once.

import type { z } from 'zod';
import type { StorefrontApiClient } from './client.js';

/** Auth tier + intent of a tool. Drives the MCP `destructiveHint` and gating:
 *  - `read`         — anonymous, side-effect-free.
 *  - `guest_write`  — anonymous but MUTATING (booking, cart, review). The
 *                     shopper's client should confirm before calling.
 *  - `customer`     — needs a returning-customer identity (Phase 2, docs/113 §5). */
export type ToolKind = 'read' | 'guest_write' | 'customer';

/** Module slug a tool depends on (matches @sparx/auth ModuleSlug values). Kept a
 *  plain string so this package stays dependency-light — the public route is the
 *  real gate; this only lets a host skip registering a tool for a disabled
 *  module (cleaner tools/list). */
export type ToolModule = 'commerce' | 'scheduling' | 'crm' | 'builder' | 'inventory' | 'email';

/** The resolved storefront a tool call targets. Threaded onto every public-API
 *  request as `?tenant=&property=`. `customerSession` is Phase 2 only. */
export interface StorefrontCtx {
  tenantSlug: string;
  propertySlug?: string | null;
  /** Returning-customer session cookie value, relayed as `sparx_customer_session`
   *  on `customer`-tier calls (Phase 2). */
  customerSession?: string | null;
}

/** What a tool returns to the caller. `meta` carries pagination/facets when the
 *  underlying route is paged. */
export interface StorefrontToolResult {
  data: unknown;
  meta?: unknown;
}

export interface StorefrontTool {
  /** Shopper-facing, LLM-readable name (snake_case), e.g. `book_appointment`. */
  name: string;
  description: string;
  kind: ToolKind;
  /** Optional module gate hint (the public route enforces the real gate). */
  module?: ToolModule;
  /** Zod object schema — the SDK derives the JSON schema; the concierge converts
   *  it via `z.toJSONSchema`. */
  input: z.ZodType;
  /** Execute the tool: validated `input`, resolved `ctx`, the shared client. */
  call(
    client: StorefrontApiClient,
    ctx: StorefrontCtx,
    input: unknown
  ): Promise<StorefrontToolResult>;
}
