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
import type { BuilderPageSummaryDto, DataSource, ReleaseSummaryDto } from '@sparx/builder-schemas';

import { SilicaPageSettings } from './silica-page-settings';
import { PublishHistory, PublishHistoryButton } from './publish-history';
import { CollabPresence } from './collab-presence';
import { getReleases } from '../_lib/actions';
import { badgeView, type PublishView, type SaveState } from './publish-badge';
import type { CollabPeer } from './use-builder-collab';

// Re-exported so the studio (the only consumer) imports both the component and the
// state types from one place; the decision itself lives in `publish-badge.ts`.
export type { PublishView, SaveState };

export interface SilicaToolbarProps {
  saveState: SaveState;
  /** Whether what visitors see matches what the author has built (see `badgeView`). */
  publish: PublishView;
  /** Server-fetched page metadata (recordType / isDefault / SEO), keyed by id — the
   *  seed for the page-settings drawer. */
  pages: BuilderPageSummaryDto[];
  /** The binding catalog's sources — the record types a template can render. */
  sources: DataSource[];
  /** `?page=<id>` — the page to open on mount. Applied HERE rather than in the
   *  studio because the active page is ENGINE state and `<Builder>` exposes no
   *  initial-page prop; the toolbar is the one sparx component the engine renders
   *  inside its provider, so `useEditor()` reaches it. Ignored when the id isn't a
   *  page of this site (a stale bookmark, or a link into another site's template) —
   *  the engine stays on its default page rather than dangling. */
  initialPageId?: string;
  /** Other people editing this site right now (docs/126 Phase 4). Rendered as a
   *  presence cluster so an author knows they aren't alone before an edit collides. */
  peers: CollabPeer[];
}

export function SilicaToolbar({
  saveState,
  publish,
  pages,
  sources,
  initialPageId,
  peers,
}: SilicaToolbarProps) {
  const editor = useEditor();
  // Re-render on every committed edit so the active page + its name stay live
  // (page switches and renames both fire the engine's change event).
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => editor.subscribe(force), [editor]);

  // Honor `?page=<id>` once, at mount. A page switch is a view concern in the
  // engine (never on the undo stack), so this doesn't pollute history — and it
  // must not re-fire when the author later switches page themselves, hence the
  // mount-only dependency on the id the URL carried.
  useEffect(() => {
    if (!initialPageId) return;
    if (!editor.pagesView.pages.some((p) => p.id === initialPageId)) return;
    editor.setActivePage(initialPageId);
  }, [editor, initialPageId]);

  const [settingsOpen, setSettingsOpen] = useState(false);

  // Publish history (docs/126 §5.3). Fetched when the drawer OPENS rather than at
  // mount: it costs nothing until asked for, and it must include any publish made
  // during this editing session — a stale list here would offer to restore versions
  // that are no longer the newest, which is exactly the wrong thing to be wrong about.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [releases, setReleases] = useState<ReleaseSummaryDto[]>([]);
  useEffect(() => {
    if (!historyOpen) return;
    let live = true;
    void getReleases().then((r) => {
      if (live) setReleases(r);
    });
    return () => {
      live = false;
    };
  }, [historyOpen]);

  const activeId = editor.activePage;
  const activeName = editor.pagesView.pages.find((p) => p.id === activeId)?.name ?? 'Page';
  const meta = pages.find((p) => p.id === activeId);
  const badge = badgeView(saveState, publish);

  return (
    <div className="flex items-center gap-3">
      {/* Who else is editing this site right now — placed first so an author registers
          "I'm not alone" before reading save state. `activeId` lets it mark peers on
          THIS page distinctly from those elsewhere in the site. */}
      <CollabPresence peers={peers} activePageId={activeId} />
      {badge && (
        // One live region over both, so a screen reader hears "Saved — not live yet.
        // Visitors still see…" as a single announcement rather than two fragments.
        <div className="flex items-center gap-2" aria-live="polite">
          <Badge color={badge.color} variant="soft">
            {badge.label}
          </Badge>
          {/* Full-strength ink, not muted: this sentence is the whole point of the
              badge — it's the line that tells an author their work isn't live. It's
              hidden on narrow viewports (where the toolbar has no room) but the
              badge label alone still carries the state. */}
          {badge.detail && (
            <span className="text-base-content hidden text-sm lg:inline">{badge.detail}</span>
          )}
        </div>
      )}
      <PublishHistoryButton onClick={() => setHistoryOpen(true)} />
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
      <PublishHistory
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        releases={releases}
        // A full reload, not a router.refresh(): silica's engine reads its document
        // ONCE at mount, so a refreshed server tree would leave the editor holding
        // the pre-restore site — and its next autosave would write that straight back
        // over the restore. `resetSiteFrame` documents the same hazard.
        onRestored={() => window.location.reload()}
      />
    </div>
  );
}
