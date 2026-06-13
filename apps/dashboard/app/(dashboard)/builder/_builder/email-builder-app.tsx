'use client';

// The email editor shell — the Builder surface at /builder/email (docs/52).
//
// Edits an email as ONE self-contained body tree with the SAME editing brain +
// body as the page/site editors: the `useBuilderEditor` hook and
// `BuilderWorkspace`. A tenant keeps a CATALOG of emails (switcher · rename · new
// · delete), each with the page's draft → publish lifecycle. Unlike a page there
// is no slug/kind/SEO and no site layout to frame in — an email has no routing
// and no chrome tier; the branded frame (wordmark + legal footer) is fixed chrome
// the renderer supplies. The document-level fields are `subject` + `preheader`,
// edited in the EmailSettings panel.
//
// Phase 1 is STATIC (docs/52 §9): the palette is the render-safe primitive subset
// and the editor passes an EMPTY binding catalog, so nothing binds yet. The true
// email render (table HTML) + preview/test-send land in Phase 2.

import * as React from 'react';
import {
  Eye,
  Monitor,
  Pencil,
  Plus,
  Save,
  Smartphone,
  SplitSquareHorizontal,
  Tablet,
  Trash2,
  Upload,
} from 'lucide-react';
import { Badge, Button, Input, ModuleProvider, NativeSelect, useConfirm } from '@sparx/ui';
import { parseEmailImport, toEmailDocument } from '@sparx/builder-schemas';
import type { BindingCatalog, BuilderEmailDto } from '@sparx/builder-schemas';

import { type Device } from './model';
import { EmailSettings } from './inspector';
import { EmailPreviewModal } from './email-preview-modal';
import { BuilderWorkspace } from './builder-workspace';
import { ImportExportControls } from './import-export-controls';
import { useBuilderEditor, type SaveStatus } from './use-builder-editor';
import {
  createEmail,
  customizeEmailForSite,
  deleteEmail,
  publishEmail,
  renameEmail,
  saveEmailTree,
  setEmailPreheader,
  setEmailSubject,
} from '../_lib/actions';

// A loaded email reduced to the editor's working shape. `key` + `scope` drive the
// per-site affordances (docs/49 Phase 7b): a tenant default with a key can be
// forked for the active site; a `scope: 'site'` row is already an override.
interface EmailItem {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  tree: BuilderEmailDto['tree'];
  key: string | null;
  scope: 'tenant' | 'site';
}

function toItem(e: BuilderEmailDto): EmailItem {
  return {
    id: e.id,
    name: e.name,
    subject: e.subject,
    preheader: e.preheader,
    tree: e.tree,
    key: e.key,
    scope: e.scope,
  };
}

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
];

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

export interface EmailBuilderAppProps {
  initialEmails: BuilderEmailDto[];
  /** What the email can bind to (docs/52 §7). Phase 1 passes an EMPTY catalog —
   *  the static slice has no data-aware components, so nothing binds yet. */
  bindingCatalog: BindingCatalog;
  /** The tenant's sending identity, shown in the canvas's inbox-envelope `From`
   *  row so the preview reads as an email, not a page. `senderName` falls back to
   *  a neutral label; `senderAddress` is omitted when no sending address is known. */
  senderName?: string;
  senderAddress?: string | null;
  /** The tenant's light logo URL, shown in the canvas's send-chrome wordmark when
   *  set — the email renders the logo (and only the logo) when the brand has one,
   *  matching @sparx/email's EmailWordmark (docs/52). Absent ⇒ the name wordmark. */
  senderLogoUrl?: string | null;
  /** The tenant's REAL identity for the canvas merge-token preview (docs/93): the
   *  store name resolves `{{tenant.name}}` to the actual store in every heading,
   *  matching the send — not the generic "Acme Supply Co." sample. */
  tenant?: { name?: string | null; storeUrl?: string | null; supportEmail?: string | null };
  /** The active web property when the tenant runs MORE THAN ONE site (docs/49
   *  Phase 7b) — present only in multi-site mode. Drives the "Customize for this
   *  site" fork + the override badge. Absent for single-site tenants, where the
   *  catalog is purely tenant-wide and these affordances never show. */
  site?: { propertyId: string; name: string };
}

export function EmailBuilderApp({
  initialEmails,
  bindingCatalog,
  senderName,
  senderAddress,
  senderLogoUrl,
  tenant,
  site,
}: EmailBuilderAppProps) {
  const confirm = useConfirm();
  // Emails load from the server (listOrSeed seeds the starter set on first use)
  // and seed this state ONCE; from here the client is authoritative and the
  // server is the persistence sink (autosave + structural ops).
  const [items, setItems] = React.useState<EmailItem[]>(() => initialEmails.map(toItem));
  const [activeId, setActiveId] = React.useState<string | null>(() => initialEmails[0]?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  // Inline rename: the switcher swaps to a text input. Enter/blur commits, Esc
  // cancels (skipRenameCommit suppresses the commit the cancel-blur fires).
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const skipRenameCommit = React.useRef(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  const active = items.find((e) => e.id === activeId) ?? items[0] ?? null;
  const tree = active?.tree ?? null;

  // The shared editing brain. `save` persists the active email's body tree;
  // `onTreeChange` writes the optimistic tree back into this component's state.
  const editor = useBuilderEditor({
    tree,
    catalog: bindingCatalog,
    save: async (next) => {
      if (!active) return false;
      const res = await saveEmailTree(active.id, next);
      return res.ok;
    },
    onTreeChange: (next) => {
      if (!active) return;
      const id = active.id;
      setItems((es) => es.map((e) => (e.id === id ? { ...e, tree: next } : e)));
    },
  });

  // Focus the rename input when it opens (avoids the autoFocus prop, which the
  // a11y lint rule forbids), and select the text for quick replace.
  React.useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  const onSelectEmail = (id: string) => {
    void editor.flushSave(); // persist the email we're leaving before switching
    setActiveId(id);
    editor.setSelectedId(null);
  };

  const onNewEmail = async () => {
    setBusy(true);
    await editor.flushSave();
    const res = await createEmail({ name: 'Untitled email' });
    setBusy(false);
    if (!res.ok || !res.data) {
      editor.setSaveStatus('error');
      return;
    }
    const created = res.data;
    setItems((es) => [...es, toItem(created)]);
    setActiveId(created.id);
    editor.setSelectedId(created.tree.id);
    editor.setRailTab('add');
  };

  const onDeleteActive = async () => {
    if (!active || items.length <= 1) return; // keep at least one email
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
    if (!res.ok) {
      editor.setSaveStatus('error');
      return;
    }
    const remaining = items.filter((e) => e.id !== removedId);
    setItems(remaining);
    setActiveId((cur) => (cur === removedId ? (remaining[0]?.id ?? null) : cur));
    editor.setSelectedId(null);
  };

  const onPublish = async () => {
    if (!active) return;
    setBusy(true);
    await editor.flushSave();
    const res = await publishEmail(active.id);
    setBusy(false);
    editor.setSaveStatus(res.ok ? 'saved' : 'error');
  };

  // "Customize for this site" (docs/49 Phase 7b): fork the active tenant default
  // into a per-site override the active site edits on its own. The override
  // REPLACES the default in this site's list (same slot), so swap it in place and
  // open it. Only valid on a keyed tenant default while a site is active.
  const canCustomizeForSite = !!site && active?.scope === 'tenant' && !!active.key;
  const onCustomizeForSite = async () => {
    if (!site || active?.scope !== 'tenant' || !active.key) return;
    setBusy(true);
    await editor.flushSave();
    const res = await customizeEmailForSite(site.propertyId, active.key);
    setBusy(false);
    if (!res.ok || !res.data) {
      editor.setSaveStatus('error');
      return;
    }
    const override = res.data;
    const replacedId = active.id;
    setItems((es) => es.map((e) => (e.id === replacedId ? toItem(override) : e)));
    setActiveId(override.id);
    editor.setSelectedId(null);
  };

  // Open the true-HTML preview (the real table-based email, in the tenant brand).
  // Flush the autosave first so the server renders the latest draft.
  const onPreview = async () => {
    setBusy(true);
    await editor.flushSave();
    setBusy(false);
    setPreviewOpen(true);
  };

  const startRename = () => {
    if (!active) return;
    setNameDraft(active.name);
    setRenaming(true);
  };

  // Called once, on the input's blur (Enter blurs to commit; Esc blurs with the
  // skip flag set). A no-op rename (empty or unchanged) just closes the input.
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
    editor.setSaveStatus('saving');
    const res = await renameEmail(id, name);
    editor.setSaveStatus(res.ok ? 'saved' : 'error');
  };

  // Set the subject / preheader (docs/52). Optimistic: write the value
  // immediately, revert on a server error.
  const onSubject = async (subject: string) => {
    if (!active) return;
    const id = active.id;
    const prev = active.subject;
    setItems((es) => es.map((e) => (e.id === id ? { ...e, subject } : e)));
    editor.setSaveStatus('saving');
    const res = await setEmailSubject(id, subject);
    if (res.ok) {
      editor.setSaveStatus('saved');
    } else {
      setItems((es) => es.map((e) => (e.id === id ? { ...e, subject: prev } : e)));
      editor.setSaveStatus('error');
    }
  };

  const onPreheader = async (value: string) => {
    if (!active) return;
    const id = active.id;
    const prev = active.preheader;
    const optimistic = value.trim() === '' ? null : value;
    setItems((es) => es.map((e) => (e.id === id ? { ...e, preheader: optimistic } : e)));
    editor.setSaveStatus('saving');
    const res = await setEmailPreheader(id, value);
    if (res.ok && res.data) {
      const saved = res.data;
      setItems((es) => es.map((e) => (e.id === id ? { ...e, preheader: saved.preheader } : e)));
      editor.setSaveStatus('saved');
    } else {
      setItems((es) => es.map((e) => (e.id === id ? { ...e, preheader: prev } : e)));
      editor.setSaveStatus('error');
    }
  };

  // Import an email document/tree into the ACTIVE email: validate, replace its
  // tree, persist. Keeps the email's identity (name/subject/preheader) — only the
  // body tree is replaced. Returns an error message (shown by the control) or null.
  const onImportText = (text: string): string | null => {
    if (!active) return 'No email to import into.';
    const result = parseEmailImport(text);
    if (!result.ok) return result.error;
    const id = active.id;
    setItems((es) => es.map((e) => (e.id === id ? { ...e, tree: result.tree } : e)));
    editor.setSelectedId(null);
    editor.setSaveStatus('saving');
    void saveEmailTree(id, result.tree).then((res) =>
      editor.setSaveStatus(res.ok ? 'saved' : 'error')
    );
    return null;
  };

  // No emails (a failed load). Offer a way in rather than a blank editor.
  if (!active || !tree) {
    return (
      <ModuleProvider module="builder">
        <div className="bx-shell">
          <div className="bx-noempty">
            <p className="bx-noempty__lead">No emails yet.</p>
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
        </div>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="builder">
      <div className="bx-shell">
        {/* Editor toolbar — email-specific actions. */}
        <div className="bx-toolbar">
          <div className="bx-toolbar__templates">
            {renaming ? (
              <Input
                ref={renameInputRef}
                size="sm"
                className="bx-tplselect"
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
                className="bx-tplselect"
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
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Rename this email"
              disabled={busy || renaming}
              onClick={startRename}
            >
              <Pencil aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="New email"
              disabled={busy || renaming}
              onClick={() => void onNewEmail()}
            >
              <Plus aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Delete this email"
              disabled={busy || renaming || items.length <= 1}
              onClick={() => void onDeleteActive()}
            >
              <Trash2 aria-hidden />
            </button>
            {/* Per-site status for the selected email (multi-site only, docs/49
                Phase 7b): a site override is badged; a shared keyed default offers
                the fork; a tenant-wide custom is labelled "All sites". */}
            {site ? (
              active.scope === 'site' ? (
                <Badge color="primary" variant="soft" size="sm" className="ml-1">
                  Only on {site.name}
                </Badge>
              ) : canCustomizeForSite ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-1"
                  leftIcon={<SplitSquareHorizontal className="h-3.5 w-3.5" />}
                  disabled={busy || renaming}
                  title={`Create a version of this email just for ${site.name}`}
                  onClick={() => void onCustomizeForSite()}
                >
                  Customize for this site
                </Button>
              ) : (
                <Badge color="neutral" variant="soft" size="sm" className="ml-1">
                  All sites
                </Badge>
              )
            ) : null}
          </div>
          <div className="bx-toolbar__devices">
            {DEVICES.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  type="button"
                  className="bx-device"
                  data-on={editor.device === d.id}
                  aria-label={d.label}
                  aria-pressed={editor.device === d.id}
                  onClick={() => editor.setDevice(d.id)}
                >
                  <Icon aria-hidden />
                </button>
              );
            })}
          </div>
          <div className="bx-toolbar__actions">
            {editor.saveStatus !== 'idle' ? (
              <span className="bx-savestate" data-state={editor.saveStatus}>
                {SAVE_LABEL[editor.saveStatus]}
              </span>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Eye className="h-3.5 w-3.5" />}
              disabled={busy}
              title="Preview the real email + send yourself a test"
              onClick={() => void onPreview()}
            >
              Preview
            </Button>
            <ImportExportControls
              kind="email"
              name={active.name}
              getDocument={() =>
                toEmailDocument({
                  name: active.name,
                  subject: active.subject,
                  preheader: active.preheader,
                  tree,
                })
              }
              onImportText={onImportText}
              disabled={busy}
            />
            <Button
              size="sm"
              variant="soft"
              leftIcon={<Save className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void editor.flushSave()}
            >
              Save
            </Button>
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

        <BuilderWorkspace
          tree={tree}
          editor={editor}
          catalog={bindingCatalog}
          surface="email"
          frame={{
            kind: 'email',
            subject: active.subject,
            senderName: senderName ?? 'Your store',
            senderAddress: senderAddress ?? null,
            senderLogoUrl: senderLogoUrl ?? null,
            tenant,
          }}
          settings={
            <EmailSettings
              name={active.name}
              subject={active.subject}
              preheader={active.preheader}
              onSubject={onSubject}
              onPreheader={onPreheader}
            />
          }
        />

        <EmailPreviewModal emailId={active.id} open={previewOpen} onOpenChange={setPreviewOpen} />
      </div>
    </ModuleProvider>
  );
}
