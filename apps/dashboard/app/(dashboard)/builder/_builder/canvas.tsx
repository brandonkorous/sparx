'use client';

// The canvas — renders the node tree into a live preview and owns the
// universal concerns the registry deliberately doesn't: applying each node's
// Tailwind-native `class` (docs/61), binding resolution, ITERATION (an array-
// bound container repeats its children once per item, with `item` scope), and
// click-to-select. Styling is the live-compiled tenant utilities (useSurfacePreview,
// @scope-d to .bx-canvas), so the preview paints exactly as production does.
//
// A node definition only describes what's specific to itself; everything that
// is true of EVERY node lives here. That separation is what keeps the model
// from feeling disjointed.

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@sparx/ui';
import {
  MAX_COMPONENT_NESTING,
  REF_KEY,
  bindSlotKey,
  customKeyOf,
  emailSampleData,
  expandComponentTree,
  isCustomType,
  readComponentRef,
  sampleEmailText,
  type BindingCatalog,
  type ComponentDto,
} from '@sparx/builder-schemas';

import type { VersionResolver } from './use-component-versions';

import {
  cardinalityOf,
  findNode,
  findParent,
  resolvePath,
  type BuilderNode,
  type Cardinality,
  type Device,
  type Scope,
} from './model';
import { moduleColor, moduleForPath } from './binding-catalog';
import { acceptsChildren, getDef } from './registry';
import type { SelectMods } from './use-builder-editor';
// The ONE per-type leaf map + the interactive islands, shared with the live
// storefront renderer (docs/builder/02). The canvas wraps each node in its own
// selection chrome, then renders this for the leaf body in `edit` mode — so the
// preview IS what ships, no parallel mock render tree.
import {
  BuilderCarousel,
  EditModeProvider,
  ProductFormProvider,
  leafWearsClass,
  renderLeaf,
  resolveBuilderProduct,
} from '@sparx/builder-render';

// ── Class-only rendering (docs/61) ────────────────────────────────────────────
//
// The canvas applies each node's `class` string verbatim and lets the live-
// compiled tenant utilities (useSurfacePreview, @scope-d to .bx-canvas) paint it
// — exactly as the published site does, so preview == production. The editor adds
// only its own chrome (selection outline + tag) around that. The single inline
// style that remains is a dynamic background image (a URL can't be a class),
// painted from the node's bg-* props.

// Background-media scrims (docs/45) — a translucent veil layered OVER the photo
// (below content) so overlaid text stays legible.
const SCRIM: Record<string, string | null> = {
  none: null,
  dark: 'linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45))',
  light: 'linear-gradient(rgba(255,255,255,0.55), rgba(255,255,255,0.55))',
  gradient:
    'linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.04) 28%, rgba(0,0,0,0.04) 62%, rgba(0,0,0,0.6))',
};

// A diagonal-hatch stand-in shown when a node has a `bgImageBinding` but no record
// data resolves it in the editor (the storefront fills it from the real record).
const BOUND_MEDIA_PLACEHOLDER: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(45deg, var(--bxc-subtle) 0 14px, var(--bxc-muted) 14px 28px)',
};

/** First image of a bound image/images value, or undefined. Mirrors the
 *  storefront renderer's `firstImage`. */
function firstBoundImageUrl(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? (value as unknown[])[0] : value;
  if (candidate && typeof candidate === 'object') {
    const url = (candidate as { url?: unknown }).url;
    if (typeof url === 'string' && url !== '') return url;
  }
  return undefined;
}

/** Nine-point focal point → CSS `background-position` (mirrors the storefront). */
const BG_POSITION_CSS: Record<string, string> = {
  center: 'center',
  top: 'center top',
  bottom: 'center bottom',
  left: 'left center',
  right: 'right center',
  'top-left': 'left top',
  'top-right': 'right top',
  'bottom-left': 'left bottom',
  'bottom-right': 'right bottom',
};

/** The inline background-image style for a node, from its `bg-*` props (docs/61) —
 *  a static `bgImage` URL or a record image resolved from `bgImageBinding` against
 *  the editor scope (the bound image wins). A set-but-unresolved binding shows the
 *  hatch placeholder so the author sees the media slot. Undefined when there's no
 *  background — the surface COLOR then comes from node.class. */
function backgroundStyleFor(node: BuilderNode, scope: Scope): React.CSSProperties | undefined {
  const p = node.props;
  const staticUrl = typeof p.bgImage === 'string' ? p.bgImage : undefined;
  const bindingPath = typeof p.bgImageBinding === 'string' ? p.bgImageBinding : undefined;
  const boundUrl = bindingPath ? firstBoundImageUrl(resolvePath(scope, bindingPath)) : undefined;
  const image = boundUrl ?? staticUrl;
  if (!image) return bindingPath ? BOUND_MEDIA_PLACEHOLDER : undefined;
  const overlay = typeof p.bgOverlay === 'string' ? p.bgOverlay : 'none';
  const fit = p.bgFit === 'contain' ? 'contain' : 'cover';
  const position = typeof p.bgPosition === 'string' ? p.bgPosition : 'center';
  const url = `url("${image.replace(/["\\]/g, '')}")`;
  const scrim = SCRIM[overlay];
  return {
    backgroundImage: scrim ? `${scrim}, ${url}` : url,
    backgroundSize: fit,
    backgroundPosition: BG_POSITION_CSS[position] ?? 'center',
    backgroundRepeat: 'no-repeat',
  };
}

// ── The recursive node ───────────────────────────────────────────────────────

// The secondary-selection set (docs/builder/05 §2.2) — every selected node id
// EXCEPT the primary (`selectedId`). Read by each node to paint the lighter
// multi-select chrome without threading the whole set through every recursive
// call. Empty for a single selection.
const MultiSelectContext = React.createContext<ReadonlySet<string>>(new Set());

/** Translate a click's modifier keys into a selection intent (docs/builder/05
 *  §2.2): Shift = range, Cmd/Ctrl = additive toggle. */
function selectMods(e: React.MouseEvent): SelectMods {
  return { additive: e.metaKey || e.ctrlKey, range: e.shiftKey };
}

interface NodeProps {
  node: BuilderNode;
  scope: Scope;
  catalog: BindingCatalog;
  /** Tenant components keyed by key (docs/53 P-B) — expands `custom:*` placements
   *  for a live preview. */
  components?: ReadonlyMap<string, ComponentDto>;
  selectedId: string | null;
  onSelect: (id: string, mods?: SelectMods) => void;
  /** Locked = render as a non-interactive backdrop (no selection chrome, not
   *  clickable). Used to frame the page editor in its site layout. */
  locked?: boolean;
  /** What to render where an `Outlet` node sits (the editable page subtree when
   *  framing). Propagated down the locked chrome tree until the Outlet consumes
   *  it. */
  outletSlot?: React.ReactNode;
}

// The ghosted SAMPLE page shown at an Outlet in the layout editor when no real
// page is framed (docs/45 §2.6). It anchors the header/footer chrome against
// representative content — a hero + a feature grid in the tenant brand — instead
// of a thin empty slot. Purely decorative + aria-hidden; clicking still selects
// the single Outlet node (the wrapper owns selection). On the live site the routed
// page mounts here instead.
function OutletGhost() {
  return (
    <div className="bx-outlet">
      <span className="bx-outlet__tag">Page content renders here</span>
      <div className="bx-outlet__sample" aria-hidden>
        <div className="bx-outlet__hero">
          <span className="bx-outlet__bar bx-outlet__bar--eyebrow" />
          <span className="bx-outlet__bar bx-outlet__bar--title" />
          <span className="bx-outlet__bar bx-outlet__bar--title bx-outlet__bar--title-2" />
          <span className="bx-outlet__bar bx-outlet__bar--lede" />
          <span className="bx-outlet__cta" />
        </div>
        <div className="bx-outlet__section">
          <span className="bx-outlet__bar bx-outlet__bar--heading" />
          <div className="bx-outlet__grid">
            {['a', 'b', 'c'].map((k) => (
              <div key={k} className="bx-outlet__card">
                <span className="bx-outlet__thumb" />
                <span className="bx-outlet__bar bx-outlet__bar--card-title" />
                <span className="bx-outlet__bar bx-outlet__bar--line" />
                <span className="bx-outlet__bar bx-outlet__bar--line bx-outlet__bar--short" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Resolves a placement's EXACT pinned version (docs/53 Gap 1). Null ⇒ no resolver
// on this surface, so CustomCanvasNode falls back to the component's latest from
// the `components` map. Provided by the workspace via useComponentVersions.
const VersionResolverContext = React.createContext<VersionResolver | null>(null);

// How deeply we are inside expanded `custom:*` placements (docs/53 4a). The canvas
// auto-recurses (CanvasNode → CustomCanvasNode → CanvasNode …); this bounds that
// recursion as a backstop even though the service rejects cycles at save.
const CustomDepthContext = React.createContext(0);

// Email-preview context. Non-null ⇒ this canvas previews an EMAIL: content leaves
// paint the @sparx/email pixel scale (20px headings, 14px body, accent CTA) rather
// than the site-ui hero scale, AND `{{merge.tokens}}` resolve against this SAMPLE
// data — the real store name in `{{tenant.name}}`, generic placeholders for the
// per-recipient rest (docs/93). Null ⇒ a page/site canvas. Set once by the Canvas.
const EmailSampleContext = React.createContext<Record<string, unknown> | null>(null);

// The email surface's resolved brand identity — the tenant/site logo URL + store
// name (docs/52 §1) — for the `email_wordmark` header leaf to paint. Non-null only
// on an email canvas; the Canvas sets it from the frame's sender identity.
const EmailBrandContext = React.createContext<{
  logoUrl?: string | null;
  name?: string | null;
} | null>(null);

// A `custom:<key>` placement (docs/53 P-B): resolve the tenant component, expand
// its PINNED version (instance slots + binding overrides filled), and render the
// result LOCKED inside a selectable wrapper — so the whole component reads as one
// unit (you select / delete it as a block; you edit its internals in the
// component editor). A reference that no longer resolves shows a small removable
// marker; a component nested too deep stops with a notice.
function CustomCanvasNode({
  node,
  scope,
  catalog,
  components,
  selectedId,
  onSelect,
  locked,
  outletSlot,
}: NodeProps) {
  const key = customKeyOf(node.type) ?? '';
  const comp = components?.get(key);
  const resolveVersion = React.useContext(VersionResolverContext);
  const depth = React.useContext(CustomDepthContext);
  const multiSet = React.useContext(MultiSelectContext);
  const selected = node.id === selectedId;
  const multi = !selected && multiSet.has(node.id);

  // Nesting backstop (docs/53 4a): the service rejects cycles + over-deep nesting
  // at save, but a stale tree shouldn't be able to recurse the renderer to death.
  if (comp && depth >= MAX_COMPONENT_NESTING) {
    if (locked) return null;
    return (
      <div
        className={cn('bx-node', 'bx-node--custom', 'bx-node--missing')}
        style={{ position: 'relative' }}
        data-node-id={node.id}
      >
        <span className="bx-tag">
          <span className="bx-tag__name">{comp.name}</span>
        </span>
        <div className="bx-custom-missing">Components are nested too deep to preview here.</div>
      </div>
    );
  }

  if (!comp) {
    if (locked) return null;
    return (
      <div
        className={cn(
          'bx-node',
          'bx-node--custom',
          'bx-node--missing',
          selected && 'bx-node--selected',
          multi && 'bx-node--multi'
        )}
        style={{ position: 'relative' }}
        data-node-id={node.id}
        role="button"
        tabIndex={-1}
        aria-label="Missing component"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id, selectMods(e));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            onSelect(node.id);
          }
        }}
      >
        <span className="bx-tag">
          <span className="bx-tag__name">Missing component</span>
        </span>
        <div className="bx-custom-missing">This component is no longer available — remove it.</div>
      </div>
    );
  }

  const ref = readComponentRef(node.props);
  // The EXACT pinned version (docs/53 Gap 1); falls back to the component's latest
  // when no resolver is present (e.g. the resolver hasn't fetched it yet).
  const resolved = resolveVersion?.(key, ref?.version ?? null) ?? {
    tree: comp.tree,
    propSpec: comp.propSpec,
  };
  const instanceProps = { ...node.props };
  delete instanceProps[REF_KEY];
  const expanded = expandComponentTree(
    resolved.tree,
    instanceProps,
    resolved.propSpec,
    node.id,
    ref?.bindings ?? {}
  );
  // Bump the nesting depth for everything inside this expansion, so a component
  // nested inside it is bounded too.
  const body = (
    <CustomDepthContext.Provider value={depth + 1}>
      <CanvasNode
        node={expanded}
        scope={scope}
        catalog={catalog}
        components={components}
        selectedId={selectedId}
        onSelect={onSelect}
        locked
        outletSlot={outletSlot}
      />
    </CustomDepthContext.Provider>
  );

  // Already inside locked chrome (the page framed in its layout): just the body.
  if (locked) return body;

  return (
    <div
      className={cn(
        'bx-node',
        'bx-node--custom',
        selected && 'bx-node--selected',
        multi && 'bx-node--multi'
      )}
      style={{ position: 'relative' }}
      data-node-id={node.id}
      role="button"
      tabIndex={-1}
      aria-label={node.name ?? comp.name}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id, selectMods(e));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onSelect(node.id);
        }
      }}
    >
      <span className="bx-tag">
        <span className="bx-tag__name">{node.name ?? comp.name}</span>
        <span className="bx-tag__component">component</span>
      </span>
      {body}
    </div>
  );
}

function CanvasNode({
  node,
  scope,
  catalog,
  components,
  selectedId,
  onSelect,
  locked,
  outletSlot,
}: NodeProps) {
  // Email vs page/site — decides which scale a content leaf paints + which sample
  // data its tokens resolve against (docs/93). Read before any early return so the
  // hook order stays stable.
  const emailSample = React.useContext(EmailSampleContext);
  const emailMode = emailSample !== null;
  // The resolved email brand (logo + store name) for the wordmark header leaf.
  const emailBrand = React.useContext(EmailBrandContext);
  // The secondary-selection set (docs/builder/05 §2.2) — read before any early
  // return so the hook order stays stable.
  const multiSet = React.useContext(MultiSelectContext);
  // A tenant-component placement expands to a live preview (docs/53 P-B) — handled
  // before the registry lookup, which has no entry for `custom:*` types.
  if (isCustomType(node.type)) {
    return (
      <CustomCanvasNode
        node={node}
        scope={scope}
        catalog={catalog}
        components={components}
        selectedId={selectedId}
        onSelect={onSelect}
        locked={locked}
        outletSlot={outletSlot}
      />
    );
  }
  const def = getDef(node.type);
  if (!def) return null;

  // A `$bind:<key>` binding is an instance SLOT (docs/53 4b), only seen while
  // editing the component itself — it has no data here (each placement supplies
  // it), so it previews as static, flagged by a "field" chip.
  const bindSlot = node.binding ? bindSlotKey(node.binding.path) : null;
  const bound = Boolean(node.binding) && bindSlot === null;
  const value = bound ? resolvePath(scope, node.binding!.path) : undefined;
  const card: Cardinality = bound ? cardinalityOf(value) : 'empty';

  const selected = node.id === selectedId;
  const multi = !selected && multiSet.has(node.id);
  // The only inline style: a dynamic background image (a URL can't be a class).
  // The surface COLOR comes from node.class (live-compiled into the canvas).
  const bgStyle = backgroundStyleFor(node, scope);
  // docs/61 — a presentational leaf wears node.class on its OWN element (renderLeaf
  // → the Button `<a>`, the Heading `<h2>`), so the content wrapper omits it to
  // avoid double-paint. Every other node carries node.class on its content wrapper,
  // where the live-compiled utilities (flex/grid/padding/surface) lay out + paint
  // it. `leafWearsClass` is the SHARED predicate the live renderer uses, so both
  // surfaces agree where node.class lands.
  const leafByClass = leafWearsClass(node.type);
  // The `.bx-node` chrome wrapper is `display:contents` (builder.css) so the live
  // renderer's wrapperless DOM is reproduced and `node.class` sizing (w-full,
  // flex-1, mx-auto) resolves against the real flex/grid parent. The selection
  // `.bx-tag` therefore anchors to THIS element instead — it needs a positioned
  // box, so add `relative` unless the node already sets its own position (leaf
  // nodes wear node.class elsewhere, so their wrapper never inherits a position).
  const hasPosition = /(^|\s)(relative|absolute|fixed|sticky)(\s|$)/.test(node.class ?? '');
  const innerClass = cn(
    'bx-inner',
    leafByClass || !hasPosition ? 'relative' : undefined,
    leafByClass ? undefined : node.class
  );

  let body: React.ReactNode;
  if (node.type === 'Outlet') {
    // Framing the page editor: the layout is a locked backdrop and the editable
    // page subtree drops in here, exactly where the storefront mounts it. Editing
    // the layout standalone (no page framed) → a ghosted sample page anchors the
    // header/footer chrome instead of an empty slot.
    body = outletSlot !== undefined ? outletSlot : <OutletGhost />;
  } else if (def.kind === 'container' && node.type === 'Carousel') {
    // A Carousel renders as a real carousel (each child = a slide). Mirrors the
    // storefront's iterate-or-static behaviour so the preview is faithful.
    const kids = node.children ?? [];
    let slideNodes: React.ReactNode[];
    if (bound && card === 'array') {
      slideNodes = (value as unknown[]).flatMap((item, i) =>
        kids.map((child) => (
          <CanvasNode
            key={`${i}:${child.id}`}
            node={child}
            scope={{ ...scope, item, index: i }}
            catalog={catalog}
            components={components}
            selectedId={selectedId}
            onSelect={onSelect}
            locked={locked}
            outletSlot={outletSlot}
          />
        ))
      );
    } else {
      const s: Scope = bound && card === 'object' ? { ...scope, item: value } : scope;
      slideNodes = kids.map((child) => (
        <CanvasNode
          key={child.id}
          node={child}
          scope={s}
          catalog={catalog}
          components={components}
          selectedId={selectedId}
          onSelect={onSelect}
          locked={locked}
          outletSlot={outletSlot}
        />
      ));
    }
    // The REAL storefront carousel (docs/builder/02): arrows/dots/track identical
    // to production; the EditModeProvider suppresses its autoplay timer so it won't
    // advance under the author. Slides stay mounted (translated off-screen), so each
    // is still selectable from the Layers panel.
    body =
      slideNodes.length === 0 ? (
        <div className="bx-empty">Carousel — add slides (each child is a slide)</div>
      ) : (
        <BuilderCarousel
          slides={slideNodes}
          autoplay={node.props.autoplay !== false}
          interval={Number(node.props.interval) || 6}
          arrows={node.props.arrows !== false}
          dots={node.props.dots !== false}
        />
      );
  } else if (def.kind === 'container') {
    const kids = node.children ?? [];
    let scopes: { s: Scope; key: string }[];
    if (bound && card === 'array') {
      scopes = (value as unknown[]).map((item, i) => ({
        s: { ...scope, item, index: i },
        key: `i${i}`,
      }));
    } else if (bound && card === 'object') {
      scopes = [{ s: { ...scope, item: value }, key: 'o' }];
    } else {
      scopes = [{ s: scope, key: 's' }];
    }

    if (bound && card === 'array' && scopes.length === 0) {
      body = <div className="bx-empty">Nothing to show — the list is empty</div>;
    } else {
      const rendered = scopes.flatMap(({ s, key }) =>
        kids.map((child) => (
          <CanvasNode
            key={`${key}:${child.id}`}
            node={child}
            scope={s}
            catalog={catalog}
            components={components}
            selectedId={selectedId}
            onSelect={onSelect}
            locked={locked}
            outletSlot={outletSlot}
          />
        ))
      );
      // An empty container in edit mode shows a clear, droppable hint instead of a
      // zero-height void (docs/builder/05 §2.7) — the wrapper stays selectable, so a
      // canvas drag can drop straight into it.
      body =
        rendered.length === 0 && !locked ? (
          <div className="bx-empty">Empty — add or drop blocks here</div>
        ) : (
          rendered
        );
    }
  } else {
    // A leaf may still nest children (Button → an inline Icon, docs/47). Render
    // them as selectable nodes in the current scope and hand them to renderLeaf,
    // which decides where they sit relative to its own content.
    const kidNodes = (node.children ?? []).map((child) => (
      <CanvasNode
        key={child.id}
        node={child}
        scope={scope}
        catalog={catalog}
        components={components}
        selectedId={selectedId}
        onSelect={onSelect}
        locked={locked}
        outletSlot={outletSlot}
      />
    ));
    body = renderLeaf({
      node,
      value,
      cardinality: card,
      bound,
      mode: 'edit',
      surface: emailMode ? 'email' : 'page',
      leafClass: leafByClass ? node.class : undefined,
      children: kidNodes.length > 0 ? kidNodes : undefined,
      emailSample: emailSample ?? undefined,
      emailBrand: emailBrand ?? undefined,
    });
  }

  // A ProductForm container establishes the shared buy-box context over its subtree
  // (mirrors the live renderer), so VariantPicker/Quantity/AddToCart placed inside
  // stay in sync. In the canvas the product is the sample fixture (resolveBuilderProduct).
  if (node.type === 'ProductForm') {
    body = (
      <ProductFormProvider product={resolveBuilderProduct(value, 'edit')}>
        {body}
      </ProductFormProvider>
    );
  }

  if (locked) {
    // Locked chrome backdrop (page editor framing): faithful render + body, but no
    // selection tag, no outline, not clickable.
    return (
      <div className={cn('bx-node', 'bx-chrome')} data-node-id={node.id} data-bx-type={node.type}>
        <div className={innerClass} style={bgStyle}>
          {body}
        </div>
      </div>
    );
  }

  const iterating = def.kind === 'container' && bound && card === 'array';
  const count = Array.isArray(value) ? value.length : 0;

  return (
    <div
      className={cn('bx-node', selected && 'bx-node--selected', multi && 'bx-node--multi')}
      data-node-id={node.id}
      data-bx-type={node.type}
      role="button"
      tabIndex={-1}
      aria-label={node.name ?? def.label}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id, selectMods(e));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onSelect(node.id);
        }
      }}
    >
      <div className={innerClass} style={bgStyle}>
        <span className="bx-tag">
          <span className="bx-tag__name">{node.name ?? def.label}</span>
          {bound ? (
            <span
              className="bx-tag__bind"
              style={{ color: moduleColor(moduleForPath(catalog, node.binding!.path)) }}
            >
              <span
                className="bx-tag__dot"
                style={{ background: moduleColor(moduleForPath(catalog, node.binding!.path)) }}
              />
              {node.binding!.path}
            </span>
          ) : null}
          {bindSlot !== null ? (
            <span className="bx-tag__bind" style={{ color: 'var(--module-active)' }}>
              <span className="bx-tag__dot" style={{ background: 'var(--module-active)' }} />
              field · {bindSlot}
            </span>
          ) : null}
          {iterating ? <span className="bx-tag__repeat">↻ {count}</span> : null}
        </span>
        {body}
      </div>
    </div>
  );
}

// ── Public canvas ────────────────────────────────────────────────────────────

/** How the preview is FRAMED. The frame is chrome — `aria-hidden`, never a node
 *  and never selectable — that reads the canvas as the thing it actually is:
 *   · `browser` — a site/page. A browser window on desktop (property origin +
 *     slug in the address bar); a device bezel on tablet/mobile (driven by
 *     `device`). docs/45.
 *   · `email`   — an inbox envelope (From · To · Subject) wrapping the send
 *     artifact (wordmark header · body · legal footer). docs/52.
 *  Omitted ⇒ the bare canvas card (legacy look). */
export type CanvasFrame =
  | { kind: 'browser'; origin: string; path: string | null }
  | {
      kind: 'email';
      subject: string;
      senderName: string;
      senderAddress: string | null;
      /** Tenant light logo URL. When set the wordmark renders the logo (and only
       *  the logo), matching @sparx/email's EmailWordmark; absent ⇒ the name. */
      senderLogoUrl?: string | null;
      /** The tenant's REAL identity for resolving `{{merge.tokens}}` in the canvas
       *  preview — the store name (`{{tenant.name}}`), store URL, support email —
       *  so the body reads with the real store name instead of a placeholder
       *  (docs/93). Per-recipient tokens (customer/order/…) stay generic samples. */
      tenant?: { name?: string | null; siteUrl?: string | null; supportEmail?: string | null };
    }
  | null;

export interface CanvasProps {
  tree: BuilderNode;
  data: Scope['root'];
  catalog: BindingCatalog;
  /** Tenant components keyed by key (docs/53 P-B) — expands `custom:*` placements
   *  for a live preview. */
  components?: ReadonlyMap<string, ComponentDto>;
  /** Resolves a placement's EXACT pinned version (docs/53 Gap 1). Omitted ⇒ the
   *  canvas previews each component's latest. */
  resolveVersion?: VersionResolver;
  device: Device;
  /** The PRIMARY selected node id (the inspector's focus). */
  selectedId: string | null;
  /** The full multi-selection set (docs/builder/05 §2.2); the primary plus any
   *  secondary nodes. Omitted ⇒ single selection. */
  selectedIds?: string[];
  /** Select a node (with optional click modifiers for multi-select) or clear with
   *  null. */
  onSelect: (id: string | null, mods?: SelectMods) => void;
  /** Re-parent / reorder by dragging on the canvas (docs/builder/05 §2.3): move
   *  `dragId` to be child `index` of `parentId`, through the SAME move logic the
   *  layers tree uses. Omitted ⇒ canvas drag is off (read-only preview). */
  onMove?: (dragId: string, parentId: string, index: number) => void;
  /** The site layout tree (page editor only). When present, the page is framed
   *  inside it: the layout renders as a locked backdrop and `tree` is dropped at
   *  the layout's Outlet — the same composition the storefront ships, so the
   *  overlay header/footer preview correctly. */
  chrome?: BuilderNode | null;
  /** Whether the framing `chrome` renders as a non-interactive backdrop (the page
   *  editor: you edit the page, the chrome is a locked preview) or as SELECTABLE
   *  nodes (the unified studio, docs/builder/03: header/footer are editable layout-
   *  owned nodes alongside the page). Ignored without `chrome`. Default true. */
  chromeLocked?: boolean;
  /** Frames the preview as a site (browser/bezel) or an email (envelope). The
   *  frame is chrome only — it never wraps the editable tree in a node. Omitted ⇒
   *  the bare canvas card. */
  frame?: CanvasFrame;
}

const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 834, mobile: 390 };

// Host shown in the browser frame's address bar — the origin minus its scheme +
// trailing slash (e.g. "wildgrove.sparx.zone"), so the chrome reads like a real
// URL bar instead of "https://…".
function displayHost(origin: string): string {
  return origin.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// First letter for the envelope's sender avatar (falls back to a dot).
function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '·';
}

// ── Canvas drag/drop (docs/builder/05 §2.3) ───────────────────────────────────
//
// Direct-manipulation reorder/reparent ON the canvas, reusing the SAME `onMove`
// (model.moveNode) the layers tree uses. Geometry is read from the rendered DOM:
// each node's box is its `.bx-inner` (the `.bx-node` wrapper is `display:contents`,
// docs/builder/04, so it has no box of its own) or, for a component placement, the
// `.bx-node--custom` element itself. The drop position is derived from where the
// pointer sits over the hovered node — into a container's middle band, else before/
// after it as a sibling — and the index among children comes from the MODEL, so it
// matches a layers-tree move exactly.
//
// Only the SELECTABLE nodes (`role="button"`) are drag targets, so a locked chrome
// backdrop (page editor) is never a drop site; a drop whose hovered node lives in a
// different tree-root than the dragged node is rejected, so nothing crosses the
// Outlet boundary (the studio router would reject that save anyway). Mouse only —
// touch reorders through the Layers panel, so a finger-scroll never grabs a block.

const DRAG_THRESHOLD = 6; // px of travel before a press becomes a drag (vs a click)

interface DropTarget {
  kind: 'into' | 'before' | 'after';
  parentId: string;
  index: number;
  targetId: string;
}

interface DragGuide {
  /** The insertion line, in viewport coords (the overlay is position:fixed). */
  line: { left: number; top: number; width: number };
  /** The highlighted container box (only for an `into` drop). */
  box?: { left: number; top: number; width: number; height: number };
}

/** The geometry box of a node's rendered element: the `.bx-inner` for an ordinary
 *  node (its wrapper is display:contents), or the element itself for a component
 *  placement. */
function innerBoxOf(wrapper: Element): DOMRect | null {
  if (wrapper.classList.contains('bx-node--custom')) return wrapper.getBoundingClientRect();
  const inner = wrapper.querySelector(':scope > .bx-inner');
  return (inner ?? wrapper).getBoundingClientRect();
}

function nodeBoxById(rootEl: Element, id: string): DOMRect | null {
  const el = rootEl.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
  return el ? innerBoxOf(el) : null;
}

function useCanvasDrag(
  roots: BuilderNode[],
  onMove: ((dragId: string, parentId: string, index: number) => void) | undefined,
  scrollRef: React.RefObject<HTMLDivElement | null>
) {
  const [dragging, setDragging] = React.useState(false);
  const [guide, setGuide] = React.useState<DragGuide | null>(null);
  // Pointer capture (set on the scroll container) routes every move/up to the
  // container's own React handlers — no window listeners to add/remove, no stale
  // closures. These refs carry per-drag state across those handlers.
  const candidate = React.useRef<{ id: string; pointerId: number; x: number; y: number } | null>(
    null
  );
  const draggingRef = React.useRef(false);
  const dropRef = React.useRef<DropTarget | null>(null);
  const suppressClick = React.useRef(false);
  const rootsRef = React.useRef(roots);
  rootsRef.current = roots;
  const onMoveRef = React.useRef(onMove);
  onMoveRef.current = onMove;

  const rootOf = (id: string): BuilderNode | null =>
    rootsRef.current.find((r) => findNode(r, id)) ?? null;

  const computeDrop = (px: number, py: number, dragId: string): DropTarget | null => {
    const rootEl = scrollRef.current;
    if (!rootEl) return null;
    const hit = document.elementFromPoint(px, py);
    const wrapper = hit?.closest('[data-node-id][role="button"]');
    if (!wrapper) return null;
    const hoveredId = wrapper.getAttribute('data-node-id');
    if (!hoveredId || hoveredId === dragId) return null;
    const dragRoot = rootOf(dragId);
    if (!dragRoot) return null;
    const draggedNode = findNode(dragRoot, dragId);
    // Can't drop a node into its own subtree, and can't cross tree-roots (Outlet).
    if (draggedNode && findNode(draggedNode, hoveredId)) return null;
    if (rootOf(hoveredId) !== dragRoot) return null;
    const hovered = findNode(dragRoot, hoveredId);
    if (!hovered) return null;
    const box = innerBoxOf(wrapper);
    if (!box) return null;
    const relY = (py - box.top) / Math.max(1, box.height);

    if (acceptsChildren(hovered.type) && relY > 0.25 && relY < 0.75) {
      const kids = hovered.children ?? [];
      let index = kids.length;
      for (let k = 0; k < kids.length; k += 1) {
        const kb = nodeBoxById(rootEl, kids[k]!.id);
        if (kb && py < kb.top + kb.height / 2) {
          index = k;
          break;
        }
      }
      return { kind: 'into', parentId: hoveredId, index, targetId: hoveredId };
    }

    const parent = findParent(dragRoot, hoveredId);
    if (!parent) return null; // the root can't be a sibling target
    const at = (parent.children ?? []).findIndex((c) => c.id === hoveredId);
    if (at === -1) return null;
    const before = relY < 0.5;
    return {
      kind: before ? 'before' : 'after',
      parentId: parent.id,
      index: before ? at : at + 1,
      targetId: hoveredId,
    };
  };

  const guideFor = (drop: DropTarget): DragGuide | null => {
    const rootEl = scrollRef.current;
    if (!rootEl) return null;
    const box = nodeBoxById(rootEl, drop.targetId);
    if (!box) return null;
    if (drop.kind === 'into') {
      const kids =
        findNode(rootOf(drop.targetId) ?? rootsRef.current[0]!, drop.targetId)?.children ?? [];
      let top = box.top + 4;
      if (kids.length > 0) {
        const at = Math.min(drop.index, kids.length - 1);
        const kb = nodeBoxById(rootEl, kids[at]!.id);
        if (kb) top = drop.index >= kids.length ? kb.bottom : kb.top;
      }
      return {
        line: { left: box.left, top, width: box.width },
        box: { left: box.left, top: box.top, width: box.width, height: box.height },
      };
    }
    return {
      line: {
        left: box.left,
        top: drop.kind === 'before' ? box.top : box.bottom,
        width: box.width,
      },
    };
  };

  const reset = () => {
    candidate.current = null;
    draggingRef.current = false;
    dropRef.current = null;
    setDragging(false);
    setGuide(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!onMoveRef.current || e.pointerType !== 'mouse' || e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Leave real form controls inside a leaf alone (native focus / text select).
    if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const wrapper = target.closest('[data-node-id][role="button"]');
    if (!wrapper) return;
    const id = wrapper.getAttribute('data-node-id');
    if (!id) return;
    // Don't drag a tree root (it has no parent to move within).
    const root = rootOf(id);
    if (!root || !findParent(root, id)) return;
    // Record a candidate only — capture the pointer LATER, when the drag actually
    // starts (in onPointerMove), so a plain click never captures or interferes.
    candidate.current = { id, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const cand = candidate.current;
    if (!cand) return;
    if (cand.pointerId !== e.pointerId) return;
    if (!draggingRef.current) {
      if (Math.hypot(e.clientX - cand.x, e.clientY - cand.y) < DRAG_THRESHOLD) return;
      draggingRef.current = true;
      setDragging(true);
      // Now that it's a real drag, capture the pointer so move/up keep arriving
      // even if the cursor leaves the canvas.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // capture unsupported — the drag still works while the pointer stays inside
      }
    }
    const drop = computeDrop(e.clientX, e.clientY, cand.id);
    dropRef.current = drop;
    setGuide(drop ? guideFor(drop) : null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const cand = candidate.current;
    if (!cand) return;
    if (cand.pointerId !== e.pointerId) return;
    const drop = dropRef.current;
    if (draggingRef.current && drop) onMoveRef.current?.(cand.id, drop.parentId, drop.index);
    if (draggingRef.current) suppressClick.current = true; // swallow the trailing click
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
    reset();
  };

  // Capture-phase click guard: after a drag, swallow the synthetic click so it
  // doesn't select a node or clear the selection.
  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      suppressClick.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return { dragging, guide, onPointerDown, onPointerMove, onPointerUp, onClickCapture };
}

/** The drag overlay (docs/builder/05 §2.4): an insertion LINE showing where the
 *  block lands plus, for an into-container drop, a highlight of the target. Fixed
 *  to the viewport (so it ignores canvas scroll) and click-through. */
function DragGuides({ guide }: { guide: DragGuide }) {
  return (
    <div className="bx-dragguide" aria-hidden>
      {guide.box ? (
        <div
          className="bx-dragguide__box"
          style={{
            left: guide.box.left,
            top: guide.box.top,
            width: guide.box.width,
            height: guide.box.height,
          }}
        />
      ) : null}
      <div
        className="bx-dragguide__line"
        style={{ left: guide.line.left, top: guide.line.top, width: guide.line.width }}
      />
    </div>
  );
}

export function Canvas({
  tree,
  data,
  catalog,
  components,
  resolveVersion,
  device,
  selectedId,
  selectedIds,
  onSelect,
  onMove,
  chrome,
  chromeLocked = true,
  frame,
}: CanvasProps) {
  const width = DEVICE_WIDTH[device];
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // The secondary-selection set (every selected id except the primary), provided to
  // each node via context so multi-selected blocks paint the lighter chrome.
  const multiSet = React.useMemo(() => {
    if (!selectedIds || selectedIds.length <= 1) return new Set<string>();
    return new Set(selectedIds.filter((id) => id !== selectedId));
  }, [selectedIds, selectedId]);

  // Canvas drag searches BOTH the editable tree and (in the studio, where it's
  // selectable) the chrome; a drop never crosses between them.
  const dragRoots = React.useMemo(
    () => [tree, ...(chrome && !chromeLocked ? [chrome] : [])],
    [tree, chrome, chromeLocked]
  );
  const drag = useCanvasDrag(dragRoots, onMove, scrollRef);

  // Scroll the selected node into view (the preview side of select→reveal — e.g.
  // selecting a layer in the tree). `nearest` makes it a no-op when the node is
  // already visible, so clicking a node in the canvas never makes it jump.
  React.useEffect(() => {
    if (!selectedId) return;
    const el = scrollRef.current?.querySelector(`[data-node-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);
  // Email preview sample data (docs/93): the real tenant identity merged over the
  // generic placeholders, so `{{tenant.name}}` reads the store's real name in the
  // canvas. Null on a page/site canvas. Keyed on the identity fields so the context
  // value stays stable across renders (no needless subtree re-renders).
  const emailTenant = frame?.kind === 'email' ? frame.tenant : undefined;
  const emailSample = React.useMemo(
    () =>
      frame?.kind === 'email'
        ? emailSampleData({
            name: emailTenant?.name,
            siteUrl: emailTenant?.siteUrl,
            supportEmail: emailTenant?.supportEmail,
          })
        : null,
    [frame?.kind, emailTenant?.name, emailTenant?.siteUrl, emailTenant?.supportEmail]
  );
  // The email brand (logo + store name) the wordmark header leaf paints (docs/52 §1).
  // From the frame's sender identity; null on a page/site canvas. Stable-keyed.
  const senderLogoUrl = frame?.kind === 'email' ? (frame.senderLogoUrl ?? null) : null;
  const senderName = frame?.kind === 'email' ? frame.senderName : null;
  const emailBrand = React.useMemo(
    () => (frame?.kind === 'email' ? { logoUrl: senderLogoUrl, name: senderName } : null),
    [frame?.kind, senderLogoUrl, senderName]
  );

  // The editable page subtree — fully selectable. When framing, it's handed to
  // the locked chrome tree to render at the Outlet; otherwise it's the root.
  const page = (
    <CanvasNode
      node={tree}
      scope={{ root: data }}
      catalog={catalog}
      components={components}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
  // How to frame the preview (chrome — never a node). A site/page is a browser
  // window on desktop and a device bezel on tablet/mobile; an email is an inbox
  // envelope. No frame ⇒ the bare canvas card.
  const frameKind: 'browser' | 'bezel' | 'email' | 'plain' =
    frame?.kind === 'email'
      ? 'email'
      : frame?.kind === 'browser'
        ? width === null
          ? 'browser'
          : 'bezel'
        : 'plain';

  // The themed canvas element — the tenant-brand scope + container-query host.
  // Plain keeps its device width inline; framed variants are sized by the frame.
  // On email it also carries the locked send chrome (wordmark + legal footer) the
  // renderer adds on send, so the preview is the real artifact, not a bare body.
  const canvasEl = (
    <div
      className="bx-canvas"
      data-theme="light"
      style={frameKind === 'plain' && width ? { width, maxWidth: '100%' } : undefined}
      data-device={device}
      data-surface={frame?.kind === 'email' ? 'email' : undefined}
      data-framed={chrome ? '' : undefined}
      // The canvas renders the REAL site-ui components for a faithful preview, but
      // it is a SELECTION surface, not a live page. Neutralize any link/button
      // default action (capture phase) so a click selects the node instead of
      // navigating or submitting; selection still fires on the node wrapper's
      // bubble-phase onClick. This is what lets leaves render real <a>/<button>
      // (Logo, NavMenu, Button, …) here without hijacking editor clicks.
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('a, button')) e.preventDefault();
      }}
    >
      {frame?.kind === 'email' ? (
        <>
          {/* The wordmark HEADER is now the first node of the tree (an editable,
              pinned `email_wordmark`), so it renders inside {page} — not as fixed
              chrome (docs/52 §1). The legal footer stays chrome. */}
          {page}
          <div className="bx-sendfoot" aria-hidden>
            {frame.senderName} · sent with Sparx
            <br />
            <span className="bx-sendfoot__links">Unsubscribe</span> ·{' '}
            <span className="bx-sendfoot__links">Manage preferences</span>
          </div>
        </>
      ) : chrome ? (
        <CanvasNode
          node={chrome}
          scope={{ root: data }}
          catalog={catalog}
          components={components}
          selectedId={selectedId}
          onSelect={onSelect}
          locked={chromeLocked}
          outletSlot={page}
        />
      ) : (
        page
      )}
    </div>
  );

  let framed: React.ReactNode = canvasEl;
  if (frameKind === 'browser' && frame?.kind === 'browser') {
    framed = (
      <div className="bx-browser">
        <div className="bx-browser__bar" aria-hidden>
          <span className="bx-browser__dots">
            <i />
            <i />
            <i />
          </span>
          <span className="bx-browser__url">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <span className="bx-browser__host">{displayHost(frame.origin)}</span>
            {frame.path ? <span className="bx-browser__path">{frame.path}</span> : null}
          </span>
        </div>
        {canvasEl}
      </div>
    );
  } else if (frameKind === 'bezel') {
    framed = (
      <div className={cn('bx-bezel', device === 'tablet' && 'bx-bezel--tablet')}>
        <div className="bx-bezel__status" aria-hidden>
          <span>9:41</span>
          <span className="bx-bezel__dots">
            <i />
            <i />
            <i />
          </span>
        </div>
        <div className="bx-bezel__screen" style={width ? { width } : undefined}>
          {canvasEl}
        </div>
      </div>
    );
  } else if (frameKind === 'email' && frame?.kind === 'email') {
    framed = (
      <div className="bx-envelope">
        <div className="bx-envelope__head">
          <div className="bx-envelope__subject">
            {/* The inbox shows the RESOLVED subject — interpolate its merge tokens
                against the sample data, like the body (the editable template stays
                raw in the Message panel). */}
            {frame.subject
              ? sampleEmailText(frame.subject, emailSample ?? undefined)
              : 'No subject yet'}
          </div>
          <div className="bx-envelope__row">
            <span className="bx-envelope__avatar" aria-hidden>
              {initialOf(frame.senderName)}
            </span>
            <span className="bx-envelope__who">{frame.senderName}</span>
            {frame.senderAddress ? (
              <span className="bx-envelope__addr">{`<${frame.senderAddress}>`}</span>
            ) : null}
          </div>
          <div className="bx-envelope__row">
            <span className="bx-envelope__lbl">To</span>
            <span className="bx-envelope__who">Sample recipient</span>
            <span className="bx-envelope__addr">&lt;you@example.com&gt;</span>
          </div>
        </div>
        <div className="bx-envelope__stage">
          <div className="bx-envelope__artifact">{canvasEl}</div>
        </div>
      </div>
    );
  }

  return (
    // Marks the whole canvas as the editor surface, so the shared islands suppress
    // ambient effects a click-shield can't stop (the carousel autoplay timer).
    <EditModeProvider>
      <EmailSampleContext.Provider value={emailSample}>
        <EmailBrandContext.Provider value={emailBrand}>
          <VersionResolverContext.Provider value={resolveVersion ?? null}>
            <MultiSelectContext.Provider value={multiSet}>
              <div
                className="bx-canvas-scroll"
                data-frame={frameKind}
                data-dragging={drag.dragging ? '' : undefined}
                ref={scrollRef}
                role="button"
                tabIndex={-1}
                aria-label="Clear selection"
                onClick={() => onSelect(null)}
                onClickCapture={drag.onClickCapture}
                onPointerDown={drag.onPointerDown}
                onPointerMove={drag.onPointerMove}
                onPointerUp={drag.onPointerUp}
                onPointerCancel={drag.onPointerUp}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onSelect(null);
                }}
              >
                {framed}
              </div>
            </MultiSelectContext.Provider>
          </VersionResolverContext.Provider>
        </EmailBrandContext.Provider>
      </EmailSampleContext.Provider>
      {/* The drag guides are portaled to <body> so position:fixed coords are
          immune to any transformed frame ancestor (bezel scale, etc.). */}
      {drag.guide ? createPortal(<DragGuides guide={drag.guide} />, document.body) : null}
    </EditModeProvider>
  );
}
