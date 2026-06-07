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
import { cn } from '@sparx/ui';
import {
  MAX_COMPONENT_NESTING,
  REF_KEY,
  bindSlotKey,
  customKeyOf,
  expandComponentTree,
  isCustomType,
  readComponentRef,
  type BindingCatalog,
  type ComponentDto,
} from '@sparx/builder-schemas';

import type { VersionResolver } from './use-component-versions';

import {
  cardinalityOf,
  resolvePath,
  type BuilderNode,
  type Cardinality,
  type Device,
  type Scope,
} from './model';
import { moduleColor, moduleForPath } from './binding-catalog';
import { getDef } from './registry';

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

interface NodeProps {
  node: BuilderNode;
  scope: Scope;
  catalog: BindingCatalog;
  /** Tenant components keyed by key (docs/53 P-B) — expands `custom:*` placements
   *  for a live preview. */
  components?: ReadonlyMap<string, ComponentDto>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Locked = render as a non-interactive backdrop (no selection chrome, not
   *  clickable). Used to frame the page editor in its site layout. */
  locked?: boolean;
  /** What to render where an `Outlet` node sits (the editable page subtree when
   *  framing). Propagated down the locked chrome tree until the Outlet consumes
   *  it. */
  outletSlot?: React.ReactNode;
}

// In the editor a Carousel renders as a REAL carousel (active slide + arrows +
// dots) so the preview matches the storefront — "what you see is what you ship."
// Slides stay mounted (translated off-screen), so each is still selectable from
// the Layers panel; control clicks don't bubble to node selection.
function CanvasCarousel({ slides }: { slides: React.ReactNode[] }) {
  const [index, setIndex] = React.useState(0);
  const n = slides.length;
  const go = (next: number) => setIndex(((next % n) + n) % n);
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  if (n === 0) return <div className="bx-empty">Carousel — add slides (each child is a slide)</div>;
  return (
    <div className="bx-ccarousel">
      <div className="bx-ccarousel__viewport">
        <div className="bx-ccarousel__track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((slide, i) => (
            <div className="bx-ccarousel__slide" key={i}>
              {slide}
            </div>
          ))}
        </div>
      </div>
      <span className="bx-ccarousel__badge">
        Carousel · {n} {n === 1 ? 'slide' : 'slides'}
      </span>
      {n > 1 ? (
        <>
          <button
            type="button"
            className="bx-ccarousel__arrow bx-ccarousel__arrow--prev"
            aria-label="Previous slide"
            onClick={stop(() => go(index - 1))}
          >
            ‹
          </button>
          <button
            type="button"
            className="bx-ccarousel__arrow bx-ccarousel__arrow--next"
            aria-label="Next slide"
            onClick={stop(() => go(index + 1))}
          >
            ›
          </button>
          <div className="bx-ccarousel__dots">
            {slides.map((_, i) => (
              <button
                type="button"
                key={i}
                className="bx-ccarousel__dot"
                data-on={i === index}
                aria-label={`Go to slide ${i + 1}`}
                onClick={stop(() => go(i))}
              />
            ))}
          </div>
        </>
      ) : null}
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
  const selected = node.id === selectedId;

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
          selected && 'bx-node--selected'
        )}
        style={{ position: 'relative' }}
        data-node-id={node.id}
        role="button"
        tabIndex={-1}
        aria-label="Missing component"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
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
      className={cn('bx-node', 'bx-node--custom', selected && 'bx-node--selected')}
      style={{ position: 'relative' }}
      data-node-id={node.id}
      role="button"
      tabIndex={-1}
      aria-label={node.name ?? comp.name}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
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
  // The only inline style: a dynamic background image (a URL can't be a class).
  // The surface COLOR comes from node.class (live-compiled into the canvas).
  const bgStyle = backgroundStyleFor(node, scope);
  // docs/61 — a presentational leaf wears node.class on its OWN element (renderLeaf
  // → the Button `<span>`), so the content wrapper omits it to avoid double-paint.
  // Every other node carries node.class on its content wrapper, where the live-
  // compiled utilities (flex/grid/padding/surface) lay out + paint it.
  const leafByClass = def.leafStylesByClass === true && /(^|\s)sf-/.test(node.class ?? '');
  const innerClass = cn('bx-inner', leafByClass ? undefined : node.class);

  let body: React.ReactNode;
  if (node.type === 'Outlet' && outletSlot !== undefined) {
    // Framing the page editor: the layout is a locked backdrop and the editable
    // page subtree drops in here, exactly where the storefront mounts it.
    body = outletSlot;
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
    body = <CanvasCarousel slides={slideNodes} />;
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
      body = scopes.flatMap(({ s, key }) =>
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
    body =
      def.renderLeaf?.({
        node,
        value,
        cardinality: card,
        bound,
        children: kidNodes.length > 0 ? kidNodes : undefined,
      }) ?? null;
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
      className={cn('bx-node', selected && 'bx-node--selected')}
      data-node-id={node.id}
      data-bx-type={node.type}
      role="button"
      tabIndex={-1}
      aria-label={node.name ?? def.label}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          onSelect(node.id);
        }
      }}
    >
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
      <div className={innerClass} style={bgStyle}>
        {body}
      </div>
    </div>
  );
}

// ── Public canvas ────────────────────────────────────────────────────────────

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
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The site layout tree (page editor only). When present, the page is framed
   *  inside it: the layout renders as a locked backdrop and `tree` is dropped at
   *  the layout's Outlet — the same composition the storefront ships, so the
   *  overlay header/footer preview correctly. */
  chrome?: BuilderNode | null;
}

const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 834, mobile: 390 };

export function Canvas({
  tree,
  data,
  catalog,
  components,
  resolveVersion,
  device,
  selectedId,
  onSelect,
  chrome,
}: CanvasProps) {
  const width = DEVICE_WIDTH[device];
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Scroll the selected node into view (the preview side of select→reveal — e.g.
  // selecting a layer in the tree). `nearest` makes it a no-op when the node is
  // already visible, so clicking a node in the canvas never makes it jump.
  React.useEffect(() => {
    if (!selectedId) return;
    const el = scrollRef.current?.querySelector(`[data-node-id="${CSS.escape(selectedId)}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);
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
  return (
    <VersionResolverContext.Provider value={resolveVersion ?? null}>
      <div
        className="bx-canvas-scroll"
        ref={scrollRef}
        role="button"
        tabIndex={-1}
        aria-label="Clear selection"
        onClick={() => onSelect(null)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onSelect(null);
        }}
      >
        <div
          className="bx-canvas"
          data-theme="light"
          style={width ? { width, maxWidth: '100%' } : undefined}
          data-device={device}
          data-framed={chrome ? '' : undefined}
        >
          {chrome ? (
            <CanvasNode
              node={chrome}
              scope={{ root: data }}
              catalog={catalog}
              components={components}
              selectedId={selectedId}
              onSelect={onSelect}
              locked
              outletSlot={page}
            />
          ) : (
            page
          )}
        </div>
      </div>
    </VersionResolverContext.Provider>
  );
}
