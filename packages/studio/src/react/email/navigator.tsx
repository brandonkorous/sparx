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

import { useCallback, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Input } from '@wizeworks/silicaui-react';
import type { EmailDoc } from '../../documents/types';
import { resolveEmailDrop } from '../../email/drop';
import { emailChildren, findEmailNode } from '../../email/walk';
import { useApply, useDoc, useDocSnapshot, useSelect } from '../context';
import { dropPosition, type DropPosition } from '../canvas/drop';
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

  const root = doc.document.root;
  const rows = useMemo(() => emailLayerRows(root), [root]);

  const onRowDragOver = useCallback(
    (event: DragEvent<HTMLLIElement>, row: EmailLayerRow) => {
      const moving = draggingRef.current;
      if (!moving || moving === row.id) return;
      const node = findEmailNode(root, row.id);
      if (!node) return;

      const box = event.currentTarget.getBoundingClientRect();
      const where = dropPosition(
        { x: event.clientX, y: event.clientY },
        { top: box.top, left: box.left, width: box.width, height: box.height },
        'y',
        { canHold: row.container, isEmpty: emailChildren(node).length === 0 }
      );
      event.preventDefault();
      setDropHint((current) =>
        current?.id === row.id && current.where === where ? current : { id: row.id, where }
      );
    },
    [root]
  );

  const onRowDrop = useCallback(
    (event: DragEvent<HTMLLIElement>, row: EmailLayerRow) => {
      event.preventDefault();
      const hint = dropHint;
      const moving = draggingRef.current;
      draggingRef.current = null;
      setDropHint(null);
      if (!moving || hint?.id !== row.id || moving === row.id) return;

      const node = findEmailNode(root, moving);
      if (!node) return;
      const slot = resolveEmailDrop(root, { targetId: row.id, position: hint.where }, node, {
        id: moving,
      });
      if (!slot) return;
      apply('Move block', [{ kind: 'email.move', id: moving, ...slot }]);
    },
    [apply, dropHint, root]
  );

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
        role="tree"
        aria-label="Email layers"
        className="min-h-0 flex-1 overflow-auto p-1"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {rows.map((row) => (
          <li
            key={row.id}
            role="treeitem"
            aria-selected={selection.includes(row.id)}
            aria-level={row.depth + 1}
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
            onDragOver={(event) => onRowDragOver(event, row)}
            onDragLeave={() => setDropHint(null)}
            onDrop={(event) => onRowDrop(event, row)}
            onClick={() => select([row.id])}
            onDoubleClick={() => setRenaming(row.id)}
            onKeyDown={(event) => {
              // Enter selects, F2 renames — the same two things a click and a
              // double-click do, so the rail works without a pointer.
              if (event.key === 'Enter') select([row.id]);
              if (event.key === 'F2') setRenaming(row.id);
            }}
            className={rowClasses(row, selection.includes(row.id), dropHint)}
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
  hint: { id: string; where: DropPosition } | null
): string {
  const indent = ['pl-2', 'pl-5', 'pl-8', 'pl-11', 'pl-14', 'pl-17', 'pl-20'];
  const classes = [
    'flex cursor-pointer items-center gap-2 rounded py-1 pr-2',
    indent[Math.min(row.depth, indent.length - 1)] ?? 'pl-20',
    selected ? 'bg-primary text-primary-content' : 'hover:bg-base-200',
  ];
  const where = hint?.id === row.id ? hint.where : null;
  if (where === 'before') classes.push('border-secondary border-t-2');
  if (where === 'after') classes.push('border-secondary border-b-2');
  if (where === 'inside') classes.push('outline-secondary outline outline-2 outline-dashed');
  return classes.join(' ');
}
