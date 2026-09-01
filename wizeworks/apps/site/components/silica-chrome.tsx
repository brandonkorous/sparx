// The storefront's silica render seam (docs/118 Stage 6). Two server components:
//
//   · SilicaBody  — a PUBLISHED page body. It has no Outlet, so it renders end to
//     end through the framework-free `renderSilicaBody` (flatten symbols → resolve
//     bindings → toHtml) and drops the resulting string in one container. This is
//     the north-star path: preview == production because the SAME `toHtml` the
//     builder canvas uses renders the live page.
//
//   · SilicaChrome — the shared FRAME (nav ⊕ Outlet ⊕ footer). The frame is the one
//     tree that can't be a single HTML string, because the routed page (`children`)
//     drops at its Outlet and the Next layout/page boundary hands that page as
//     React, not markup. So the frame is walked to React with `children` placed at
//     the OutletNode — a THIN structural walk (no per-type page rendering; that all
//     lives in `toHtml`) that mirrors `toHtml`'s element/component/meta emission so
//     the chrome matches a toHtml'd frame byte-for-byte.
//
// Both resolve bindings server-side against the sparx host (`buildSilicaHost`);
// `resolveTree` fills bound text/src and strips value/collection markers, leaving
// only `data-sui-action` / `data-sui-behavior` markers for the client behavior
// runtime to wire (docs/118 Stage 6b — landing post-install).

import * as React from 'react';
import {
  expandComponent,
  flattenSymbols,
  resolveTree,
  iconSvg,
  type ComponentNode,
  type DataScope,
  type HostNode,
  type Node as SilicaNode,
  type ResolveHost,
  type SymbolDef,
} from '@wizeworks/silicaui-html';
import { finalizeTree, imageAltsOf, renderSilicaBody } from '@wizeworks/silica-catalog';

import { attrProps } from './silica-attrs';

/** Mounts the real interactive component for a pinned functional core (docs/122) —
 *  keyed by the host node's `component`. The route supplies this (closing over its own
 *  context: tenant slug, route params, fetched data), so the walk stays generic. */
export type HostRenderer = (node: HostNode) => React.ReactNode;

// ── SilicaBody: a published page body → one resolved HTML string ─────────────

export function SilicaBody({
  root,
  symbols,
  host,
  scope,
}: {
  root: SilicaNode;
  symbols?: Record<string, SymbolDef>;
  host?: ResolveHost;
  scope?: DataScope;
}): React.ReactElement {
  const html = renderSilicaBody(root, {
    ...(symbols ? { symbols } : {}),
    ...(host ? { host } : {}),
    ...(scope ? { scope } : {}),
    // `ids: true` mirrors the frame walker's own unconditional `data-sui-id`
    // emission below (metaProps) — without it a page-body form/behavior node
    // renders with no `data-sui-id`, so the client can wire the behavior
    // (data-sui-behavior/data-sui-action are unconditional) but can never name
    // WHICH node submitted. A contact form then "succeeds" client-side (no
    // error thrown) while silently never reaching the server at all.
    html: { ids: true },
  });
  // No class on the wrapper. `sx-silica-body` used to sit here and nothing in the
  // repo ever styled it — one applied class, zero selectors — so it was a label, not
  // a hook, and the `sx-` prefix belongs to `@wizeworks/ui` rather than a tenant surface.
  // The div itself stays: `dangerouslySetInnerHTML` needs a container element.
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

// ── SilicaChrome: the frame walked to React, children at the Outlet ──────────

const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

interface DataMarker {
  kind: string;
  ref: string;
  href?: string;
}
interface WalkNode {
  kind: string;
  id?: string;
  tag?: string;
  class?: string;
  attrs?: Record<string, string | number | boolean>;
  children?: (WalkNode | string)[];
  data?: DataMarker;
  behavior?: { type: string; params?: unknown };
  part?: string;
  /** Host-node fields (`kind:"host"`) — the allowlist key + author-set config. */
  component?: string;
  props?: Record<string, unknown>;
}

/** What the walk drops at the special node kinds: the routed page at the frame's
 *  single Outlet, and the real interactive component at each pinned host node. */
interface WalkContext {
  outlet?: React.ReactNode;
  renderHost?: HostRenderer;
}

/** The `data-sui-*` markers a resolved node still carries — id + action + behavior +
 *  part (value/collection binds are stripped by resolveTree). Mirrors toHtml's
 *  `metaAttrs`, so the same runtime wires chrome and page bodies alike. */
function metaProps(node: WalkNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // The node's own id. `toHtml` emits this and this walker did not, which meant a
  // hydrated element could not say WHICH authored node it came from. That is fine for
  // a carousel (it only acts on itself) and fatal for a FORM: the submit has to name
  // the form node so the server can verify it exists and look up where it routes.
  if (node.id) out['data-sui-id'] = node.id;
  const d = node.data;
  if (d?.kind === 'action') {
    out['data-sui-action'] = d.ref;
    if (d.href != null) out.href = d.href;
  }
  if (node.behavior) {
    out['data-sui-behavior'] = node.behavior.type;
    if (node.behavior.params)
      out['data-sui-behavior-params'] = JSON.stringify(node.behavior.params);
  }
  if (node.part) out['data-sui-part'] = node.part;
  return out;
}

/** Walk one resolved silica node to a React node. The single OutletNode yields
 *  `ctx.outlet` (the routed page); a host node yields its real mounted component
 *  (`ctx.renderHost`) inside its authored wrapper (class + id preserved, so the
 *  tenant's styling of the pinned region applies). A ComponentNode expands to
 *  elements via silica's own `expandComponent` (the same expansion toHtml uses). */
function walk(node: WalkNode | string, key: React.Key, ctx: WalkContext): React.ReactNode {
  if (typeof node === 'string') return node;
  if (node.kind === 'outlet') return <React.Fragment key={key}>{ctx.outlet}</React.Fragment>;
  if (node.kind === 'host') {
    // toHtml lowers a host node to `<div class data-sui-host>`; the React walk mounts
    // the real component in that same wrapper. No renderer for the key → an empty
    // wrapper (the storefront registry is the source of truth for what's live).
    const mounted = ctx.renderHost?.(node as unknown as HostNode) ?? null;
    const hostProps: Record<string, unknown> = { key, ...metaProps(node) };
    if (node.class) hostProps.className = node.class;
    return React.createElement('div', hostProps, mounted);
  }
  if (node.kind === 'component') {
    return walk(expandComponent(node as unknown as ComponentNode), key, ctx);
  }
  const tag = node.tag ?? 'div';
  const props: Record<string, unknown> = {
    key,
    ...attrProps(tag, node.attrs),
    ...metaProps(node),
  };
  if (node.class) props.className = node.class;
  if (VOID_ELEMENTS.has(tag)) return React.createElement(tag, props);

  // ICONS. `toHtml` inlines an SVG for a CHILDLESS element carrying `data-icon`
  // (`iconSvg`), and this walk — which otherwise mirrors it — did not, so every
  // icon in a tenant's header or footer rendered as an empty span on the live
  // site while rendering correctly in the builder canvas. The one that matters is
  // the mobile menu button: a 32px transparent square with nothing in it, and the
  // only navigation a phone visitor has. It was tappable, so nothing errored and
  // nothing looked broken — it just was not there.
  const icon = iconMarkup(node);
  if (icon)
    return React.createElement(tag, { ...props, dangerouslySetInnerHTML: { __html: icon } });

  const kids = (node.children ?? []).map((c, i) => walk(c, i, ctx));
  return React.createElement(tag, props, ...kids);
}

/** The inline SVG for a childless `data-icon` element, mirroring `toHtml`. Trusted
 *  markup: it comes from silica's own bundled Lucide set keyed by name, never from
 *  tenant input — an unknown name yields nothing rather than anything injected. */
function iconMarkup(node: WalkNode): string | undefined {
  if (node.children && node.children.length > 0) return undefined;
  const name = node.attrs?.['data-icon'];
  if (typeof name !== 'string') return undefined;
  return iconSvg(name);
}

export function SilicaChrome({
  frame,
  symbols,
  host,
  renderHost,
  children,
}: {
  frame: SilicaNode;
  symbols?: Record<string, SymbolDef>;
  host?: ResolveHost;
  /** Mounts a `kind:"host"` node in the CHROME (the brand mark). Without it the walk's
   *  host case renders an empty wrapper — the frame carried host nodes as dead divs
   *  until this was threaded through. */
  renderHost?: HostRenderer;
  children: React.ReactNode;
}): React.ReactNode {
  const flat = flattenSymbols(frame, symbols ?? {});
  const resolved = host ? resolveTree(flat, host) : flat;
  // Mirror `renderSilicaBody`'s pipeline: the frame can bind attributes too (a
  // bound logo link), and an unhoisted carrier would render a stray hidden input
  // into the chrome. Always run — it also strips carriers that never resolved.
  //
  // The pipeline is `finalizeTree` now, not a hand-copied list of its steps. It was
  // copied here once and lost `responsiveImages`, which is the whole reason the header
  // logo shipped as a single full-width file on every page of every site; a later stage
  // then went to the HTML path only. "Mirror the pipeline" is the stated intent, so
  // mirror it by CALLING it. See the note on `SilicaFunctionalBody`.
  return walk(finalizeTree(resolved, imageAltsOf(host)), 'frame', {
    outlet: children,
    ...(renderHost ? { renderHost } : {}),
  });
}

// ── SilicaFunctionalBody: a page body with pinned cores → a React tree ───────
//
// A FUNCTIONAL page body (docs/122) carries one or more `kind:"host"` nodes — pinned
// regions whose real interactive component (cart, checkout, search…) only exists in
// React. The HTML-string `SilicaBody` would leave those as empty `<div data-sui-host>`
// mount points, so a body that embeds a core renders through the SAME React walk the
// frame uses, mounting each core at its node via the route-supplied `renderHost`. A
// content page with no host nodes should keep using `SilicaBody` (the faster string
// path); this is only for the functional shells.

export function SilicaFunctionalBody({
  root,
  symbols,
  host,
  scope,
  renderHost,
}: {
  root: SilicaNode;
  symbols?: Record<string, SymbolDef>;
  host?: ResolveHost;
  scope?: DataScope;
  renderHost: HostRenderer;
}): React.ReactNode {
  const flat = flattenSymbols(root, symbols ?? {});
  const resolved = host ? resolveTree(flat, host, scope) : flat;
  // THE WIDTH LADDER BELONGS TO EVERY RENDER PATH, NOT THE HTML ONE.
  //
  // There are three ways a silica tree reaches a visitor — `SilicaBody` (the HTML-string
  // projection), this React walk, and `SilicaChrome` — and `responsiveImages` used to run
  // in only the first, because it lives inside `renderSilicaBody`. So the ladder appeared
  // or vanished based on something no author can see or control: whether the page happens
  // to contain a host node. A page with a theme toggle or a brand mark takes THIS branch,
  // and every image on it shipped at one full-size URL — 28 of them on the storefront home,
  // while `/blog` (no host node, so the HTML path) correctly offered 400/800/1200/2000.
  //
  // Runs LAST and outermost, exactly as in `render.ts` — which is now literally the same
  // function: a bound image's src only exists after `resolveTree`, so anything earlier has
  // no URL to build a `srcset` from, and an image left with no src at all has to be given
  // the placeholder after that.
  return walk(finalizeTree(resolved, imageAltsOf(host)), 'body', { renderHost });
}
