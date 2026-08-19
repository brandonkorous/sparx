'use client';

// Insert, for an email.
//
// Shorter than the site's palette and deliberately so: email's vocabulary is
// CLOSED — eight blocks plus a handful of presets — so there is nothing to search
// through. A search box over eleven rows is furniture.
//
// A row is both a button and a drag source. Clicking adds without aiming and lets
// the document decide where it lands; dragging puts it in one exact place.
//
// Both work with a finger. Tapping always did; dragging did not, because the
// browser's own drag-and-drop is never delivered by touch — so a row is also a
// press-and-hold source. Hold still to lift it; move first and the list scrolls.

import { useCallback } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { EMAIL_PALETTE, type EmailPaletteItem } from '@wizeworks/silicaui-builder/email';
import { defaultMakeId } from '@wizeworks/silicaui-html';
import type { EmailNode } from '@wizeworks/silicaui-builder/email';
import type { EmailDoc } from '../../documents/types';
import { docKey } from '../../documents/types';
import { appendEmailSlot, resolveEmailDrop } from '../../email/drop';
import { stampEmailTree } from '../../email/edit';
import { useApply, useDoc, useDocSnapshot, useSelect, useStudioHost } from '../context';
import { useDragSource } from '../drag/pointer-drag';
import { StudioIcon } from '../icon';
import { EMAIL_DRAG_TYPE } from './canvas';

export function EmailPalette({ onInserted }: { onInserted?: () => void } = {}) {
  const host = useStudioHost();
  const doc = useDoc<EmailDoc>();
  const { selection } = useDocSnapshot();
  const apply = useApply();
  const select = useSelect();
  const toast = useToast();

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
      // Nothing selected appends to the end of the email — to the last place that
      // can actually HOLD this block, which for a text block is the last section
      // rather than the body it could never sit in.
      const slot = anchor
        ? resolveEmailDrop(root, { targetId: anchor, position: 'after' }, node)
        : appendEmailSlot(root, node);
      // REFUSED IS AN ANSWER, and it has to be spoken. An email body holds sections;
      // a text block, a button and an image live INSIDE one. Clicking Text with
      // nothing selected is therefore a legitimate refusal — and it used to be a
      // silent one, so the author clicked, watched nothing happen, and had no way to
      // learn what to do differently.
      const done =
        slot && apply(`Add ${item.label.toLowerCase()}`, [{ kind: 'email.insert', node, ...slot }]);
      if (!done) {
        toast.add({
          title: `“${item.label}” can’t go there`,
          description:
            'It needs to sit inside a section. Add a section first, or pick one in your email, then add this to it.',
          type: 'info',
        });
        return;
      }
      select([node.id]);
      // On a narrow screen the palette and the canvas are different screens.
      onInserted?.();
    },
    [apply, build, root, selection, select, onInserted, toast]
  );

  const extras = host.emailCatalog?.() ?? [];
  // Per document, not per kind: two email builders dock side by side.
  const surface = docKey(doc);

  // `h-full` rather than `flex-1`, so this scrolls wherever it is mounted rather
  // than only inside a flex column — the same shape the other rails use.
  return (
    <div className="h-full min-h-0 overflow-auto p-2">
      <PaletteSection
        label="Blocks"
        items={EMAIL_PALETTE}
        onInsert={insert}
        onBuild={build}
        surface={surface}
      />
      {extras.length ? (
        <PaletteSection
          label="Ready-made"
          items={extras}
          onInsert={insert}
          onBuild={build}
          surface={surface}
        />
      ) : null}
    </div>
  );
}

function PaletteSection({
  label,
  items,
  onInsert,
  onBuild,
  surface,
}: {
  label: string;
  items: readonly EmailPaletteItem[];
  onInsert: (item: EmailPaletteItem) => void;
  onBuild: (item: EmailPaletteItem) => EmailNode;
  surface: string;
}) {
  return (
    <section className="mb-4">
      <h3 className="text-base-content mb-1 px-1 text-sm font-medium">{label}</h3>
      <ul>
        {items.map((item) => (
          <PaletteRow
            key={item.key}
            item={item}
            surface={surface}
            onInsert={onInsert}
            onBuild={onBuild}
          />
        ))}
      </ul>
    </section>
  );
}

/** One row: a button, a mouse drag source, and a press-and-hold drag source. */
function PaletteRow({
  item,
  surface,
  onInsert,
  onBuild,
}: {
  item: EmailPaletteItem;
  surface: string;
  onInsert: (item: EmailPaletteItem) => void;
  onBuild: (item: EmailPaletteItem) => EmailNode;
}) {
  // Built at PRESS time, not at render: every insert needs its own ids, and a node
  // minted once per render would place the same id twice in one email.
  const dragSource = useDragSource(() => ({ surface, node: onBuild(item) }));

  return (
    <li>
      <button
        type="button"
        draggable
        onClick={() => onInsert(item)}
        onDragStart={(event) => {
          // The canvas decodes this into a real insert at the exact drop spot.
          event.dataTransfer.setData(EMAIL_DRAG_TYPE, JSON.stringify(onBuild(item)));
          event.dataTransfer.effectAllowed = 'copy';
        }}
        {...dragSource}
        className="hover:bg-base-200 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left"
      >
        <StudioIcon name={item.icon} className="text-base-content/70 inline-flex size-4 shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-sm">{item.label}</span>
          {item.hint ? (
            <span className="text-base-content block truncate text-xs">{item.hint}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
