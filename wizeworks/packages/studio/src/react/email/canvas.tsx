'use client';

// The email canvas.
//
// Two things it deliberately is NOT:
//
//  · Not the sent HTML. That is table-based markup shaped by Outlook's rendering
//    engine, and the Preview is where it is checked. This is the surface the
//    author DECIDES on — order, colour, spacing, and what the merge tags say.
//  · Not styled by inline `style`. Every authored value goes into a stylesheet
//    scoped to this canvas by attribute (`style.ts`), the same way the site
//    canvas scopes its theme.
//
// The device switch changes the canvas WIDTH, not the document. An email's own
// width is a field on the body, and a phone simply shows less of it — which is
// what makes the narrow view an honest check rather than a second design.
//
// There is no Light/Dark switch here, and that is not an omission. A site canvas
// has two palettes to choose between because a theme carries a dark delta; an
// email carries no theme at all — every colour is authored literally on the node,
// because email HTML cannot ship CSS custom properties. A mode switch would be a
// control with nothing behind it.

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react';
import { defaultMakeId } from '@wizeworks/silicaui-html';
import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import type { EmailDoc } from '../../documents/types';
import { docKey } from '../../documents/types';
import { resolveEmailDrop } from '../../email/drop';
import { stampEmailTree } from '../../email/edit';
import { emailChildren, findEmailNode, isEmailContainer } from '../../email/walk';
import { useApply, useDoc, useDocSnapshot, useSelect, useStudioHost } from '../context';
import { dropPosition, siblingAxis, type Point } from '../canvas/drop';
import { useDragCargo, useDragSource, useDropZone } from '../drag/pointer-drag';
import { boxOf, siblingBoxes } from '../canvas/hit';
import type { CanvasDevice } from '../canvas/canvas';
import { renderEmailNode, type EmailDropHint, type EmailRenderContext } from './render';
import { emailStylesheet } from './style';

/** The console's own selection colors, handed to the email subtree as custom
 *  properties. Literal, because Tailwind reads source text. */
const CHROME_VARS = '[--studio-select:var(--color-primary)] [--studio-drop:var(--color-secondary)]';

/** The MIME type an email palette drag carries its node under. */
export const EMAIL_DRAG_TYPE = 'application/x-studio-email-node';

/**
 * The frame width per device. Never clamped to the pane: `max-w-full` collapsed
 * Tablet onto Desktop in any pane under 834px, so two of the three buttons drew
 * the same thing and the switch looked broken.
 *
 * Desktop stays `w-full` here, unlike the site canvas. An email has no container
 * queries to activate — its width is a field on the body — so "desktop" honestly
 * means "as much room as there is".
 */
const DEVICE_CLASS: Record<CanvasDevice, string> = {
  desktop: 'w-full',
  tablet: 'w-[834px]',
  mobile: 'w-[390px]',
};

/** The nearest email node element at or above `target`, within `root`. */
function emailElementAt(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  if (!(target instanceof globalThis.Node)) return null;
  const start = target instanceof HTMLElement ? target : target.parentElement;
  const found = start?.closest<HTMLElement>('[data-enode]') ?? null;
  return found && root.contains(found) ? found : null;
}

/** A palette payload, or null when it is not a node at all. */
function parseEmailNode(payload: string): EmailNode | null {
  try {
    return JSON.parse(payload) as EmailNode;
  } catch {
    return null;
  }
}

export function EmailCanvas({ device = 'desktop' }: { device?: CanvasDevice }) {
  const host = useStudioHost();
  const doc = useDoc<EmailDoc>();
  const { selection } = useDocSnapshot();
  const apply = useApply();
  const select = useSelect();

  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<EmailDropHint | null>(null);
  const scope = useId().replace(/:/g, '');

  const root = doc.document.root;
  const css = useMemo(() => emailStylesheet(root, scope), [root, scope]);

  // Drag scoped to THIS document, never to "an email": two builders dock side by
  // side, and a block dragged across the gap would otherwise draw a drop indicator
  // on an email it can never land in.
  const surface = docKey(doc);
  const cargo = useDragCargo();
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);

  const ctx: EmailRenderContext = {
    preview: host.emailPreview,
    selectedIds: selection,
    hoverId,
    dropHint,
    liftedId: cargo?.surface === surface ? (cargo.moveId ?? null) : null,
  };

  const idAt = useCallback((target: EventTarget | null): string | undefined => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    return emailElementAt(target, frame)?.dataset.enode;
  }, []);

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      // An email body is full of real links too — and one of them navigating the
      // console away mid-edit is the same defect as on the page canvas.
      event.preventDefault();
      // Clicking the wallpaper around the email clears the selection, which is what
      // makes the Inspector's document-level fields — subject, preview line —
      // reachable without a drawer of their own.
      const id = idAt(event.target);
      select(id ? [id] : []);
    },
    [idAt, select]
  );

  const onDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const id = idAt(event.target);
      const node = id ? findEmailNode(root, id) : undefined;
      if (!id || !node || node.locked || node.kind === 'body') {
        event.preventDefault();
        return;
      }
      draggingRef.current = id;
      event.dataTransfer.effectAllowed = 'move';
      // Firefox refuses to start a drag with an empty payload.
      event.dataTransfer.setData('text/plain', id);
    },
    [idAt, root]
  );

  /**
   * The hint for a point over the email, or null if nothing there takes it.
   *
   * A point and a target rather than an event: a mouse drag names `event.target`,
   * and a finger drag has its pointer captured by the block it started on, so what
   * is underneath has to be looked up. One rule, two inputs.
   */
  const hintAt = useCallback(
    (point: Point, target: EventTarget | null): EmailDropHint | null => {
      const frame = frameRef.current;
      if (!frame) return null;
      const element = emailElementAt(target, frame);
      const id = element?.dataset.enode;
      if (!element || !id) return null;
      const node = findEmailNode(root, id);
      if (!node) return null;

      const axis = siblingAxis(boxOf(element), siblingBoxes(element));
      const position = dropPosition(point, boxOf(element), axis, {
        canHold: isEmailContainer(node),
        isEmpty: emailChildren(node).length === 0,
      });
      return { targetId: id, position };
    },
    [root]
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
      // Without preventDefault the browser refuses the drop and the gesture ends in
      // the "return to origin" animation with nothing reported.
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
   * A new block from the palette, or an id already in the email — never both.
   * Adding is a copy and moving is not, and telling those apart is the whole
   * question a drop answers.
   */
  const commit = useCallback(
    (hint: EmailDropHint | null, movingId: string | null, incoming: EmailNode | null) => {
      setDropHint(null);
      if (!hint) return;

      if (incoming) {
        const stamped = stampEmailTree(incoming, host.makeId ?? defaultMakeId);
        const slot = resolveEmailDrop(root, hint, stamped);
        if (!slot) return;
        if (apply('Add block', [{ kind: 'email.insert', node: stamped, ...slot }])) {
          select([stamped.id]);
        }
        return;
      }

      if (!movingId || movingId === hint.targetId) return;
      const moving = findEmailNode(root, movingId);
      if (!moving) return;
      const slot = resolveEmailDrop(root, hint, moving, { id: movingId });
      if (!slot) return;
      if (apply('Move block', [{ kind: 'email.move', id: movingId, ...slot }])) select([movingId]);
    },
    [apply, host.makeId, root, select]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const hint = hintAt({ x: event.clientX, y: event.clientY }, event.target);
      const movingId = draggingRef.current;
      draggingRef.current = null;
      const payload = movingId ? '' : event.dataTransfer.getData(EMAIL_DRAG_TYPE);
      commit(hint, movingId, payload ? parseEmailNode(payload) : null);
    },
    [commit, hintAt]
  );

  // ---- the same gestures, by finger --------------------------------------
  const liftFrom = useCallback(
    (event: { target: EventTarget | null }): { surface: string; moveId: string } | null => {
      const id = idAt(event.target);
      const node = id ? findEmailNode(root, id) : undefined;
      // The body is the email. It has nowhere to go.
      if (!id || !node || node.locked || node.kind === 'body') return null;
      return { surface, moveId: id };
    },
    [idAt, root, surface]
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
        (dragged.node as EmailNode | undefined) ?? null
      ),
  });

  return (
    /* A click here SELECTS a block on a design surface; the keyboard route to the
       same blocks is the Layers rail beside it, plus the pane's own shortcuts. */
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      role="application"
      aria-label="Email canvas"
      // Declared outside the email's own stylesheet scope, so the selection chrome
      // wears the console's colors rather than anything the email sets. See
      // `stateClasses` in ./render.tsx.
      ref={setScroller}
      className={`bg-base-200 h-full min-h-0 overflow-auto p-6 ${CHROME_VARS}`}
      onClick={onClick}
      onMouseMove={(event) => setHoverId(idAt(event.target) ?? null)}
      onMouseLeave={() => setHoverId(null)}
      {...dragSource}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={() => setDropHint(null)}
      onDrop={onDrop}
    >
      <style>{css}</style>
      <div
        ref={frameRef}
        data-studio-email={scope}
        className={`mx-auto min-h-full ${DEVICE_CLASS[device]}`}
      >
        {renderEmailNode(root, ctx)}
      </div>
    </div>
  );
}
