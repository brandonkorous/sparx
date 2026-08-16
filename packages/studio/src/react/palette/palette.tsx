'use client';

// Insert — the click-to-add / drag-to-add surface.
//
// A row is BOTH a button and a drag source, and neither is redundant. Clicking is
// how you add something without aiming, and the engine decides where it lands;
// dragging is how you put it in one exact place. An author who has not yet built
// a mental model of the tree uses the first, and stops needing it.
//
// The catalog is large — silica's primitives plus the app's own composites and
// section library — so the top of the rail is a search box. A grouped browse is
// only useful to someone who already knows which group a thing is in.

import { useCallback, useMemo, useState } from 'react';
import { Input } from '@wizeworks/silicaui-react';
import { mergeCatalog, paletteGroups, type PaletteItem } from '@wizeworks/silicaui-builder/react';
import { defaultMakeId, stampTree, type Node } from '@wizeworks/silicaui-html';
import type { TreeDoc } from '../../documents/types';
import { findPlace, isAddressable } from '../../tree/walk';
import { useApply, useDoc, useDocSnapshot, useSelect, useStudioHost } from '../context';
import { NODE_DRAG_TYPE } from '../canvas/canvas';
import { StudioIcon } from '../icon';

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'source', 'track', 'wbr', 'embed', 'col']);

interface Ranked {
  item: PaletteItem;
  group: string;
  score: number;
}

/** Rank a row against a query. Lower is better; -1 means no match. */
function score(item: PaletteItem, query: string): number {
  const haystacks = [item.label, item.key, item.hint ?? ''];
  let best = -1;
  for (const value of haystacks) {
    const at = value.toLowerCase().indexOf(query);
    if (at < 0) continue;
    // A prefix match beats a match buried mid-word, so typing "cta" lands the CTA
    // block rather than everything whose hint mentions one.
    const candidate = at === 0 ? 0 : at + 1;
    if (best < 0 || candidate < best) best = candidate;
  }
  return best;
}

export function Palette() {
  const host = useStudioHost();
  const doc = useDoc<TreeDoc>();
  const { selection } = useDocSnapshot();
  const apply = useApply();
  const select = useSelect();
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () => mergeCatalog(paletteGroups(), host.catalog?.(doc.kind)),
    [host, doc.kind]
  );

  const results = useMemo<Ranked[] | null>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    const ranked: Ranked[] = [];
    for (const group of groups) {
      for (const item of group.items) {
        const value = score(item, needle);
        if (value >= 0) ranked.push({ item, group: group.label, score: value });
      }
    }
    return ranked.sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label));
  }, [groups, query]);

  /** Build the node this row inserts, with fresh globally-unique ids. */
  const build = useCallback(
    (item: PaletteItem): Node => {
      const raw = item.make();
      return stampTree(host.onInsert?.(raw) ?? raw, host.makeId ?? defaultMakeId);
    },
    [host]
  );

  /**
   * Where a CLICKED row lands.
   *
   * Beside the selection, not inside it — except when the selection is an empty
   * container, which is the one case where "inside" is unambiguously what the
   * author meant. Nothing selected appends to the end of the document, which is
   * where someone building a page from the top down is working.
   */
  const insert = useCallback(
    (item: PaletteItem) => {
      const node = build(item);
      if (!isAddressable(node) || !node.id) return;

      const selected = selection[0];
      const place = selected ? findPlace(doc.root, selected) : undefined;

      let parentId = isAddressable(doc.root) ? doc.root.id : undefined;
      let index = (doc.root.kind === 'outlet' ? [] : (doc.root.children ?? [])).length;

      if (place) {
        const target = place.node;
        const canHold =
          target.kind === 'element' &&
          !VOID_TAGS.has(target.tag.toLowerCase()) &&
          !target.instanceOf;
        if (canHold && !(target.children ?? []).length) {
          parentId = target.id;
          index = 0;
        } else if (place.parent?.id) {
          parentId = place.parent.id;
          index = place.index + 1;
        }
      }

      if (!parentId) return;
      if (
        !apply(`Add ${item.label.toLowerCase()}`, [{ kind: 'node.insert', parentId, index, node }])
      )
        return;
      select([node.id]);
    },
    [apply, build, doc.root, selection, select]
  );

  const rows =
    results ??
    groups.flatMap((group) => group.items.map((item) => ({ item, group: group.label, score: 0 })));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-base-300 border-b p-2">
        <Input
          size="sm"
          value={query}
          placeholder="Search for something to add"
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {results ? (
          <PaletteRows rows={rows} onInsert={insert} onBuild={build} showGroup />
        ) : (
          groups.map((group) => (
            <section key={group.key} className="mb-4">
              <h3 className="text-base-content mb-1 px-1 text-sm font-medium">{group.label}</h3>
              <PaletteRows
                rows={group.items.map((item) => ({ item, group: group.label, score: 0 }))}
                onInsert={insert}
                onBuild={build}
              />
            </section>
          ))
        )}
        {results?.length === 0 ? (
          <p className="text-base-content px-1 py-6 text-sm">
            Nothing matches “{query}”. Try a plainer word — “photo”, “button”, “prices”.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PaletteRows({
  rows,
  onInsert,
  onBuild,
  showGroup,
}: {
  rows: Ranked[];
  onInsert: (item: PaletteItem) => void;
  onBuild: (item: PaletteItem) => Node;
  showGroup?: boolean;
}) {
  return (
    <ul>
      {rows.map(({ item, group }) => (
        <li key={item.key}>
          <button
            type="button"
            draggable
            onClick={() => onInsert(item)}
            onDragStart={(event) => {
              // The canvas decodes this into a real insert at the exact drop spot.
              event.dataTransfer.setData(NODE_DRAG_TYPE, JSON.stringify(onBuild(item)));
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
            {showGroup ? (
              <span className="text-base-content ml-auto shrink-0 text-xs">{group}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
