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
import { resolveCanvas } from '../../resolve/chain';
import { collectIds, findNode, findPlace, isAddressable } from '../../tree/walk';
import {
  useApply,
  useDoc,
  useDocSnapshot,
  useSelect,
  useStudioHost,
  useStudioSession,
} from '../context';
import { dropPosition, resolveDropTarget, siblingAxis, type DropPosition } from './drop';
import { boxOf, idOfElement, nodeElementAt, siblingBoxes } from './hit';
import { renderNode, type DropHint, type RenderContext } from './render-node';

/** The MIME type a palette drag carries its node under. */
export const NODE_DRAG_TYPE = 'application/x-studio-node';

/** The three the Inspector can also EDIT at — silica's `BREAKPOINT_CHOICES`
 *  names the same three, so what you change is always something the canvas can
 *  show you. */
export type CanvasDevice = 'mobile' | 'tablet' | 'desktop';

/** Literal strings — a computed width class compiles to nothing and the canvas
 *  silently stops resizing. */
const DEVICE_CLASS: Record<CanvasDevice, string> = {
  desktop: 'w-full',
  tablet: 'w-[834px] max-w-full',
  mobile: 'w-[390px] max-w-full',
};

/** Void tags cannot take a drop inside them. */
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'source', 'track', 'wbr', 'embed', 'col']);

export function Canvas({ device = 'desktop' }: { device?: CanvasDevice }) {
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

  const resolution = useMemo(
    () => resolveCanvas(session, doc, { fallbackTheme: host.fallbackTheme }),
    [session, doc, host.fallbackTheme]
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

  const ctx: RenderContext = {
    host,
    symbols: resolution.symbols,
    selectedIds: selection,
    hoverId,
    editableIds,
    dropHint,
  };

  const editable = useCallback(
    (id: string | undefined): boolean => Boolean(id && (!editableIds || editableIds.has(id))),
    [editableIds]
  );

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const frame = frameRef.current;
      if (!frame) return;
      const id = idOfElement(nodeElementAt(event.target, frame));
      // Clicking the chrome, or the padding around the page, clears the selection —
      // which is what makes the inspector's document-level tabs reachable.
      select(editable(id) && id ? [id] : []);
    },
    [editable, select]
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
    [doc.root, editable]
  );

  /** The hint for wherever the pointer currently is, or null if nothing takes it. */
  const hintFor = useCallback(
    (event: DragEvent<HTMLDivElement>): DropHint | null => {
      const frame = frameRef.current;
      if (!frame) return null;
      const element = nodeElementAt(event.target, frame);
      const id = idOfElement(element);
      if (!element || !editable(id) || !id) return null;

      const node = findNode(doc.root, id);
      if (!node) return null;

      const canHold =
        node.kind === 'element' && !VOID_TAGS.has(node.tag.toLowerCase()) && !node.instanceOf;
      const isEmpty = !(node.children ?? []).length;
      const axis = siblingAxis(boxOf(element), siblingBoxes(element));
      const position = dropPosition({ x: event.clientX, y: event.clientY }, boxOf(element), axis, {
        canHold,
        isEmpty,
      });
      return { targetId: id, position };
    },
    [doc.root, editable]
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const hint = hintFor(event);
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
    [hintFor]
  );

  /** A palette drag: stamp fresh ids, let the host rewrite it, and insert. */
  const insertFromPalette = useCallback(
    (payload: string, position: DropPosition, target: ReturnType<typeof targetPlace>) => {
      if (!target) return;
      let parsed: Node;
      try {
        parsed = JSON.parse(payload) as Node;
      } catch {
        return;
      }
      const stamped = stampTree(host.onInsert?.(parsed) ?? parsed, host.makeId ?? defaultMakeId);
      if (!isAddressable(stamped) || !stamped.id) return;
      const resolved = resolveDropTarget(position, target);
      if (!resolved) return;
      if (!apply('Add block', [{ kind: 'node.insert', node: stamped, ...resolved }])) return;
      select([stamped.id]);
    },
    [apply, host, select]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const hint = hintFor(event);
      setDropHint(null);
      const movingId = draggingRef.current;
      draggingRef.current = null;
      if (!hint) return;

      const target = targetPlace(doc.root, hint.targetId);
      if (!target) return;

      const payload = event.dataTransfer.getData(NODE_DRAG_TYPE);
      if (payload && !movingId) {
        insertFromPalette(payload, hint.position, target);
        return;
      }
      if (!movingId || movingId === hint.targetId) return;

      const moving = targetPlace(doc.root, movingId);
      const resolved = resolveDropTarget(hint.position, target, moving);
      if (!resolved) return;
      if (!apply('Move block', [{ kind: 'node.move', id: movingId, ...resolved }])) return;
      select([movingId]);
    },
    [apply, doc.root, hintFor, insertFromPalette, select]
  );

  return (
    /* A click here SELECTS a node on a design surface, and the keyboard route to
       the same thing is the Layers rail beside it — a real `role="tree"` with
       arrow keys, Enter and F2 — plus the pane's own shortcuts. A key handler on
       this div would put a second, worse route to the same nodes in the tab
       order, which is why the rule is answered rather than obeyed here. */
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      // `application`, because that is what it is: a design surface where the
      // arrow keys, Delete and ⌘Z mean what the editor says rather than what a
      // document reader would assume. The pane owns those bindings (`shortcuts.ts`),
      // and the Layers rail beside it is the keyboard route to every node.
      role="application"
      aria-label="Page canvas"
      className="bg-base-200 h-full min-h-0 overflow-auto p-6"
      onClick={onClick}
      onMouseMove={onPointerMove}
      onMouseLeave={() => setHoverId(null)}
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
        data-theme={resolution.theme.name}
        className={`bg-base-100 text-base-content @container mx-auto min-h-full ${DEVICE_CLASS[device]}`}
      >
        {renderNode(resolution.root, ctx)}
      </div>
    </div>
  );
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
