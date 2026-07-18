'use client';

// The site studio mount (docs/118) — wraps the live silica `<Builder>` around the
// sparx `BuilderHost`. The host carries FUNCTIONS (resolveBinding, validateClass,
// pickAsset…), which can't cross the RSC boundary, so it's assembled HERE, client-
// side, from the serializable inputs the server route passes (the pre-loaded data
// root, the silica DataSource catalog, the tenant class allowlist, the page
// metadata list). The document is plain serializable node data, built server-side
// and handed in.
//
// This IS the editor behind /builder/studio — the parallel-run proof route
// (/builder/silica) and the hand-rolled `.bx-*` `SiteStudio` it was proven against
// are both deleted.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Builder } from '@wizeworks/silicaui-builder/react';
import type { DataSource as SilicaDataSource, Document, Site } from '@wizeworks/silicaui-html';
import { useConfirm } from '@sparx/ui';
import type {
  BuilderPageDto,
  DataSource,
  DataSources,
  SitePublishState,
  SiteSyncInput,
} from '@sparx/builder-schemas';

import { MediaPicker } from '../../cms/_components/media-picker';
import { publishBuilderSite, syncBuilderSite } from '../_lib/actions';
import { buildSilicaHost, defaultSilicaFormat } from './silica-host';
import { makeRenderHostNode } from './host-cores';
import { makeFormPanels } from './form-settings-panel';
import { SilicaToolbar, type PublishView, type SaveState } from './silica-toolbar';
import { useUnpublishedGuard } from './use-unpublished-guard';

/** Project silica's extracted `Site` onto the sync wire shape — near-identity:
 *  silica's `Page` is already `{ id, name, slug, root }`; the frame contributes its
 *  root, and the site-global `symbols` + `theme` + saved-theme `library` ride along.
 *  The engine hands back the WHOLE site on every edit, so every part is persisted
 *  (docs/118) — a theme, symbol, or saved-theme edit must never be dropped on the
 *  floor here (silicaui 0.16 rounds `savedThemes` through `onChange`). */
function toSyncInput(site: Site): SiteSyncInput {
  return {
    pages: site.pages.map((p) => ({ id: p.id, name: p.name, slug: p.slug, root: p.root })),
    ...(site.frame ? { frame: { root: site.frame.root } } : {}),
    ...(site.symbols ? { symbols: site.symbols } : {}),
    ...(site.theme ? { theme: site.theme } : {}),
    ...(site.savedThemes ? { savedThemes: site.savedThemes } : {}),
  };
}

/** Debounce window for the whole-site autosave — the engine fires `onChange` per
 *  edit; one PUT ~700ms after the last keystroke reconciles the site. */
const AUTOSAVE_MS = 700;

/** The media picker's pending request — the promise `pickAsset` returns, bridged to
 *  the controlled `<MediaPicker>` dialog: opening it resolves when the user picks
 *  (or cancels). Silica calls `pickAsset` from an image/video field. */
interface PickerRequest {
  accept: string[];
  resolve: (asset: { url: string; alt?: string } | null) => void;
}

export interface SilicaStudioProps {
  /** The tenant's silica `Site` — the whole multi-page site (pages + shared frame
   *  + theme), so the engine's native multi-page + frame editing is in play. A
   *  single-page `Document` is still accepted (the legacy one-page shape); both
   *  are what `<Builder document>` takes as of silicaui 0.12. */
  site: Site | Document;
  /** The pre-loaded resolver root (`buildPreviewData`) the host reads bindings from. */
  root: DataSources;
  /** The tenant binding catalog as silica `DataSource[]` (drives the picker). */
  dataSources: SilicaDataSource[];
  /** The tenant's stored class allowlist (tighten-only over the engine floor). */
  tenantAllowlist?: unknown;
  /** The tenant's page catalog with domain metadata (recordType / isDefault / SEO)
   *  — the seed for the header page-settings drawer, keyed by page id. */
  pages: BuilderPageDto[];
  /** The binding catalog's sources — the record types a template can render, listed
   *  in the page-settings "Page type" picker. */
  sources: DataSource[];
  /** `?page=<id>` — open THIS page on mount instead of the site's first one. The
   *  engine holds the active page, so the toolbar (which sits inside the engine's
   *  provider) applies it; see `SilicaToolbar`. */
  initialPageId?: string;
  /** Draft-vs-published as of page load, from the server. The studio takes it from
   *  here: an edit makes the site unpublished, a publish makes it live. */
  initialPublishState: SitePublishState;
}

export function SilicaStudio({
  site,
  root,
  dataSources,
  tenantAllowlist,
  pages,
  sources,
  initialPageId,
  initialPublishState,
}: SilicaStudioProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [picker, setPicker] = useState<PickerRequest | null>(null);
  // Seeded from the server, then owned locally. Re-reading after every edit would be
  // a request per keystroke to answer a question we already know the answer to: an
  // edit means unpublished, a publish means live.
  const [publish, setPublish] = useState<PublishView>({
    hasUnpublished: initialPublishState.hasUnpublished,
    lastPublishedAt: initialPublishState.lastPublishedAt,
    neverPublished: initialPublishState.neverPublished,
  });

  // The media picker silica invokes when an image/video field asks for a source —
  // returns a promise that settles when the author picks an asset (or cancels).
  // Stable identity so the memoized host isn't rebuilt on every render.
  const pickAsset = useCallback(
    (kind: 'image' | 'video'): Promise<{ url: string; alt?: string } | null> =>
      new Promise((resolve) => {
        setPicker({ accept: [kind === 'video' ? 'video/*' : 'image/*'], resolve });
      }),
    []
  );

  // The slug of the page currently open. The engine owns which page is active, and it
  // announces changes through `onActivePageChange`; we mirror it into a ref because the
  // host is memoized once at mount and the form panel needs the CURRENT page at the
  // moment the author saves, not the one that happened to be open on load.
  const activeSlug = useRef<string | null>(null);
  const onActivePageChange = useCallback((page: { slug: string }) => {
    const slug = page.slug.replace(/^\/+|\/+$/g, '');
    activeSlug.current = slug === '' ? null : slug;
  }, []);

  // sparx's contribution to silica's Inspector: where a form's submissions go
  // (docs/115). silicaui ships the form and does the whole client half, then stops at
  // this seam by design — it has no opinion about the submission target.
  const inspectorPanels = useMemo(() => makeFormPanels(() => activeSlug.current), []);

  const host = useMemo(
    () =>
      buildSilicaHost({
        root,
        dataSources,
        tenantAllowlist,
        formatValue: defaultSilicaFormat,
        pickAsset,
        inspectorPanels,
        renderHostNode: makeRenderHostNode(root),
      }),
    [root, dataSources, tenantAllowlist, pickAsset, inspectorPanels]
  );

  // Debounced whole-site autosave. The engine fires onChange per edit with the
  // full extracted Site; we coalesce a burst into one reconcile PUT and keep the
  // latest site pending so a save-in-flight never drops the newest state. The
  // save badge in the toolbar reflects the round-trip the engine can't see.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Site | null>(null);

  const flush = useCallback(() => {
    timer.current = null;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setSaveState('saving');
    void syncBuilderSite(toSyncInput(next)).then((res) => {
      if (!res.ok) {
        // Re-queue the failed payload so the next edit (or unmount flush) retries it.
        pending.current ??= next;
        setSaveState('error');
        return;
      }
      // Only claim "saved" if nothing newer arrived while the PUT was in flight.
      setSaveState(pending.current ? 'unsaved' : 'saved');
    });
  }, []);

  const onChange = useCallback(
    (next: Site) => {
      pending.current = next;
      setSaveState('unsaved');
      // Any edit makes the site differ from what visitors are served. Deliberately
      // NOT reconciled back to false on undo: proving "this is byte-identical to the
      // published tree again" needs the server, and erring toward "you have something
      // to publish" costs one harmless click, while erring the other way is exactly
      // the silent-staleness bug this feature exists to kill.
      setPublish((p) => (p.hasUnpublished ? p : { ...p, hasUnpublished: true }));
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush]
  );

  // Flush any pending edit on unmount (route change / site switch) so the last
  // burst isn't lost between the debounce window and navigation.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        flush();
      }
    };
  }, [flush]);

  const onPublish = useCallback(async ({ site: published }: { site: Site }) => {
    // Persist the just-edited site first (skip the debounce), then snapshot
    // draft → published so the publish reflects the newest state.
    setSaveState('saving');
    const synced = await syncBuilderSite(toSyncInput(published));
    if (!synced.ok) {
      setSaveState('error');
      return;
    }
    pending.current = null;
    setSaveState('saved');
    const done = await publishBuilderSite();
    // Only claim "live" if the publish actually succeeded — a failed publish that
    // still flipped the badge to green would recreate the exact lie this fixes.
    if (done.ok) {
      setPublish({
        hasUnpublished: false,
        lastPublishedAt: new Date().toISOString(),
        neverPublished: false,
      });
    }
  }, []);

  // The leave warning, part one: closing or reloading the tab. The browser shows its
  // own generic dialog and ignores custom text, so the toolbar badge carries the real
  // explanation — this only ensures the author is asked at all.
  useEffect(() => {
    if (!publish.hasUnpublished) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy assignment kept: Safari still gates the prompt on returnValue.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [publish.hasUnpublished]);

  // Part two: navigating elsewhere in the dashboard, which never reaches the browser's
  // navigation lifecycle. Here we own the dialog, so it says what's actually at stake —
  // nothing is lost, it just isn't live.
  const confirm = useConfirm();
  const confirmLeave = useCallback(
    () =>
      confirm({
        title: 'Leave without publishing?',
        description:
          'Your changes are saved, so nothing will be lost — but visitors won’t see them until you publish.',
        confirmLabel: 'Leave anyway',
        cancelLabel: 'Stay here',
        // Not `danger`: leaving destroys nothing. Red here would teach authors to
        // fear a dialog whose real answer is usually "yes, that's fine".
        tone: 'module',
      }),
    [confirm]
  );
  useUnpublishedGuard({ active: publish.hasUnpublished, confirmLeave });

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full">
      <Builder
        // `<Builder document>` takes `Document | Site` as of silicaui 0.12, so the
        // multi-page `Site` passes straight through (this used to need a cast).
        document={site}
        host={host}
        // Server-authoritative — the debounced onChange is the durable store; no
        // local IndexedDB crash-recovery layer duplicating it.
        persistKey={null}
        // Hide silica's canvas data on/off toggle (silicaui 0.26). It's a real
        // control, but its effect is invisible on a tree with no bindings — which
        // is most trees — so to a non-technical author it reads as a dead button.
        // Authors here see resolved data always; debugging a resolver is our job.
        dataToggle={false}
        onChange={onChange}
        onActivePageChange={onActivePageChange}
        onPublish={onPublish}
        toolbarSlot={
          <SilicaToolbar
            saveState={saveState}
            publish={publish}
            pages={pages}
            sources={sources}
            initialPageId={initialPageId}
          />
        }
      />
      <MediaPicker
        open={picker !== null}
        accept={picker?.accept}
        onOpenChange={(next) => {
          if (!next && picker) {
            picker.resolve(null);
            setPicker(null);
          }
        }}
        onPick={(asset) => {
          picker?.resolve({ url: asset.src, alt: asset.alt });
          setPicker(null);
        }}
      />
    </div>
  );
}
