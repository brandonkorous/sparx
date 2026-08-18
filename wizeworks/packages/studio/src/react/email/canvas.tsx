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
import { resolveEmailDrop } from '../../email/drop';
import { stampEmailTree } from '../../email/edit';
import { emailChildren, findEmailNode, isEmailContainer } from '../../email/walk';
import { useApply, useDoc, useDocSnapshot, useSelect, useStudioHost } from '../context';
import { dropPosition, siblingAxis } from '../canvas/drop';
import { boxOf, siblingBoxes } from '../canvas/hit';
import type { CanvasDevice } from '../canvas/canvas';
import { renderEmailNode, type EmailDropHint, type EmailRenderContext } from './render';
import { emailStylesheet } from './style';

/** The MIME type an email palette drag carries its node under. */
export const EMAIL_DRAG_TYPE = 'application/x-studio-email-node';

const DEVICE_CLASS: Record<CanvasDevice, string> = {
  desktop: 'w-full',
  tablet: 'w-[834px] max-w-full',
  mobile: 'w-[390px] max-w-full',
};

/** The nearest email node element at or above `target`, within `root`. */
function emailElementAt(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  if (!(target instanceof globalThis.Node)) return null;
  const start = target instanceof HTMLElement ? target : target.parentElement;
  const found = start?.closest<HTMLElement>('[data-enode]') ?? null;
  return found && root.contains(found) ? found : null;
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

  const ctx: EmailRenderContext = {
    preview: host.emailPreview,
    selectedIds: selection,
    hoverId,
    dropHint,
  };

  const idAt = useCallback((target: EventTarget | null): string | undefined => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    return emailElementAt(target, frame)?.dataset.enode;
  }, []);

  const onClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
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

  /** The hint for wherever the pointer currently is, or null if nothing takes it. */
  const hintFor = useCallback(
    (event: DragEvent<HTMLDivElement>): EmailDropHint | null => {
      const frame = frameRef.current;
      if (!frame) return null;
      const element = emailElementAt(event.target, frame);
      const id = element?.dataset.enode;
      if (!element || !id) return null;
      const node = findEmailNode(root, id);
      if (!node) return null;

      const axis = siblingAxis(boxOf(element), siblingBoxes(element));
      const position = dropPosition({ x: event.clientX, y: event.clientY }, boxOf(element), axis, {
        canHold: isEmailContainer(node),
        isEmpty: emailChildren(node).length === 0,
      });
      return { targetId: id, position };
    },
    [root]
  );

  const onDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const hint = hintFor(event);
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
    [hintFor]
  );

  /** A palette drag: stamp fresh ids, then find the deepest slot that takes it. */
  const insertFromPalette = useCallback(
    (payload: string, hint: EmailDropHint) => {
      let parsed: EmailNode;
      try {
        parsed = JSON.parse(payload) as EmailNode;
      } catch {
        return;
      }
      const stamped = stampEmailTree(parsed, host.makeId ?? defaultMakeId);
      const slot = resolveEmailDrop(root, hint, stamped);
      if (!slot) return;
      if (apply('Add block', [{ kind: 'email.insert', node: stamped, ...slot }])) {
        select([stamped.id]);
      }
    },
    [apply, host.makeId, root, select]
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const hint = hintFor(event);
      setDropHint(null);
      const movingId = draggingRef.current;
      draggingRef.current = null;
      if (!hint) return;

      const payload = event.dataTransfer.getData(EMAIL_DRAG_TYPE);
      if (payload && !movingId) {
        insertFromPalette(payload, hint);
        return;
      }
      if (!movingId || movingId === hint.targetId) return;

      const moving = findEmailNode(root, movingId);
      if (!moving) return;
      const slot = resolveEmailDrop(root, hint, moving, { id: movingId });
      if (!slot) return;
      if (apply('Move block', [{ kind: 'email.move', id: movingId, ...slot }])) select([movingId]);
    },
    [apply, hintFor, insertFromPalette, root, select]
  );

  return (
    /* A click here SELECTS a block on a design surface; the keyboard route to the
       same blocks is the Layers rail beside it, plus the pane's own shortcuts. */
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <div
      role="application"
      aria-label="Email canvas"
      className="bg-base-200 h-full min-h-0 overflow-auto p-6"
      onClick={onClick}
      onMouseMove={(event) => setHoverId(idAt(event.target) ?? null)}
      onMouseLeave={() => setHoverId(null)}
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
