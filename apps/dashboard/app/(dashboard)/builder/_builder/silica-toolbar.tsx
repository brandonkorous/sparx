'use client';

// The silica studio's header slot (silicaui `<Builder toolbarSlot>`, v0.14) — the
// bits the engine can't know about: whether the host's OWN autosave has persisted
// (the builder only knows about local edits, not our server round-trip), and the
// per-page domain settings silica's flat `Page` has no home for.
//
// Rendered by the engine INSIDE its `EditorProvider`, so it reads the live editing
// state with `useEditor()` — which page is active, its name — to target the
// page-settings drawer at the right row (the silica page id IS the BuilderPage row
// id). The save status is owned by the parent studio (it runs the debounced sync)
// and handed down as a prop.

import { useEffect, useReducer, useState } from 'react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import { useEditor } from '@wizeworks/silicaui-builder/react';
import type { BadgeColor } from '@wizeworks/silicaui-react';
import type { BuilderPageDto, DataSource } from '@sparx/builder-schemas';

import { SilicaPageSettings } from './silica-page-settings';

/** The host-side persistence state the badge reflects — distinct from the engine's
 *  own local-edit tracking. `idle` = nothing to save yet (no badge). */
export type SaveState = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

const SAVE_BADGE: Record<Exclude<SaveState, 'idle'>, { label: string; color: BadgeColor }> = {
  unsaved: { label: 'Unsaved changes', color: 'warning' },
  saving: { label: 'Saving…', color: 'info' },
  saved: { label: 'All changes saved', color: 'success' },
  error: { label: 'Save failed — retrying', color: 'danger' },
};

export interface SilicaToolbarProps {
  saveState: SaveState;
  /** Server-fetched page metadata (recordType / isDefault / SEO), keyed by id — the
   *  seed for the page-settings drawer. */
  pages: BuilderPageDto[];
  /** The binding catalog's sources — the record types a template can render. */
  sources: DataSource[];
}

export function SilicaToolbar({ saveState, pages, sources }: SilicaToolbarProps) {
  const editor = useEditor();
  // Re-render on every committed edit so the active page + its name stay live
  // (page switches and renames both fire the engine's change event).
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => editor.subscribe(force), [editor]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeId = editor.activePage;
  const activeName = editor.pagesView.pages.find((p) => p.id === activeId)?.name ?? 'Page';
  const meta = pages.find((p) => p.id === activeId);
  const badge = saveState === 'idle' ? null : SAVE_BADGE[saveState];

  return (
    <div className="flex items-center gap-3">
      {badge && (
        <Badge color={badge.color} variant="soft" aria-live="polite">
          {badge.label}
        </Badge>
      )}
      <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
        Page settings
      </Button>
      <SilicaPageSettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        page={{ id: activeId, name: activeName }}
        meta={meta}
        sources={sources}
      />
    </div>
  );
}
