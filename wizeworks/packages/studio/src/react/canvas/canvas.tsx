'use client';

// The canvas — the live document, editable in place.
//
// Three things it is deliberately NOT:
//
//  · Not an iframe. The frame is a plain element whose width drives the tree's own
//    `@container` queries, so changing device REFLOWS the design rather than
//    opening a second editor for phones.
//  · Not a preview of the page. On a page pane the chrome is drawn around the body
//    because that is what the author is designing INTO — but only the body answers
//    a click, accepts a drop, or appears in the Navigator. Everything else is
//    context (`pointer-events-none`), which is the honest state: it is real, it is
//    live, and it belongs to another document.
//  · Not themed by inline style. The theme is a real stylesheet scoped to this
//    canvas by a data attribute, so the tokens cascade exactly as they will on the
//    published site — and so nothing here writes a `style` prop.

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react';
import { buildSilicaThemeCssFromTheme } from '@wizeworks/site-themes';
import type { Node } from '@wizeworks/silicaui-html';
import { defaultMakeId, stampTree } from '@wizeworks/silicaui-html';
import type { TreeDoc } from '../../documents/types';
import { docKey } from '../../documents/types';
import { resolveCanvas } from '../../resolve/chain';
import { collectIds, findNode, findPlace, isAddressable } from '../../tree/walk';
import {
  useApply,
  useDoc,
  useDocSnapshot,
  useResolutionVersion,
  useSelect,
  useStudioHost,
  useStudioSession,
} from '../context';
import { useDragCargo, useDragSource, useDropZone } from '../drag/pointer-drag';
import { dropPosition, resolveDropTarget, siblingAxis, type Point } from './drop';
import { boxOf, idOfElement, nodeElementAt, siblingBoxes } from './hit';
import { useInlineText } from './use-inline-text';
import { renderNode, type DropHint, type RenderContext } from './render-node';

/** The MIME type a palette drag carries its node under. */
export const NODE_DRAG_TYPE = 'application/x-studio-node';

/** The three the Inspector can also EDIT at — silica's `BREAKPOINT_CHOICES`
 *  names the same three, so what you change is always something the canvas can
 *  show you. */
export type CanvasDevice = 'mobile' | 'tablet' | 'desktop';

/**
 * The frame's real width per device. Literal strings — a computed width class
 * compiles to nothing and the canvas silently stops resizing.
 *
 * These are the widths that DECIDE the reflow, because the frame is a
 * `@container`: the tree's `@3xl:` rules need 768px and its `@5xl:` rules need
 * 1024px before they apply to anything.
 *
 * So a device width may never be clamped to the pane. `desktop: w-full` and a
 * `max-w-full` on the other two meant that in the default docked layout — where
 * the canvas gets about 700px between the rails — Phone, Tablet and Computer all
 * rendered the SAME base design. Nothing was broken enough to notice: the
 * Inspector said "Editing what changes on desktop", the edit landed correctly in
 * the tree, and the canvas simply could not show it. An author setting a heading
 * smaller on the computer watched nothing happen and concluded the control did
 * not work.
 *
 * Wider than the pane now scrolls, which is honest — a phone frame that is not
 * 390px across is not a phone. Desktop still GROWS to fill a maximized pane; it
 * just never shrinks below the width that makes it desktop.
 */
export const DEVICE_CLASS: Record<CanvasDevice, string> = {
  desktop: 'w-full min-w-[1280px]',
  tablet: 'w-[834px]',
  mobile: 'w-[390px]',
};

/** The console's own selection colors, handed to the canvas subtree as custom
 *  properties. Literal, because Tailwind reads source text. */
const CHROME_VARS = '[--studio-select:var(--color-primary)] [--studio-drop:var(--color-secondary)]';

/** Void tags cannot take a drop inside them. */
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'source', 'track', 'wbr', 'embed', 'col']);

/**
 * Which of the theme's two palettes the canvas paints in.
 *
 * `light` by default, and EXPLICIT either way — never the theme's own name.
 * silica emits the dark delta under `[data-theme="dark"]` AND under
 * `@media (prefers-color-scheme:dark){…:not([data-theme="light"])}`, so a frame
 * marked with anything else fails the guard: on an author whose computer is set
 * to dark, every page, layout and piece silently painted the theme's NIGHT
 * colours while the theme pane beside it, correctly marked, showed the day ones.
 * Editing a colour then appeared to do nothing on the page — the value changed,
 * and the rule the author was looking at came from the other bag.
 *
 * The theme island already carried this fix. The canvas is the second place that
 * needed it.
 */
export type CanvasMode = 'light' | 'dark';

export function Canvas({
  device = 'desktop',
  mode = 'light',
}: {
  device?: CanvasDevice;
  mode?: CanvasMode;
}) {
  const session = useStudioSession();
  const host = useStudioHost();
  const doc = useDoc<TreeDoc>();
  const { selection } = useDocSnapshot();
  const apply = useApply();
  const select = useSelect();

  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const scope = useId().replace(/:/g, '');

  // `version` is the dependency that makes this live. The session is one object
  // for the life of the site, so without it the canvas resolved the theme, the
  // chrome and the saved-piece library ONCE and then never looked again — a piece
  // saved a moment ago drew as "no longer available", and a token edited in the
  // theme pane did not reach an open page until something else re-rendered it.
  const version = useResolutionVersion();
  const resolution = useMemo(
    () => resolveCanvas(session, doc, { fallbackTheme: host.fallbackTheme }),
    // `version` stands in for the session's mutable interior, which React cannot
    // see into — so it reads as unnecessary and is the opposite.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, doc, host.fallbackTheme, version]
  );

  // Only the ids in THIS document are editable. On a page inside chrome that is
  // the body; on a layout or a component it is everything, so the set is null.
  const editableIds = useMemo(
    () => (resolution.editableRootId ? collectIds(doc.root) : null),
    [resolution.editableRootId, doc.root]
  );

  const themeCss = useMemo(
    () =>
      buildSilicaThemeCssFromTheme(resolution.theme, {
        rootSelector: `[data-studio-canvas="${scope}"]`,
      }),
    [resolution.theme, scope]
  );

  // Drag scoped to THIS document (`docKey`), never to "a tree". Two builders are
  // routinely docked side by side, and a block dragged across the gap between them
  // would otherwise draw a drop indicator on a page it can never land in.
  const surface = docKey(doc);
  const cargo = useDragCargo();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);

  const editable = useCallback(
    (id: string | undefined): boolean => Boolean(id && (!editableIds || editableIds.has(id))),
    [editableIds]
  );

  // Typing into the page itself. Everything about it — which nodes take a caret,
  // what Enter and Escape mean, how a paste is flattened — lives in the hook.
  const text = useInlineText({
    frameRef,
    container: scroller,
    root: doc.root,
    editable,
    select,
    apply,
  });

  const ctx: RenderContext = {
    host,
    symbols: resolution.symbols,
    selectedIds: selection,
    hoverId,
    editableIds,
    dropHint,
    editingId: text.editingId,
    liftedId: cargo?.surface === surface ? (cargo.moveId ?? null) : null,
  };

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      // The canvas is a design surface, not a browsing one. Every `<a href>` in the
      // tree is a REAL link, and the site's own paths sit on the console's origin,
      // so clicking a nav item navigated the whole workbench to `/about` — the pane
      // and any unsaved work with it. It read as "links cannot be selected": the
      // browser tore the pane down before the selection could show. Buttons that
      // submit and checkboxes that toggle are the same class of thing.
      event.preventDefault();
      const frame = frameRef.current;
      if (!frame) return;
      const id = idOfElement(nodeElementAt(event.target, frame));
      // A click inside the words being typed is the author moving their caret,
      // not choosing a different block.
      if (id && id === text.editingId) return;
      // Clicking the chrome, or the padding around the page, clears the selection —
      // which is what makes the inspector's document-level tabs reachable.
      select(editable(id) && id ? [id] : []);
    },
    [editable, select, text.editingId]
  );

  const onPointerMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const frame = frameRef.current;
      if (!frame) return;
      const id = idOfElement(nodeElementAt(event.target, frame));
      setHoverId(editable(id) && id ? id : null);
    },
    [editable]
  );

  const onDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const frame = frameRef.current;
      if (!frame) return;
      // Dragging across words is how a mouse selects them. While a node is being
      // typed into, that gesture belongs to the caret rather than to the block.
      if (text.editingId) {
        event.preventDefault();
        return;
      }
      const id = idOfElement(nodeElementAt(event.target, frame));
      if (!editable(id) || !id) {
        event.preventDefault();
        return;
      }
      const node = findNode(doc.root, id);
      if (node?.locked) {
        event.preventDefault();
        return;
      }
      draggingRef.current = id;
      event.dataTransfer.effectAllowed = 'move';
      // Firefox refuses to start a drag with an empty payload.
      event.dataTransfer.setData('text/plain', id);
    },
    [doc.root, editable, text.editingId]
  );

  /**
   * The hint for a point over the canvas, or null if nothing there takes it.
   *
   * A POINT and a target, rather than an event — because the two inputs report
   * position differently. A mouse drag names `event.target`; a finger drag has its
   * pointer captured by the row it started on, so what is underneath has to be
   * looked up. Feeding both into one function is what stops "where does this land"
   * from having two answers.
   */
  const hintAt = useCallback(
    (point: Point, target: EventTarget | null): DropHint | null => {
      const frame = frameRef.current;
      if (!frame) return null;
      const element = nodeElementAt(target, frame);
      const id = idOfElement(element);
      if (!element || !editable(id) || !id) return null;

      const node = findNode(doc.root, id);
      if (!node) return null;

      const canHold =
        node.kind === 'element' && !VOID_TAGS.has(node.tag.toLowerCase()) && !node.instanceOf;
      const isEmpty = !(node.children ?? []).length;
      const axis = siblingAxis(boxOf(element), siblingBoxes(element));
      const position = dropPosition(point, boxOf(element), axis, { canHold, isEmpty });
      return { targetId: id, position };
    },
    [doc.root, editable]
  );

  /** What a point is over, for a gesture whose pointer is captured elsewhere. */
  const under = useCallback((point: Point) => document.elementFromPoint(point.x, point.y), []);

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const hint = hintAt({ x: event.clientX, y: event.clientY }, event.target);
      if (!hint) {
        setDropHint(null);
        return;
      }
      // Without preventDefault the browser refuses the drop and the whole gesture
      // ends in the "return to origin" animation with nothing reported.
      event.preventDefault();
      event.dataTransfer.dropEffect = draggingRef.current ? 'move' : 'copy';
      setDropHint((current) =>
        current?.targetId === hint.targetId && current.position === hint.position ? current : hint
      );
    },
    [hintAt]
  );

  /**
   * Land a drag. ONE path, whichever input started it.
   *
   * A new node from a palette, or an id already in the tree — never both. Adding
   * is a copy and moving is not, and telling those apart is the whole question a
   * drop answers.
   */
  const commit = useCallback(
    (hint: DropHint | null, movingId: string | null, incoming: Node | null) => {
      setDropHint(null);
      if (!hint) return;
      const target = targetPlace(doc.root, hint.targetId);
      if (!target) return;

      if (incoming) {
        const stamped = stampTree(
          host.onInsert?.(incoming) ?? incoming,
          host.makeId ?? defaultMakeId
        );
        if (!isAddressable(stamped) || !stamped.id) return;
        const resolved = resolveDropTarget(hint.position, target);
        if (!resolved) return;
        if (!apply('Add block', [{ kind: 'node.insert', node: stamped, ...resolved }])) return;
        select([stamped.id]);
        return;
      }

      if (!movingId || movingId === hint.targetId) return;
      const resolved = resolveDropTarget(hint.position, target, targetPlace(doc.root, movingId));
      if (!resolved) return;
      if (!apply('Move block', [{ kind: 'node.move', id: movingId, ...resolved }])) return;
      select([movingId]);
    },
    [apply, doc.root, host, select]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const hint = hintAt({ x: event.clientX, y: event.clientY }, event.target);
      const movingId = draggingRef.current;
      draggingRef.current = null;
      const payload = movingId ? '' : event.dataTransfer.getData(NODE_DRAG_TYPE);
      commit(hint, movingId, payload ? parseNode(payload) : null);
    },
    [commit, hintAt]
  );

  // ---- the same gestures, by finger --------------------------------------
  const liftFrom = useCallback(
    (event: { target: EventTarget | null }): { surface: string; moveId: string } | null => {
      const frame = frameRef.current;
      if (!frame) return null;
      if (text.editingId) return null;
      const id = idOfElement(nodeElementAt(event.target, frame));
      if (!editable(id) || !id) return null;
      const node = findNode(doc.root, id);
      if (!node || node.locked) return null;
      return { surface, moveId: id };
    },
    [doc.root, editable, surface, text.editingId]
  );
  const dragSource = useDragSource(liftFrom);

  useDropZone(scroller, {
    surface,
    onOver: (point) => setDropHint(hintAt(point, under(point))),
    onLeave: () => setDropHint(null),
    onDrop: (point, dragged) =>
      commit(
        hintAt(point, under(point)),
        dragged.moveId ?? null,
        (dragged.node as Node | undefined) ?? null
      ),
  });

  return (
    /* A click here SELECTS a node on a design surface, and the keyboard route to
       the same thing is the Layers rail beside it — a real `role="tree"` with
       arrow keys, Enter and F2 — plus the pane's own shortcuts. Selection is
       deliberately NOT reachable from this div's own key handler: that would put
       a second, worse route to the same nodes in the tab order.

       The `onKeyDown` here does something else entirely — it belongs to the
       caret, and only ever fires for a node already being typed into, where
       Enter and Escape have to mean finish and put-it-back rather than reaching
       the pane's block shortcuts. */
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      // `application`, because that is what it is: a design surface where the
      // arrow keys, Delete and ⌘Z mean what the editor says rather than what a
      // document reader would assume. The pane owns those bindings (`shortcuts.ts`),
      // and the Layers rail beside it is the keyboard route to every node.
      role="application"
      aria-label="Page canvas"
      // `--studio-*` are declared HERE, outside `data-studio-canvas`, so they carry
      // the console's colors rather than the theme being edited. See `stateClasses`.
      ref={setScroller}
      // Focusable only in code (-1, so it stays out of the tab order): finishing
      // an inline edit hands focus back here, which is what keeps the pane's own
      // shortcuts alive afterwards.
      tabIndex={-1}
      className={`bg-base-200 h-full min-h-0 overflow-auto p-6 outline-none ${CHROME_VARS}`}
      onClick={onClick}
      onDoubleClick={text.onDoubleClick}
      onKeyDown={text.onKeyDown}
      onBlur={text.onBlur}
      onPaste={text.onPaste}
      onMouseMove={onPointerMove}
      onMouseLeave={() => setHoverId(null)}
      {...dragSource}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={() => setDropHint(null)}
      onDrop={onDrop}
    >
      {/* A real stylesheet, scoped by attribute — so the tokens cascade exactly as
          they will on the published site, and nothing writes a `style` prop. */}
      <style>{themeCss}</style>
      {resolution.missingLayoutId ? (
        <div className="border-warning bg-warning/15 text-base-content mx-auto mb-4 max-w-3xl rounded-lg border p-4 text-sm">
          This page points at a header and footer that no longer exist, so it is drawing bare.
          Choose one under Page settings.
        </div>
      ) : null}
      <div
        ref={frameRef}
        data-studio-canvas={scope}
        data-theme={mode}
        className={`bg-base-100 text-base-content @container mx-auto min-h-full ${DEVICE_CLASS[device]}`}
      >
        {renderNode(resolution.root, ctx)}
      </div>
    </div>
  );
}

/** A palette payload, or null when it is not a node at all. */
function parseNode(payload: string): Node | null {
  try {
    return JSON.parse(payload) as Node;
  } catch {
    return null;
  }
}

/** Where a node sits, in the shape `resolveDropTarget` wants. */
function targetPlace(
  root: Node,
  id: string
): { id: string; parentId?: string; indexInParent: number } | undefined {
  const place = findPlace(root, id);
  if (!place) return undefined;
  return {
    id,
    ...(place.parent?.id ? { parentId: place.parent.id } : {}),
    indexInParent: place.index,
  };
}
