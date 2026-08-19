'use client';

// The email Navigator — the layer list.
//
// Two-way bound to the store: click a row and the canvas selects it; select on
// the canvas and the row highlights. Both read one store, so there is nothing to
// keep in step.
//
// Rows are drag sources AND drop targets, on the same climbing rule the canvas
// uses (`resolveEmailDrop`). A second rule here would let "drop between" mean two
// different things in two places — and in a closed vocabulary, where half of all
// aimed drops are illegal, that difference is what an author would feel.
//
// By finger as well as by mouse. Touch is never delivered the browser's own drag,
// so this rail could select and rename but not REORDER — press and hold a row to
// lift it.

import { useCallback, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Input } from '@wizeworks/silicaui-react';
import type { EmailDoc } from '../../documents/types';
import { docKey } from '../../documents/types';
import { resolveEmailDrop } from '../../email/drop';
import { emailChildren, findEmailNode } from '../../email/walk';
import { useApply, useDoc, useDocSnapshot, useSelect } from '../context';
import { dropPosition, type DropPosition, type Point } from '../canvas/drop';
import { useDragCargo, useDragSource, useDropZone } from '../drag/pointer-drag';
import { StudioIcon } from '../icon';
import { emailLayerRows, type EmailLayerRow } from './layers';

export function EmailNavigator() {
  const doc = useDoc<EmailDoc>();
  const { selection } = useDocSnapshot();
  const apply = useApply();
  const select = useSelect();

  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; where: DropPosition } | null>(null);
  const draggingRef = useRef<string | null>(null);
  const [list, setList] = useState<HTMLUListElement | null>(null);

  const root = doc.document.root;
  const rows = useMemo(() => emailLayerRows(root), [root]);

  /**
   * The hint for a point over one row, or null if that row cannot take the drop.
   *
   * A point and an element rather than an event: a mouse drag names the row it is
   * over, and a finger drag has its pointer captured by the row it STARTED on, so
   * the row underneath has to be looked up.
   */
  const hintAt = useCallback(
    (point: Point, element: HTMLElement | null, moving: string | null) => {
      const id = element?.dataset.layerId;
      if (!element || !id || !moving || moving === id) return null;
      const node = findEmailNode(root, id);
      if (!node) return null;
      const box = element.getBoundingClientRect();
      const where = dropPosition(
        point,
        { top: box.top, left: box.left, width: box.width, height: box.height },
        'y',
        {
          canHold: element.dataset.layerContainer === 'true',
          isEmpty: emailChildren(node).length === 0,
        }
      );
      return { id, where };
    },
    [root]
  );

  /** Land a move. One path, whichever input started it. */
  const commit = useCallback(
    (hint: { id: string; where: DropPosition } | null, moving: string | null) => {
      setDropHint(null);
      if (!hint || !moving || moving === hint.id) return;
      const node = findEmailNode(root, moving);
      if (!node) return;
      const slot = resolveEmailDrop(root, { targetId: hint.id, position: hint.where }, node, {
        id: moving,
      });
      if (!slot) return;
      apply('Move block', [{ kind: 'email.move', id: moving, ...slot }]);
    },
    [apply, root]
  );

  const onRowDragOver = useCallback(
    (event: DragEvent<HTMLLIElement>) => {
      const hint = hintAt(
        { x: event.clientX, y: event.clientY },
        event.currentTarget,
        draggingRef.current
      );
      if (!hint) return;
      event.preventDefault();
      setDropHint((current) =>
        current?.id === hint.id && current.where === hint.where ? current : hint
      );
    },
    [hintAt]
  );

  const onRowDrop = useCallback(
    (event: DragEvent<HTMLLIElement>) => {
      event.preventDefault();
      const moving = draggingRef.current;
      draggingRef.current = null;
      commit(hintAt({ x: event.clientX, y: event.clientY }, event.currentTarget, moving), moving);
    },
    [commit, hintAt]
  );

  // ---- the same gesture, by finger ---------------------------------------
  const surface = `${docKey(doc)}#layers`;
  const cargo = useDragCargo();
  const lifted = cargo?.surface === surface ? (cargo.moveId ?? null) : null;

  /** The row under a captured pointer. */
  const rowAt = useCallback((point: Point): HTMLElement | null => {
    const element = document.elementFromPoint(point.x, point.y);
    return element instanceof HTMLElement ? element.closest('[data-layer-id]') : null;
  }, []);

  const liftFrom = useCallback(
    (event: { target: EventTarget | null }) => {
      const row =
        event.target instanceof HTMLElement
          ? event.target.closest<HTMLElement>('[data-layer-id]')
          : null;
      const id = row?.dataset.layerId;
      // The body row does not lift. It is the email.
      if (!id || row?.dataset.layerLift !== 'true') return null;
      return { surface, moveId: id };
    },
    [surface]
  );
  const dragSource = useDragSource(liftFrom);

  useDropZone(list, {
    surface,
    onOver: (point, dragged) => setDropHint(hintAt(point, rowAt(point), dragged.moveId ?? null)),
    onLeave: () => setDropHint(null),
    onDrop: (point, dragged) =>
      commit(hintAt(point, rowAt(point), dragged.moveId ?? null), dragged.moveId ?? null),
  });

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const index = rows.findIndex((row) => row.id === selection[0]);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const next = rows[Math.min(Math.max(index + step, 0), rows.length - 1)];
      if (next) select([next.id]);
    },
    [rows, select, selection]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-base-300 border-b px-3 py-2">
        <span className="text-base-content text-sm font-medium">Layers</span>
      </div>

      {/* A real tree, not a list wearing click handlers — `role="tree"` plus one
          `treeitem` per row is what puts the arrow keys, the selected state and
          the nesting level in front of a screen reader. */}
      <ul
        ref={setList}
        role="tree"
        aria-label="Email layers"
        className="min-h-0 flex-1 overflow-auto p-1"
        tabIndex={0}
        onKeyDown={onKeyDown}
        {...dragSource}
      >
        {rows.map((row) => (
          <li
            key={row.id}
            role="treeitem"
            aria-selected={selection.includes(row.id)}
            aria-level={row.depth + 1}
            data-layer-id={row.id}
            data-layer-lift={!row.locked && row.depth > 0 ? 'true' : undefined}
            data-layer-container={row.container ? 'true' : undefined}
            draggable={!row.locked && row.depth > 0}
            onDragStart={(event) => {
              if (row.locked || row.depth === 0) {
                event.preventDefault();
                return;
              }
              draggingRef.current = row.id;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', row.id);
            }}
            onDragOver={onRowDragOver}
            onDragLeave={() => setDropHint(null)}
            onDrop={onRowDrop}
            onClick={() => select([row.id])}
            onDoubleClick={() => setRenaming(row.id)}
            onKeyDown={(event) => {
              // Enter selects, F2 renames — the same two things a click and a
              // double-click do, so the rail works without a pointer.
              if (event.key === 'Enter') select([row.id]);
              if (event.key === 'F2') setRenaming(row.id);
            }}
            className={rowClasses(row, selection.includes(row.id), dropHint, lifted === row.id)}
          >
            <span className="shrink-0 pl-1" aria-hidden>
              <StudioIcon name={row.icon} className="text-base-content/70 inline-flex size-4" />
            </span>
            {renaming === row.id ? (
              <RenameField
                row={row}
                onDone={(value) => {
                  setRenaming(null);
                  if (value !== null) {
                    apply('Rename block', [
                      { kind: 'email.patch', id: row.id, patch: { name: value || undefined } },
                    ]);
                  }
                }}
              />
            ) : (
              <span className="truncate text-sm">{row.label}</span>
            )}
            {row.locked ? (
              <StudioIcon
                name="lock"
                className="text-base-content/70 ml-auto inline-flex size-3.5"
              />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RenameField({
  row,
  onDone,
}: {
  row: EmailLayerRow;
  onDone: (value: string | null) => void;
}) {
  return (
    <Input
      size="sm"
      // A ref rather than `autoFocus`: the field exists only because the author
      // just asked to rename this row, so moving focus into it follows them.
      ref={(node: HTMLInputElement | null) => node?.select()}
      defaultValue={row.label}
      onBlur={(event) => onDone(event.currentTarget.value.trim())}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') onDone(null);
      }}
    />
  );
}

/** Every class a literal string, so a consuming app's Tailwind scan safelists it. */
function rowClasses(
  row: EmailLayerRow,
  selected: boolean,
  hint: { id: string; where: DropPosition } | null,
  lifted: boolean
): string {
  const indent = ['pl-2', 'pl-5', 'pl-8', 'pl-11', 'pl-14', 'pl-17', 'pl-20'];
  const classes = [
    'flex cursor-pointer items-center gap-2 rounded py-1 pr-2',
    indent[Math.min(row.depth, indent.length - 1)] ?? 'pl-20',
    selected ? 'bg-primary text-primary-content' : 'hover:bg-base-200',
  ];
  // Faded because it is ELSEWHERE — held under a finger. This is the hole it left.
  if (lifted) classes.push('opacity-50');
  const where = hint?.id === row.id ? hint.where : null;
  if (where === 'before') classes.push('border-secondary border-t-2');
  if (where === 'after') classes.push('border-secondary border-b-2');
  if (where === 'inside') classes.push('outline-secondary outline outline-2 outline-dashed');
  return classes.join(' ');
}
