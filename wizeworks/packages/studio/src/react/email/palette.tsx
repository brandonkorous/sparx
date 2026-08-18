'use client';

// Insert, for an email.
//
// Shorter than the site's palette and deliberately so: email's vocabulary is
// CLOSED — eight blocks plus a handful of presets — so there is nothing to search
// through. A search box over eleven rows is furniture.
//
// A row is both a button and a drag source. Clicking adds without aiming and lets
// the document decide where it lands; dragging puts it in one exact place.

import { useCallback } from 'react';
import { EMAIL_PALETTE, type EmailPaletteItem } from '@wizeworks/silicaui-builder/email';
import { defaultMakeId } from '@wizeworks/silicaui-html';
import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import type { EmailDoc } from '../../documents/types';
import { resolveEmailDrop } from '../../email/drop';
import { stampEmailTree } from '../../email/edit';
import { useApply, useDoc, useDocSnapshot, useSelect, useStudioHost } from '../context';
import { StudioIcon } from '../icon';
import { EMAIL_DRAG_TYPE } from './canvas';

export function EmailPalette() {
  const host = useStudioHost();
  const doc = useDoc<EmailDoc>();
  const { selection } = useDocSnapshot();
  const apply = useApply();
  const select = useSelect();

  const root = doc.document.root;

  /** The node this row inserts, with fresh globally-unique ids. */
  const build = useCallback(
    (item: EmailPaletteItem): EmailNode =>
      stampEmailTree(item.make(host.emailColors), host.makeId ?? defaultMakeId),
    [host.emailColors, host.makeId]
  );

  /**
   * Where a CLICKED row lands.
   *
   * Beside the selection where that is legal, climbing outward until something can
   * hold it — the same rule the canvas uses for a drop, so clicking and dragging
   * cannot disagree. Nothing selected appends to the end of the email, which is
   * where someone building from the top down is working.
   */
  const insert = useCallback(
    (item: EmailPaletteItem) => {
      const node = build(item);
      const anchor = selection[0];
      const slot = anchor
        ? resolveEmailDrop(root, { targetId: anchor, position: 'after' }, node)
        : { parentId: root.id, index: root.children.length };
      if (!slot) return;
      if (apply(`Add ${item.label.toLowerCase()}`, [{ kind: 'email.insert', node, ...slot }])) {
        select([node.id]);
      }
    },
    [apply, build, root, selection, select]
  );

  const extras = host.emailCatalog?.() ?? [];

  // `h-full` rather than `flex-1`, so this scrolls wherever it is mounted rather
  // than only inside a flex column — the same shape the other rails use.
  return (
    <div className="h-full min-h-0 overflow-auto p-2">
      <PaletteSection label="Blocks" items={EMAIL_PALETTE} onInsert={insert} onBuild={build} />
      {extras.length ? (
        <PaletteSection label="Ready-made" items={extras} onInsert={insert} onBuild={build} />
      ) : null}
    </div>
  );
}

function PaletteSection({
  label,
  items,
  onInsert,
  onBuild,
}: {
  label: string;
  items: readonly EmailPaletteItem[];
  onInsert: (item: EmailPaletteItem) => void;
  onBuild: (item: EmailPaletteItem) => EmailNode;
}) {
  return (
    <section className="mb-4">
      <h3 className="text-base-content mb-1 px-1 text-sm font-medium">{label}</h3>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              draggable
              onClick={() => onInsert(item)}
              onDragStart={(event) => {
                // The canvas decodes this into a real insert at the exact drop spot.
                event.dataTransfer.setData(EMAIL_DRAG_TYPE, JSON.stringify(onBuild(item)));
                event.dataTransfer.effectAllowed = 'copy';
              }}
              className="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
            >
              <StudioIcon
                name={item.icon}
                className="text-base-content/70 inline-flex size-4 shrink-0"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm">{item.label}</span>
                {item.hint ? (
                  <span className="text-base-content block truncate text-xs">{item.hint}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
