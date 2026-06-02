// The Builder node model — the canonical, serializable composition tree
// (docs/40 + docs/41). This is the contract the backend matches: the /builder
// editor produces these, the service validates + stores them, and (later) the
// storefront renderer walks them.
//
// One recursive primitive. "Section / column / component" are ROLES, not
// levels: every node is either a CONTAINER (arranges children) or a LEAF
// (renders content), and every node carries the same shape:
//
//     { id, type, box, layout?, props, binding?, children? }
//
//   · box     — the universal spine EVERY node has (alignment, height, width
//               behaviour, spacing, surface, visibility).
//   · layout  — containers only (direction / columns / gap / justify / align).
//   · props   — component-specific (heading level, button label, …).
//   · binding — per-node. A leaf is static OR bound to a field; a container can
//               bind to an array to ITERATE its children once per item.
//
// Values are TOKEN-BACKED SCALES, never freeform — the editor opts each
// component into the axes meaningful to it; this schema defines the vocabulary.

import { z } from 'zod';

// ── Box base: the universal spine ───────────────────────────────────────────

export const HeightScale = z.enum(['auto', 'sm', 'md', 'lg', 'full']);
export const WidthMode = z.enum(['full', 'contained']);
export const Surface = z.enum(['none', 'subtle', 'muted', 'inverse', 'brand']);
export const SpaceScale = z.enum(['none', 'sm', 'md', 'lg', 'xl']);
export const AlignX = z.enum(['start', 'center', 'end']);
export const Device = z.enum(['desktop', 'tablet', 'mobile']);
// A scrim laid over a background image so overlaid text stays legible (docs/45):
// a uniform dark/light veil, or a top+bottom gradient (the full-bleed-hero case).
export const Overlay = z.enum(['none', 'dark', 'light', 'gradient']);
// Text color over a background image / photo, decoupled from `surface` (which
// pairs bg+fg from tokens). `default` inherits the surface foreground.
export const TextTone = z.enum(['default', 'light', 'dark']);
// Pin a block out of normal flow so the block that follows it slides underneath
// (docs/45): `top` floats it transparently across the top — the overlay-header
// case (a header sitting over a full-bleed hero). `none` = normal flow.
export const Pin = z.enum(['none', 'top']);

export type HeightScale = z.infer<typeof HeightScale>;
export type WidthMode = z.infer<typeof WidthMode>;
export type Surface = z.infer<typeof Surface>;
export type SpaceScale = z.infer<typeof SpaceScale>;
export type AlignX = z.infer<typeof AlignX>;
export type Device = z.infer<typeof Device>;
export type Overlay = z.infer<typeof Overlay>;
export type TextTone = z.infer<typeof TextTone>;
export type Pin = z.infer<typeof Pin>;

export const BoxBaseSchema = z.object({
  /** Optional author-facing label, shown in the Layers tree. */
  name: z.string().max(120).optional(),
  height: HeightScale,
  backgroundWidth: WidthMode,
  contentWidth: WidthMode,
  surface: Surface,
  padding: SpaceScale,
  align: AlignX,
  /** Breakpoints this node is hidden on. Empty array is treated as "all". */
  hiddenOn: z.array(Device),
  /** A full-bleed background image URL — the primitive behind photo hero panels
   *  (docs/45). Spans the node's `backgroundWidth`; covers + centers. Absent =
   *  no image (the `surface` token color is used instead). A static URL for now;
   *  a media-library picker + bound backgrounds are follow-ups. `.default`-free
   *  (optional) so existing stored trees stay valid. */
  backgroundImage: z.string().max(2048).optional(),
  /** Scrim over the background image for text legibility. Optional so existing
   *  stored trees (which lack the key) stay valid; consumers default to 'none'. */
  overlay: Overlay.optional(),
  /** Text color over the background, independent of `surface`. */
  textTone: TextTone.optional(),
  /** Lift this block out of normal flow so the next block slides under it — the
   *  overlay-header primitive (docs/45). Optional so existing trees stay valid;
   *  consumers default to 'none'. */
  pin: Pin.optional(),
});
export type BoxBase = z.infer<typeof BoxBaseSchema>;

export const DEFAULT_BOX: BoxBase = {
  height: 'auto',
  backgroundWidth: 'contained',
  contentWidth: 'contained',
  surface: 'none',
  // Leaves default to no padding — spacing comes from the parent container's
  // gap. Containers set their own padding (registry defaults / starter trees).
  padding: 'none',
  align: 'start',
  hiddenOn: [],
  overlay: 'none',
  textTone: 'default',
};

// ── Layout base: containers only ────────────────────────────────────────────

export const Direction = z.enum(['stack', 'row', 'grid']);
export const GapScale = z.enum(['none', 'sm', 'md', 'lg']);
export const Justify = z.enum(['start', 'center', 'end', 'between']);
export const AlignItems = z.enum(['start', 'center', 'end', 'stretch']);

export type Direction = z.infer<typeof Direction>;
export type GapScale = z.infer<typeof GapScale>;
export type Justify = z.infer<typeof Justify>;
export type AlignItems = z.infer<typeof AlignItems>;

export const LayoutBaseSchema = z.object({
  direction: Direction,
  /** Column count when direction === 'grid'. */
  columns: z.number().int().min(1).max(12),
  gap: GapScale,
  justify: Justify,
  alignItems: AlignItems,
  wrap: z.boolean(),
});
export type LayoutBase = z.infer<typeof LayoutBaseSchema>;

export const DEFAULT_LAYOUT: LayoutBase = {
  direction: 'stack',
  columns: 3,
  gap: 'md',
  justify: 'start',
  alignItems: 'stretch',
  wrap: true,
};

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
  box: BoxBase;
  layout?: LayoutBase;
  props: Record<string, unknown>;
  binding?: Binding;
  children?: BuilderNode[];
}

export const BuilderNodeSchema: z.ZodType<BuilderNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(255),
    type: z.string().min(1).max(63),
    box: BoxBaseSchema,
    layout: LayoutBaseSchema.optional(),
    props: z.record(z.string(), z.unknown()),
    binding: BindingSchema.optional(),
    children: z.array(BuilderNodeSchema).optional(),
  })
);
