// The Builder node model — the canonical, serializable composition tree
// (docs/40 + docs/41, restyled by docs/61). This is the contract the backend
// matches: the /builder editor produces these, the service validates + stores
// them, and the storefront renderer walks them.
//
// One recursive primitive. "Section / column / component" are ROLES, not levels:
// every node is either a CONTAINER (arranges children) or a LEAF (renders
// content), and every node carries the same minimal shape:
//
//     { id, type, name?, class?, props, binding?, children? }
//
//   · name    — optional author label, shown in the Layers tree. Metadata, not
//               styling (sibling to id).
//   · class   — the ONE styling surface (docs/61): a Tailwind-native class string
//               (semantic component classes + token utilities) compiled per tenant
//               by @sparx/surface-compile. There is no separate box/layout object
//               anymore — arrangement, spacing, surface, and skin are all classes.
//   · props   — component-specific data (heading level, button label, the bg-image
//               URL a Section paints, …).
//   · binding — per-node. A leaf is static OR bound to a field; a container can
//               bind to an array to ITERATE its children once per item.
//
// Seed/blueprint authors describe nodes with the ergonomic BoxStyle/LayoutStyle
// vocabulary in `box-to-class.ts`, which compiles to the `class` string here —
// that DTO is build-time only and never reaches a persisted node.

import { z } from 'zod';

// ── Device (editor responsive preview) ───────────────────────────────────────
// Not a styling axis — the editor's device switcher fixes the canvas width so
// container-query utilities (`@md:…`) respond exactly as they will in production.

export const Device = z.enum(['desktop', 'tablet', 'mobile']);
export type Device = z.infer<typeof Device>;

// ── Binding ─────────────────────────────────────────────────────────────────

/** A per-node binding to a path in the current data scope, e.g. "cms.posts",
 *  "commerce.products[0]", "item.title". A node with no binding is static. */
export const BindingSchema = z.object({
  path: z.string().max(255),
});
export type Binding = z.infer<typeof BindingSchema>;

// ── The node (recursive) ──────────────────────────────────────────────────────

export interface BuilderNode {
  id: string;
  /** Registry key — what this node IS (Section, Heading, ImageDisplay, …). */
  type: string;
  /** Optional author-facing label, shown in the Layers tree. */
  name?: string;
  /** The Tailwind-native class string (docs/61) — the node's entire styling. A
   *  brand-governed vocabulary of semantic component classes plus token utilities;
   *  the per-tenant compile (@sparx/surface-compile) tree-shakes these literals
   *  into the tenant stylesheet, and both render paths apply the string verbatim. */
  class?: string;
  props: Record<string, unknown>;
  binding?: Binding;
  children?: BuilderNode[];
}

export const BuilderNodeSchema: z.ZodType<BuilderNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(255),
    type: z.string().min(1).max(63),
    name: z.string().max(120).optional(),
    // Bounded free string; the class VOCABULARY is enforced at compile time by the
    // allowlist (@sparx/surface-compile). The cap is the only guard at this tier.
    class: z.string().max(500).optional(),
    props: z.record(z.string(), z.unknown()),
    binding: BindingSchema.optional(),
    children: z.array(BuilderNodeSchema).optional(),
  })
);
