'use client';

// The Navigator — the layer list.
//
// Two-way bound to the store: click a row and the canvas selects it; select on
// the canvas and the row highlights. Both read the same store, so there is no
// sync to keep and nothing to get out of step.
//
// Rows are drag sources AND drop targets, on the same rule the canvas uses — a
// list is always vertical, so the axis is fixed and only the container band
// differs. Sharing `dropPosition` rather than writing a second rule is what stops
// "drop between" meaning two different things in two places.

import { useCallback, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { Button, Input } from '@wizeworks/silicaui-react';
import type { TreeDoc } from '../../documents/types';
import { collectIds, findNode, findPlace } from '../../tree/walk';
import { useApply, useDoc, useDocSnapshot, useSelect } from '../context';
import { dropPosition, resolveDropTarget } from '../canvas/drop';
import { StudioIcon } from '../icon';
import { layerRows, type LayerDepth, type LayerRow } from './layer-tree';

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'source', 'track', 'wbr', 'embed', 'col']);

export function Navigator() {
  const doc = useDoc<TreeDoc>();
  const { selection } = useDocSnapshot();
  const apply = useApply();
  const select = useSelect();

  const [depth, setDepth] = useState<LayerDepth>('simple');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; where: string } | null>(null);
  const draggingRef = useRef<string | null>(null);

  // The Navigator lists THIS document only. Chrome around a page body is another
  // document's tree, and listing it here would offer rows that refuse every edit.
  const rows = useMemo(
    () => layerRows(doc.root, { depth, editableIds: collectIds(doc.root) }),
    [doc.root, depth]
  );

  const onRowDragStart = useCallback((event: DragEvent<HTMLLIElement>, row: LayerRow) => {
    if (row.locked) {
      event.preventDefault();
      return;
    }
    draggingRef.current = row.id;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.id);
  }, []);

  const onRowDragOver = useCallback(
    (event: DragEvent<HTMLLIElement>, row: LayerRow) => {
      const moving = draggingRef.current;
      if (!moving || moving === row.id) return;
      const node = findNode(doc.root, row.id);
      if (!node) return;

      const box = event.currentTarget.getBoundingClientRect();
      const canHold =
        node.kind === 'element' && !VOID_TAGS.has(node.tag.toLowerCase()) && !node.instanceOf;
      const where = dropPosition(
        { x: event.clientX, y: event.clientY },
        { top: box.top, left: box.left, width: box.width, height: box.height },
        'y',
        { canHold, isEmpty: !(node.children ?? []).length }
      );
      event.preventDefault();
      setDropHint((current) =>
        current?.id === row.id && current.where === where ? current : { id: row.id, where }
      );
    },
    [doc.root]
  );

  const onRowDrop = useCallback(
    (event: DragEvent<HTMLLIElement>, row: LayerRow) => {
      event.preventDefault();
      const hint = dropHint;
      const moving = draggingRef.current;
      draggingRef.current = null;
      setDropHint(null);
      if (!moving || hint?.id !== row.id || moving === row.id) return;

      const target = findPlace(doc.root, row.id);
      const from = findPlace(doc.root, moving);
      if (!target) return;

      const resolved = resolveDropTarget(
        hint.where as 'before' | 'after' | 'inside',
        {
          id: row.id,
          ...(target.parent?.id ? { parentId: target.parent.id } : {}),
          indexInParent: target.index,
        },
        from
          ? {
              ...(from.parent?.id ? { parentId: from.parent.id } : {}),
              indexInParent: from.index,
            }
          : undefined
      );
      if (!resolved) return;
      apply('Move layer', [{ kind: 'node.move', id: moving, ...resolved }]);
    },
    [apply, doc.root, dropHint]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLUListElement>) => {
      const index = rows.findIndex((row) => row.id === selection[0]);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const next =
          rows[
            Math.min(Math.max(index + (event.key === 'ArrowDown' ? 1 : -1), 0), rows.length - 1)
          ];
        if (next) select([next.id]);
      }
    },
    [rows, select, selection]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-base-300 flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="text-base-content text-sm font-medium">Layers</span>
        {/* A secondary control: neither `color` nor `variant`, so a bare `.btn`
            resolves to `base-content` and stays theme-correct in both modes. */}
        <Button
          size="sm"
          onClick={() => setDepth((current) => (current === 'simple' ? 'all' : 'simple'))}
        >
          {depth === 'simple' ? 'Show every layer' : 'Show main layers'}
        </Button>
      </div>

      {/* A real tree, not a list wearing click handlers. `role="tree"` + one
          `treeitem` per row is what makes arrow keys, the selected state and the
          nesting level reach a screen reader — a `<ul>` with `onClick` announces
          none of it, and the rail is the only way to reach a node that is
          scrolled off the canvas. */}
      <ul
        role="tree"
        aria-label="Layers"
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
            draggable={!row.locked}
            onDragStart={(event) => onRowDragStart(event, row)}
            onDragOver={(event) => onRowDragOver(event, row)}
            onDragLeave={() => setDropHint(null)}
            onDrop={(event) => onRowDrop(event, row)}
            onClick={() => select([row.id])}
            onDoubleClick={() => setRenaming(row.id)}
            onKeyDown={(event) => {
              // Enter selects, F2 renames — the same two things a double-click and a
              // click do, so the rail is fully usable without a pointer.
              if (event.key === 'Enter') select([row.id]);
              if (event.key === 'F2') setRenaming(row.id);
            }}
            className={rowClasses(
              row,
              selection.includes(row.id),
              dropHint?.id === row.id ? dropHint.where : null
            )}
          >
            <span className="shrink-0 pl-1" aria-hidden>
              <StudioIcon name={row.icon} className="text-base-content/70 inline-flex size-4" />
            </span>
            {renaming === row.id ? (
              <Input
                size="sm"
                // A ref rather than `autoFocus`: the field only exists because the
                // author just asked to rename this row, so moving focus into it is
                // following them rather than stealing from them — but `autoFocus` is
                // a page-load affordance and the rule against it is about that.
                ref={(node: HTMLInputElement | null) => node?.select()}
                defaultValue={row.label}
                onBlur={(event) => {
                  const value = event.currentTarget.value.trim();
                  setRenaming(null);
                  apply('Rename layer', [
                    { kind: 'node.setLabel', id: row.id, value: value || undefined },
                  ]);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') setRenaming(null);
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
        {rows.length === 0 ? (
          <li className="text-base-content px-3 py-6 text-sm">
            Nothing here yet. Add something from Insert.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Every class a literal string, so a consuming app's Tailwind scan safelists it. */
function rowClasses(row: LayerRow, selected: boolean, drop: string | null): string {
  const indent = ['pl-2', 'pl-5', 'pl-8', 'pl-11', 'pl-14', 'pl-17', 'pl-20'];
  const base = [
    'flex cursor-pointer items-center gap-2 rounded py-1 pr-2',
    indent[Math.min(row.depth, indent.length - 1)] ?? 'pl-20',
  ];
  base.push(selected ? 'bg-primary text-primary-content' : 'hover:bg-base-200');
  if (drop === 'before') base.push('border-secondary border-t-2');
  if (drop === 'after') base.push('border-secondary border-b-2');
  if (drop === 'inside') base.push('outline-secondary outline outline-2 outline-dashed');
  if (!row.editable) base.push('opacity-60');
  return base.join(' ');
}
