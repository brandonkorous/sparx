'use client';

// Drawing a silica node tree as real DOM.
//
// Real DOM, not an iframe. The canvas frame is a plain element whose width drives
// the tree's own `@container` queries, so switching device REFLOWS the design the
// author is editing instead of opening a second, mobile editor beside it.
//
// Selection and hover paint with `outline`, never `border` or `ring`: an outline
// takes no space, so highlighting a block cannot move the block beside it. A
// 2px border would make every hover nudge the layout the author is judging.
//
// STYLING RULE (hard): every class here is a LITERAL string, so a consuming app's
// Tailwind `@source` scan safelists it. A computed class name compiles to nothing
// and the failure is invisible — the ring simply never appears.

import { createElement, type ReactNode } from 'react';
import {
  applyOverrides,
  expandComponent,
  type Child,
  type Node,
  type SymbolDef,
} from '@wizeworks/silicaui-html';
import { isAddressable, isNodeChild, type AddressableNode } from '../../tree/walk';
import type { StudioHost } from '../host';

/** Elements that cannot hold children. Passing them any is a React error, not a
 *  warning, so the check has to happen before `createElement`. */
const VOID_TAGS = new Set([
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

/** HTML attribute names React spells differently. Everything else passes through. */
const ATTR_ALIASES: Record<string, string> = {
  for: 'htmlFor',
  class: 'className',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  maxlength: 'maxLength',
  readonly: 'readOnly',
  tabindex: 'tabIndex',
};

export interface RenderContext {
  host: StudioHost;
  symbols: Record<string, SymbolDef>;
  selectedIds: readonly string[];
  hoverId: string | null;
  /**
   * The ids the author may edit. Null means the whole tree — which is a layout or
   * a component pane. On a page pane it holds the body's ids, and everything
   * outside it is chrome: real, live, and inert.
   */
  editableIds: Set<string> | null;
  /** Where a drop would land, drawn as an edge or a ring while dragging. */
  dropHint: DropHint | null;
  /**
   * The node the author is typing INTO, if any.
   *
   * While a node is being edited its element owns its own text: React renders
   * the words it had when editing began and never touches them again, because
   * the children it is handed do not change until the edit is committed as an
   * op. That is what lets a caret survive a hover or a selection re-render.
   */
  editingId?: string | null;
  /**
   * The node currently in the air on a press-and-hold drag.
   *
   * A mouse drag carries its own ghost and needs nothing; a finger drag has no
   * ghost at all, so without this the only evidence that a press-and-hold had
   * registered was a drop indicator somewhere else on the page.
   */
  liftedId?: string | null;
}

export interface DropHint {
  targetId: string;
  position: 'before' | 'after' | 'inside';
}

export function isEditable(ctx: RenderContext, id: string | undefined): boolean {
  if (!id) return false;
  return ctx.editableIds === null || ctx.editableIds.has(id);
}

/** The outline utilities a node wears for its current state. */
/**
 * Selection and drop chrome — the CONSOLE's colors, never the tenant's.
 *
 * These classes are painted on nodes INSIDE the canvas, which is scoped to the
 * theme being edited, so `outline-primary` here resolved to the SITE's primary.
 * A tenant whose brand color sits near their own background got a selection
 * outline they could not see, and every author saw the outline change color when
 * they changed their brand — chrome reporting on the thing it is chrome for.
 *
 * `--studio-select` / `--studio-drop` are set on the scroll container in
 * `canvas.tsx`, one level OUTSIDE the theme scope, so they inherit in carrying the
 * console's own primary and secondary. Same rule as the theme builder's color
 * tiles: a control must not wear the thing it edits.
 */
function stateClasses(ctx: RenderContext, node: AddressableNode): string {
  const id = node.id;
  if (!id) return '';
  const editable = isEditable(ctx, id);
  const classes: string[] = [];

  if (ctx.selectedIds.includes(id)) {
    classes.push('outline-(--studio-select) outline outline-2 -outline-offset-2');
  } else if (ctx.hoverId === id && editable) {
    classes.push(
      'outline-[color-mix(in_oklab,var(--studio-select)_50%,transparent)] outline outline-1 -outline-offset-1'
    );
  }

  // Faded because it is ELSEWHERE — the author is holding it, and this is the
  // hole it left. The one reading of faded ink this design system asks for.
  if (ctx.liftedId === id) classes.push('opacity-50');

  if (ctx.dropHint?.targetId === id) {
    classes.push(
      ctx.dropHint.position === 'inside'
        ? 'outline-(--studio-drop) outline outline-2 outline-dashed -outline-offset-2'
        : 'outline-(--studio-drop) outline outline-2 -outline-offset-2'
    );
  }

  // Chrome around an editable page body reads as context, not as content the
  // author forgot they could touch.
  //
  // `pointer-events` INHERITS, and the editable page body is spliced into the
  // Outlet INSIDE that chrome — so switching it off on the frame switched it off
  // for the whole page too, and every click on a page canvas fell through to the
  // wallpaper. The Layers rail still worked, which is what made it look like a
  // quirk rather than the page builder being unusable with a mouse. Re-arming it
  // on the editable node is what stops the cascade at the boundary.
  classes.push(editable ? 'pointer-events-auto' : 'pointer-events-none select-none');

  return classes.join(' ');
}

/**
 * Resolve a bound value for the canvas — sample data, so a bound heading reads as
 * a real product name instead of as `{{…}}`.
 *
 * A binding that names an ATTRIBUTE is not text and never was: the anchor on a
 * starter Contact page binds `site.identity.phoneHref` into `href`, and drawing
 * that as the link's words put `tel:01632960118` on the page where the number
 * belonged. It only stayed hidden while the binding resolved to nothing.
 */
function boundText(ctx: RenderContext, node: AddressableNode): string | undefined {
  if (node.data?.kind !== 'value' || node.data.attr) return undefined;
  return ctx.host.resolveBinding?.(node.data.ref);
}

/** The attribute a binding fills, when it names one. `href` on a link, `src` on
 *  a picture — the value goes on the element, and the words stay the words. */
function boundAttr(
  ctx: RenderContext,
  node: AddressableNode
): { key: string; value: string } | undefined {
  if (node.data?.kind !== 'value' || !node.data.attr) return undefined;
  const value = ctx.host.resolveBinding?.(node.data.ref, node.data.attr);
  return value === undefined ? undefined : { key: node.data.attr, value };
}

export function renderNode(node: Node, ctx: RenderContext, key?: string | number): ReactNode {
  if (node.kind === 'outlet') {
    // The layout builder draws the Outlet at its real place in the chrome. It is
    // the one node an author can neither delete nor move, so it says what it is
    // rather than rendering as an empty gap they will try to fill.
    return (
      <div
        key={key}
        data-sui-outlet=""
        className="border-base-content/25 text-base-content/70 bg-base-200 flex min-h-32 items-center justify-center rounded-lg border border-dashed p-6 text-sm"
      >
        Every page appears here
      </div>
    );
  }

  if (node.instanceOf) return renderInstance(node, ctx, key);
  if (node.kind === 'host') return renderHost(node, ctx, key);
  if (node.kind === 'component') return renderComponent(node, ctx, key);

  return renderElement(node, ctx, key);
}

/**
 * Attributes where an empty string is WORSE than absence, so the canvas leaves them off.
 *
 * `<img src="">` makes a browser re-request the current document, and `<a href="">`
 * silently reloads it — which is why the publish path scrubs both before `toHtml` and
 * pins it in a test. The canvas never did, and every section on the shelf ships its
 * placeholder picture as `src: ''` so the block reads as a real design before an author
 * has chosen a photograph. Dropping three of those onto a page therefore fired three
 * full fetches of the studio route, and React logged an error for each.
 *
 * Fixing it here rather than in the catalog keeps the rule where the disagreement was:
 * a canvas that renders an attribute the live page will not is lying about the page,
 * whichever tree it is drawing. Deliberately only the URL-bearing set — an empty `alt`
 * means decorative and an empty `value` is a legitimately empty field.
 */
const URL_ATTRS = new Set(['href', 'src', 'srcset', 'poster', 'cite', 'action', 'formaction']);

/**
 * The element attributes the canvas actually renders — the authored ones, plus the one
 * a binding fills, under React's prop names.
 *
 * TWO RULES, BOTH OF WHICH THE CANVAS USED TO GET WRONG.
 *
 * An empty URL attribute is DROPPED, per `URL_ATTRS` above. And a bound attribute is
 * folded in HERE rather than after the caller's void-tag return, because `img` is a
 * void tag: applied later, a bound product photo drew its placeholder on the canvas
 * and its real picture on the live page, on every product card and product hero on
 * the shelf. A binding that resolves to an empty URL is dropped for the same reason
 * an authored one is.
 */
export function attributeProps(
  attrs: Record<string, string | number | boolean> | undefined,
  bound?: { key: string; value: string }
): Record<string, unknown> {
  // The binding OVERWRITES the authored value first, and the empty rule is applied to
  // the result — the same order the publish path runs in (`resolveTree`, then
  // `dropEmptyUrlAttrs`). A binding that resolves to nothing therefore takes the
  // authored href with it, which is what makes a card with no URL un-clickable on the
  // canvas exactly as it is on the live page.
  const merged: Record<string, string | number | boolean> = { ...(attrs ?? {}) };
  if (bound) merged[bound.key] = bound.value;

  const props: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(merged)) {
    if (value === '' && URL_ATTRS.has(name)) continue;
    props[ATTR_ALIASES[name] ?? name] = value;
  }
  return props;
}

function renderElement(
  node: AddressableNode,
  ctx: RenderContext,
  key?: string | number
): ReactNode {
  if (node.kind !== 'element') return null;

  // Bound attributes are folded in HERE, before the void-tag return below: `img` is a
  // void tag and `src` is the one attribute binding an image can carry.
  const props = attributeProps(node.attrs, boundAttr(ctx, node));

  const state = stateClasses(ctx, node);
  const editing = Boolean(node.id) && node.id === ctx.editingId;
  props.className = [node.class, state].filter(Boolean).join(' ') || undefined;
  props.key = key;
  if (node.id) {
    props['data-sui-id'] = node.id;
    // Not draggable while it is being typed into: dragging is how you select a
    // few words with a mouse, and a draggable element answers that gesture by
    // picking the whole block up instead.
    props.draggable = isEditable(ctx, node.id) && !node.locked && !editing;
  }
  if (editing) {
    props.contentEditable = true;
    props.suppressContentEditableWarning = true;
    props.spellCheck = true;
    props['data-studio-editing'] = '';
  }

  const tag = node.tag.toLowerCase();
  if (VOID_TAGS.has(tag)) return createElement(tag, props);

  if (node.rawHtml !== undefined) {
    // The one sanctioned bypass of the raw-element floor — the host sanitized it
    // at its data boundary, the same trust model as `dangerouslySetInnerHTML`.
    props.dangerouslySetInnerHTML = { __html: node.rawHtml };
    return createElement(tag, props);
  }

  const bound = boundText(ctx, node);
  if (bound !== undefined) return createElement(tag, props, bound);

  return createElement(tag, props, renderChildren(node.children, ctx));
}

/**
 * A silica component, lowered to its element expansion.
 *
 * Lowering rather than mounting a React component keeps the canvas honest: it
 * walks the SAME shape `toHtml` walks, so what the author sees is structurally
 * what publishes. The component's own id is forced back onto the expansion root,
 * or clicking a Button would select whatever `<button>` the expansion produced
 * and the Inspector would offer element props for a component.
 */
function renderComponent(
  node: AddressableNode,
  ctx: RenderContext,
  key?: string | number
): ReactNode {
  if (node.kind !== 'component') return null;
  let expanded: Node;
  try {
    expanded = expandComponent(node);
  } catch {
    return (
      <span
        key={key}
        data-sui-id={node.id}
        className="border-warning text-warning-content bg-warning/20 rounded border border-dashed px-2 py-1 text-sm"
      >
        Unknown component: {node.component}
      </span>
    );
  }
  if (!isAddressable(expanded)) return null;
  return renderNode({ ...expanded, id: node.id, class: expanded.class ?? node.class }, ctx, key);
}

/** A pinned functional core — cart, checkout, the brand mark. */
function renderHost(node: AddressableNode, ctx: RenderContext, key?: string | number): ReactNode {
  if (node.kind !== 'host') return null;
  const drawn = ctx.host.renderHostNode?.(node);
  const state = stateClasses(ctx, node);
  return (
    <div
      key={key}
      data-sui-id={node.id}
      data-sui-host={node.component}
      className={[node.class, state].filter(Boolean).join(' ') || undefined}
    >
      {drawn ?? (
        <div className="border-base-content/25 bg-base-100 text-base-content rounded-lg border border-dashed p-6 text-sm">
          {node.component} · live region
        </div>
      )}
    </div>
  );
}

/**
 * An instance of a saved piece.
 *
 * The master is drawn with this instance's overrides applied, but ONLY the
 * instance node is selectable — its expansion is not the author's tree to edit
 * here, and letting them click into it would silently detach the piece or edit
 * every other instance without saying so. Editing the master is the component
 * pane's job, and it propagates because both read one store.
 */
function renderInstance(
  node: AddressableNode,
  ctx: RenderContext,
  key?: string | number
): ReactNode {
  const symbol = node.instanceOf ? ctx.symbols[node.instanceOf] : undefined;
  if (!symbol) {
    return (
      <div
        key={key}
        data-sui-id={node.id}
        className="border-warning bg-warning/20 text-warning-content rounded border border-dashed p-4 text-sm"
      >
        This saved design is no longer available
      </div>
    );
  }

  const master = applyOverrides(structuredClone(symbol.root), node.overrides);
  const inner: RenderContext = { ...ctx, editableIds: new Set(), selectedIds: [], hoverId: null };
  const state = stateClasses(ctx, node);

  return (
    <div
      key={key}
      data-sui-id={node.id}
      data-sui-instance={node.instanceOf}
      className={[node.class, state].filter(Boolean).join(' ') || undefined}
    >
      {renderNode(master, inner)}
    </div>
  );
}

function renderChildren(children: Child[] | undefined, ctx: RenderContext): ReactNode {
  if (!children?.length) return null;
  return children.map((child, index) =>
    isNodeChild(child) ? renderNode(child, ctx, keyFor(child, index)) : child
  );
}

/** A stable React key. The node id when there is one — an index alone re-keys
 *  every sibling after an insert, which throws away their DOM and any focus in it. */
function keyFor(node: Node, index: number): string {
  return isAddressable(node) && node.id ? node.id : `i${index}`;
}
