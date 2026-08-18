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
//               by @wizeworks/surface-compile. There is no separate box/layout object
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

// ── Binding (docs/98 Pillar 7 — the data spine) ───────────────────────────────
//
// A node binds to data in one of FOUR ways. The original FIELD binding (a dotted
// `path` resolved against the data scope) is unchanged and still the common case;
// the v2 spine adds three more so a node can pin to a concrete record, iterate a
// specific collection, or trigger a cart action:
//
//   · field      — `{ path }`        resolve a value at a path (e.g. `item.title`).
//   · entity     — `{ entity, id }`  PIN this subtree to one concrete record
//                                    ("this card IS Product X"); sets the scope.
//   · collection — `{ source }`      REPEAT children once per product in a
//                                    specific collection / category / the catalog.
//   · action     — `{ action, href }` a trigger element (add-to-cart / buy-now /
//                                    link / submit) — resolves no display value.
//
// All four live on ONE object (every field optional) rather than a discriminated
// union, so the many existing `node.binding?.path` readers keep type-checking and
// a legacy `{ path }` validates unchanged. `bindingKind()` classifies which one a
// binding is; the renderer + scope engine dispatch on it.

/** A concrete entity a node can PIN to (entity binding) — sets the scope for its
 *  subtree. `product` additionally establishes the buy-box (ProductForm) context. */
export const BindingEntity = z.enum(['product', 'collection', 'category', 'cms']);
export type BindingEntity = z.infer<typeof BindingEntity>;

/** How a collection repeater ORDERS what it shows. The same vocabulary the public
 *  product API takes, so an author's choice is passed through rather than
 *  re-implemented over an already-fetched page — sorting after a `limit` would sort
 *  the first 24 rather than pick the top 24, which is a different list. */
export const CollectionSortSchema = z.enum([
  'newest',
  'price-asc',
  'price-desc',
  'title-asc',
  'title-desc',
]);
export type CollectionSort = z.infer<typeof CollectionSortSchema>;

/** Where a collection REPEATER sources its products: a specific collection or
 *  category (by id), or the whole catalog (`all`). */
export const CollectionSourceSchema = z.object({
  from: z.enum(['all', 'collection', 'category']),
  /** Required for `collection` / `category`; omitted for `all`. */
  id: z.string().max(255).optional(),
  /** Cap the repeater (default applied at load time). */
  limit: z.number().int().min(1).max(48).optional(),
  /** Order. Omitted = the catalog's own default order, which is what every existing
   *  stored binding means and must keep meaning. */
  sort: CollectionSortSchema.optional(),
  /**
   * Narrow to products carrying this tag — the one filter the catalog can express
   * with no schema at all, since `tags` is already how "featured" is marked.
   *
   * Deliberately a single tag rather than a query language. An author asking for "the
   * summer range on the home page" is asking for exactly this, and a filter builder
   * that can express contradictions ("tag is A and tag is B") mostly produces empty
   * grids the author cannot debug.
   */
  tag: z.string().max(64).optional(),
});
export type CollectionSource = z.infer<typeof CollectionSourceSchema>;

/** The interactive action a trigger element performs (action binding). */
export const BindingAction = z.enum(['add-to-cart', 'buy-now', 'link', 'submit']);
export type BindingAction = z.infer<typeof BindingAction>;

export const BindingSchema = z
  .object({
    /** FIELD binding — a dotted/bracketed path resolved against the data scope
     *  (e.g. `commerce.product[0]`, `item.title`). */
    path: z.string().max(255).optional(),
    /** ENTITY binding — pin this subtree to one concrete record by id. */
    entity: BindingEntity.optional(),
    id: z.string().max(255).optional(),
    /** Content-type key for a `cms` entity pin (which type the `id` belongs to). */
    cmsType: z.string().max(63).optional(),
    /** COLLECTION binding — repeat children once per product in this source. */
    source: CollectionSourceSchema.optional(),
    /** ACTION binding — the trigger this element fires on click/submit. */
    action: BindingAction.optional(),
    /** Target URL for an `action: 'link'` (ignored for the others). */
    href: z.string().max(2048).optional(),
    /** Denormalized human label for the pinned/looped target — inspector display
     *  only; data ALWAYS resolves by id at render time, never from this. */
    label: z.string().max(255).optional(),
  })
  // An entity pin needs an id; a cms pin also needs its type; a collection/category
  // source needs an id. (`all` needs none.) These keep a malformed binding out of a
  // persisted tree without constraining the common field/action shapes.
  .refine((b) => !b.entity || Boolean(b.id), { message: 'entity binding requires id' })
  .refine((b) => b.entity !== 'cms' || Boolean(b.cmsType), {
    message: 'cms entity binding requires cmsType',
  })
  .refine((b) => !b.source || b.source.from === 'all' || Boolean(b.source.id), {
    message: 'collection/category source requires id',
  });
export type Binding = z.infer<typeof BindingSchema>;

/** Which of the four kinds a binding is, by precedence (a transitional binding
 *  with several fields resolves to the most specific). Undefined for an empty or
 *  absent binding. */
export type BindingKind = 'field' | 'entity' | 'collection' | 'action';
export function bindingKind(binding: Binding | undefined | null): BindingKind | undefined {
  if (!binding) return undefined;
  if (binding.action) return 'action';
  if (binding.source) return 'collection';
  if (binding.entity && binding.id) return 'entity';
  if (binding.path) return 'field';
  return undefined;
}

/** Does this binding put a PRODUCT in scope (so the renderer should establish the
 *  buy-box context over the subtree / each repeated item)? True for a product
 *  entity pin and for every collection source (all our sources are product
 *  sources). */
export function bindingIsProductScope(binding: Binding | undefined | null): boolean {
  if (!binding) return false;
  return binding.entity === 'product' || Boolean(binding.source);
}

// ── The node (recursive) ──────────────────────────────────────────────────────

export interface BuilderNode {
  id: string;
  /** Registry key — what this node IS (Section, Heading, ImageDisplay, …). */
  type: string;
  /** Optional author-facing label, shown in the Layers tree. */
  name?: string;
  /** The Tailwind-native class string (docs/61) — the node's entire styling. A
   *  brand-governed vocabulary of semantic component classes plus token utilities;
   *  the per-tenant compile (@wizeworks/surface-compile) tree-shakes these literals
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
    // allowlist (@wizeworks/surface-compile). The cap is the only guard at this tier.
    // Raised for Builder v2 (docs/98): a single node can now carry the base layer
    // plus per-breakpoint (@sm…@4xl) and per-state (hover/focus/active/dark) variants
    // of many utilities, so 500 is too tight — 2000 is generous without being a DoS
    // vector (the compile allowlist still gates every token).
    class: z.string().max(2000).optional(),
    props: z.record(z.string(), z.unknown()),
    binding: BindingSchema.optional(),
    children: z.array(BuilderNodeSchema).optional(),
  })
);

// ── Tree walking (server-safe, no React) ──────────────────────────────────────
//
// Shared depth-first helpers. The public form-submit endpoint uses `findNodeById`
// to resolve a form node's config from the PUBLISHED tree by its stable id (the
// security boundary — config is read from the server-loaded snapshot, never the
// request); the publish-time form extractor uses `collectNodesByType`.

/** Depth-first (pre-order) search for a node by id. Returns null if absent. */
export function findNodeById(root: BuilderNode | null | undefined, id: string): BuilderNode | null {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/** Collect every node of a given `type` (depth-first, pre-order). */
export function collectNodesByType(
  root: BuilderNode | null | undefined,
  type: string
): BuilderNode[] {
  const out: BuilderNode[] = [];
  const walk = (n: BuilderNode): void => {
    if (n.type === type) out.push(n);
    for (const c of n.children ?? []) walk(c);
  };
  if (root) walk(root);
  return out;
}
