'use client';

// The silica Email Builder studio (docs/120 Stage 4) — replaces the old `.bx-*`
// `EmailBuilderApp` with silicaui 0.17's `<EmailBuilder>`, so the email + site
// builders are one engine. silica owns the editor chrome (Insert · Canvas · Design)
// AND the document fields (subject/preheader, edited via the root-node inspector);
// sparx keeps the CATALOG + lifecycle it always owned — switch · new · rename ·
// delete · fork-for-this-site · publish — in a thin strip above the editor (the
// email shell exposes no toolbar slot, docs/120 A1), and persists the whole
// `EmailDocument` through the debounced `onChange` seam.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmailBuilder } from '@wizeworks/silicaui-builder/email/react';
import {
  emptyEmailDocument,
  type EmailDocument,
  type EmailProject,
} from '@wizeworks/silicaui-builder/email';
import { resolveEmailColorDefaults } from '@wizeworks/silicaui-builder/email/react';
import type {
  DataSource as SilicaDataSource,
  Theme as SilicaTheme,
} from '@wizeworks/silicaui-html';
import { Pencil, Plus, SplitSquareHorizontal, Trash2, Upload } from 'lucide-react';
import { Badge, Button, Input, ModuleProvider, NativeSelect, useConfirm } from '@sparx/ui';
import type { BuilderEmailDto, DataSources } from '@sparx/builder-schemas';

import { MediaPicker } from '../../cms/_components/media-picker';
import { makeAssetPanels } from './email-asset-panel';
import { buildEmailHost } from './email-silica-host';
import {
  createEmail,
  customizeEmailForSite,
  deleteEmail,
  publishSilicaEmail,
  renameEmail,
  syncSilicaEmail,
  testSendEmail,
} from '../_lib/actions';

/** A loaded email reduced to what the studio tracks. `silicaDoc` is the persisted
 *  silica document; null on a row not yet authored on silica (the editor seeds an
 *  empty document, and the first autosave materializes it). */
interface EmailItem {
  id: string;
  name: string;
  silicaDoc: EmailDocument | null;
  published: boolean;
  key: string | null;
  scope: 'tenant' | 'site';
}

function toItem(e: BuilderEmailDto): EmailItem {
  return {
    id: e.id,
    name: e.name,
    silicaDoc: e.silicaDoc,
    published: e.published,
    key: e.key,
    scope: e.scope,
  };
}

const AUTOSAVE_MS = 700;

/** The media library's pending request — the promise `pickAsset` returns, bridged to
 *  the controlled `<MediaPicker>` dialog: opening it settles when the author picks
 *  (or cancels). Mirrors the site studio's bridge; the email host reaches it through
 *  an inspector panel rather than a `pickAsset` hook (docs/120 A2). */
interface PickerRequest {
  resolve: (asset: { url: string; alt?: string } | null) => void;
}

export interface EmailSilicaStudioProps {
  initialEmails: BuilderEmailDto[];
  /** The tenant brand as a silica `Theme` — seeds new-block colors on-brand. */
  theme: SilicaTheme;
  /** The email binding catalog as silica `DataSource[]` (drives the picker). */
  dataSources: SilicaDataSource[];
  /** The preview data root the canvas resolves bindings + `{{tokens}}` against. */
  root: DataSources;
  /** The active web property when the tenant runs more than one site (docs/49
   *  Phase 7b) — enables the "Customize for this site" fork + the override badge. */
  site?: { propertyId: string; name: string };
}

export function EmailSilicaStudio({
  initialEmails,
  theme,
  dataSources,
  root,
  site,
}: EmailSilicaStudioProps) {
  const confirm = useConfirm();
  const [items, setItems] = useState<EmailItem[]>(() => initialEmails.map(toItem));
  const [activeId, setActiveId] = useState<string | null>(() => initialEmails[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const skipRenameCommit = useRef(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const active = items.find((e) => e.id === activeId) ?? items[0] ?? null;

  // The media library an asset field opens. Stable identity so the memoized host —
  // and with it the whole editor — isn't rebuilt on every render.
  const [picker, setPicker] = useState<PickerRequest | null>(null);
  const pickAsset = useCallback(
    (): Promise<{ url: string; alt?: string } | null> =>
      new Promise((resolve) => {
        setPicker({ resolve });
      }),
    []
  );
  const inspectorPanels = useMemo(() => makeAssetPanels(pickAsset), [pickAsset]);

  const host = useMemo(
    () => buildEmailHost({ root, dataSources, inspectorPanels }),
    [root, dataSources, inspectorPanels]
  );
  const colors = useMemo(() => resolveEmailColorDefaults(theme), [theme]);

  // The document `<EmailBuilder>` mounts for the active email: its stored silica
  // document, or a fresh empty one seeded with the row's identity. Memoized per
  // (id, storedDoc) so switching remounts (via the `key` below) with the right doc
  // and a re-render never re-seeds a fresh canvas over in-progress edits.
  const activeDoc = useMemo<EmailDocument | null>(() => {
    if (!active) return null;
    if (active.silicaDoc) return active.silicaDoc;
    return emptyEmailDocument(() => crypto.randomUUID(), colors);
  }, [active, colors]);

  // Debounced whole-document autosave (mirrors the site studio). onChange hands back
  // the whole project; we persist its single template's document to the active row.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ id: string; doc: EmailDocument } | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    const res = await syncSilicaEmail(next.id, next.doc);
    if (res.ok) {
      // Fold the persisted doc back into the item so a later remount (switch away
      // and back) opens on the saved document, not a re-seeded empty canvas.
      setItems((es) => es.map((e) => (e.id === next.id ? { ...e, silicaDoc: next.doc } : e)));
    }
  }, []);

  const onChange = useCallback(
    (project: EmailProject) => {
      const id = activeId;
      const doc = project.templates[0]?.document;
      if (!id || !doc) return;
      pending.current = { id, doc };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [activeId, flush]
  );

  // Persist any pending edit before switching emails, publishing, test-sending, or
  // unmounting — so the last burst isn't lost, and so the SERVER renders the current
  // draft rather than the previous save. Awaitable for exactly that reason.
  const flushNow = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      await flush();
    }
  }, [flush]);

  useEffect(() => () => void flushNow(), [flushNow]);

  useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  // Silica's "Send test" — it hands back the HTML it projected on the canvas, but we
  // deliberately IGNORE it and let the server render: only the send path applies the
  // tenant brand, composes the wordmark/legal frame, and resolves this recipient's
  // real data (docs/120 D2). Flush first so the server renders the CURRENT draft.
  const onSendTest = useCallback(
    async ({ to }: { to: string }) => {
      if (!activeId) return;
      await flushNow();
      const res = await testSendEmail(activeId, to);
      // Throwing surfaces the failure in silica's own send-test dialog.
      if (!res.ok) throw new Error(res.error ?? 'Test send failed.');
    },
    [activeId, flushNow]
  );

  const onSelectEmail = (id: string) => {
    void flushNow();
    setActiveId(id);
  };

  const onNewEmail = async () => {
    setBusy(true);
    await flushNow();
    const res = await createEmail({ name: 'Untitled email' });
    setBusy(false);
    if (!res.ok || !res.data) return;
    setItems((es) => [...es, toItem(res.data!)]);
    setActiveId(res.data.id);
  };

  const onDeleteActive = async () => {
    if (!active || items.length <= 1) return;
    const ok = await confirm({
      title: `Delete “${active.name}”?`,
      description: 'This permanently removes the email and everything in it. This can’t be undone.',
      confirmLabel: 'Delete email',
      tone: 'danger',
    });
    if (!ok) return;
    const removedId = active.id;
    setBusy(true);
    const res = await deleteEmail(removedId);
    setBusy(false);
    if (!res.ok) return;
    const remaining = items.filter((e) => e.id !== removedId);
    setItems(remaining);
    setActiveId((cur) => (cur === removedId ? (remaining[0]?.id ?? null) : cur));
  };

  const onPublish = async () => {
    if (!active) return;
    setBusy(true);
    await flushNow();
    const res = await publishSilicaEmail(active.id);
    setBusy(false);
    if (res.ok && res.data) {
      const published = res.data;
      setItems((es) => es.map((e) => (e.id === published.id ? { ...e, published: true } : e)));
    }
  };

  const canCustomizeForSite = !!site && active?.scope === 'tenant' && !!active.key;
  const onCustomizeForSite = async () => {
    if (!site || active?.scope !== 'tenant' || !active.key) return;
    setBusy(true);
    await flushNow();
    const res = await customizeEmailForSite(site.propertyId, active.key);
    setBusy(false);
    if (!res.ok || !res.data) return;
    const override = res.data;
    const replacedId = active.id;
    setItems((es) => es.map((e) => (e.id === replacedId ? toItem(override) : e)));
    setActiveId(override.id);
  };

  const startRename = () => {
    if (!active) return;
    setNameDraft(active.name);
    setRenaming(true);
  };

  const commitRename = async () => {
    if (skipRenameCommit.current) {
      skipRenameCommit.current = false;
      setRenaming(false);
      return;
    }
    setRenaming(false);
    if (!active) return;
    const name = nameDraft.trim();
    if (!name || name === active.name) return;
    const id = active.id;
    setItems((es) => es.map((e) => (e.id === id ? { ...e, name } : e)));
    await renameEmail(id, name);
  };

  if (!active || !activeDoc) {
    return (
      <ModuleProvider module="builder">
        <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-3">
          <p className="text-base-content">No emails yet.</p>
          <Button
            size="sm"
            variant="solid"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            disabled={busy}
            onClick={() => void onNewEmail()}
          >
            Create an email
          </Button>
        </div>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="builder">
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        {/* The sparx catalog + lifecycle strip — everything silica's email shell
            doesn't own (docs/120 A1). */}
        <div className="border-base-300 flex items-center gap-2 border-b px-3 py-2">
          {renaming ? (
            <Input
              ref={renameInputRef}
              size="sm"
              className="w-56"
              value={nameDraft}
              aria-label="Email name"
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  skipRenameCommit.current = true;
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => void commitRename()}
            />
          ) : (
            <NativeSelect
              size="sm"
              className="w-56"
              value={active.id}
              aria-label="Email"
              onChange={(e) => onSelectEmail(e.target.value)}
            >
              {items.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </NativeSelect>
          )}
          <Button
            size="sm"
            variant="ghost"
            aria-label="Rename this email"
            disabled={busy || renaming}
            onClick={startRename}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="New email"
            disabled={busy || renaming}
            onClick={() => void onNewEmail()}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Delete this email"
            disabled={busy || renaming || items.length <= 1}
            onClick={() => void onDeleteActive()}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>

          {/* Per-site status (multi-site only, docs/49 Phase 7b). */}
          {site ? (
            active.scope === 'site' ? (
              <Badge color="primary" variant="soft" size="sm">
                Only on {site.name}
              </Badge>
            ) : canCustomizeForSite ? (
              <Button
                size="sm"
                variant="outline"
                leftIcon={<SplitSquareHorizontal className="h-3.5 w-3.5" />}
                disabled={busy || renaming}
                title={`Create a version of this email just for ${site.name}`}
                onClick={() => void onCustomizeForSite()}
              >
                Customize for this site
              </Button>
            ) : (
              <Badge color="neutral" variant="soft" size="sm">
                All sites
              </Badge>
            )
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            {active.published ? (
              <Badge color="success" variant="soft" size="sm">
                Published
              </Badge>
            ) : null}
            <Button
              size="sm"
              variant="solid"
              leftIcon={<Upload className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void onPublish()}
            >
              Publish
            </Button>
          </div>
        </div>

        {/* silica's Email Builder — remounts per active email so the seeded/stored
            document loads fresh; server-authoritative, so no local crash draft. */}
        <div className="min-h-0 flex-1">
          <EmailBuilder
            key={active.id}
            document={activeDoc}
            host={host}
            theme={theme}
            onChange={onChange}
            onSendTest={onSendTest}
            persistKey={null}
          />
        </div>

        {/* The media library an asset field opens (docs/120 A2) — the same picker the
            site builder and the CMS use, so an image lives in one place. */}
        <MediaPicker
          open={picker !== null}
          accept={['image/*']}
          onOpenChange={(next) => {
            if (!next && picker) {
              picker.resolve(null);
              setPicker(null);
            }
          }}
          onPick={(asset) => {
            picker?.resolve({ url: asset.src, ...(asset.alt ? { alt: asset.alt } : {}) });
            setPicker(null);
          }}
        />
      </div>
    </ModuleProvider>
  );
}
