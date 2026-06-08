'use client';

// The page editor shell — the Builder surface at /builder/page.
//
// Owns the PAGE-specific concerns: the catalog of pages (load + which is active),
// the catalog ops (new / delete / publish / rename / slug), and the toolbar +
// context bar. The editing brain — selection, mutations, autosave, the canvas /
// inspector / layers body — is the shared `useBuilderEditor` hook +
// `BuilderWorkspace`, identical to the site editor (docs/45 §2.2).
//
// PERSISTENCE (docs/41): pages load from api-rest via the server route and seed
// this component's state. Draft-tree edits autosave (debounced) through the hook;
// New / Delete / Publish round-trip immediately.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Monitor, Pencil, Plus, Save, Smartphone, Tablet, Trash2, Upload } from 'lucide-react';
import { Button, Input, ModuleProvider, NativeSelect, useConfirm } from '@sparx/ui';
import { makeCustomNode, parsePageImport, toPageDocument } from '@sparx/builder-schemas';
import type {
  BindingCatalog,
  BuilderNode,
  BuilderPageDto,
  ComponentDto,
} from '@sparx/builder-schemas';

import type { Property } from '@/lib/sites';
import { makeId, type Device, type PageTemplate, type PageSeo } from './model';
import { SiteSwitcher } from './site-switcher';
import { getDef } from './registry';
import { MODULES } from './sample';
import { PageSettings } from './inspector';
import { BuilderWorkspace } from './builder-workspace';
import { FieldsPanel } from './fields-panel';
import { deriveFieldKey, makeFieldDef, type CreatableType } from './field-kinds';
import { ImportExportControls } from './import-export-controls';
import { useBuilderEditor, type SaveStatus } from './use-builder-editor';
import {
  createPage,
  deletePage,
  mintBuilderPreviewToken,
  publishPage,
  renamePage,
  retargetPage,
  savePageTree,
  setPageDefault,
  setPageSlug,
  updatePageSeo,
} from '../_lib/actions';
import { copyComponent } from '../components/_lib/component-actions';
import { getContentTypeSchema, saveContentTypeSchema } from '../_lib/schema-actions';

// A loaded page reduced to the editor's working shape.
function toTemplate(p: BuilderPageDto): PageTemplate {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    kind: p.kind,
    recordType: p.recordType ?? undefined,
    isDefault: p.isDefault,
    tree: p.tree,
    seo: {
      title: p.seoTitle ?? '',
      description: p.seoDescription ?? '',
      canonical: p.canonical ?? '',
      ogImage: p.ogImage ?? '',
      noindex: p.noindex,
    },
  };
}

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
];

function templateLabel(t: PageTemplate): string {
  if (t.kind === 'collection')
    return `${t.name} · per ${t.recordType?.split('.').pop() ?? 'record'}`;
  return t.name;
}

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

export interface BuilderAppProps {
  initialPages: BuilderPageDto[];
  /** What the page can bind to — the tenant's real CMS content types + the
   *  code-defined Commerce/CRM sources (docs/43, the keystone). */
  bindingCatalog: BindingCatalog;
  /** The tenant's site layout tree. The page editor renders it as a locked
   *  backdrop (header/footer) around the page, with the page at its Outlet — so
   *  you edit the page in the chrome it actually ships in. Null if unavailable
   *  (the editor still works, just unframed). */
  layoutTree?: BuilderNode | null;
  /** The tenant slug + live-site origin, used to open the "Preview" tab at the
   *  active page's slug with a freshly-minted draft-preview token (docs/45 §2.6).
   *  Absent when the site context can't be resolved → Preview is disabled. */
  tenantSlug?: string;
  siteOrigin?: string;
  /** Deep-link target: open this page active on mount (e.g. the SEO overview's
   *  "Open in builder" link → `/builder/page?page=<id>`). Falls back to the
   *  first page when absent or not found in `initialPages`. */
  initialPageId?: string;
  /** The tenant's custom components with their latest trees (docs/53 P-B) — feeds
   *  the Add palette ("Your components") and the canvas's live expansion. */
  components?: ComponentDto[];
  /** The tenant's web properties (sites) + which one is active, for the in-editor
   *  site switcher (docs/49 Phase 3). The switcher hides itself for single-site
   *  tenants, so passing an empty / one-element list is a no-op. */
  properties?: Property[];
  activePropertyId?: string | null;
  /** The active web property's slug (docs/49). Scopes the Preview tab to the site
   *  being authored via `&property=<slug>`; absent ⇒ the tenant's primary site. */
  previewPropertySlug?: string;
}

export function BuilderApp({
  initialPages,
  bindingCatalog,
  layoutTree,
  tenantSlug,
  siteOrigin,
  initialPageId,
  components = [],
  properties = [],
  activePropertyId = null,
  previewPropertySlug,
}: BuilderAppProps) {
  const confirm = useConfirm();
  const router = useRouter();
  // Pages load from the server (docs/41 §5 seeds the curated set on first use)
  // and seed this state ONCE. From here the client is authoritative for the
  // session; the server is the persistence sink (autosave + structural ops).
  const [templates, setTemplates] = React.useState<PageTemplate[]>(() =>
    initialPages.map(toTemplate)
  );
  const [activeId, setActiveId] = React.useState<string | null>(() =>
    initialPageId && initialPages.some((p) => p.id === initialPageId)
      ? initialPageId
      : (initialPages[0]?.id ?? null)
  );
  const [busy, setBusy] = React.useState(false);
  // Inline page rename: the switcher swaps to a text input. Enter/blur commits,
  // Esc cancels (skipRenameCommit suppresses the commit the cancel-blur fires).
  const [renaming, setRenaming] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState('');
  const skipRenameCommit = React.useRef(false);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  const active = templates.find((t) => t.id === activeId) ?? templates[0] ?? null;
  const tree = active?.tree ?? null;

  // The home singleton serves at "/" — it's the FIRST slugless singleton (mirrors
  // the storefront's getPublishedHome, docs/49). Identifying it lets Preview open
  // the home page — and freshly-seeded slugless pages — instead of staying
  // disabled (a slugless page has no `/{slug}` to open).
  const homeId = templates.find((t) => t.kind === 'singleton' && !t.slug)?.id ?? null;

  // Custom components keyed by component key — drives insertion (version pin),
  // the canvas's live expansion, and the layers/inspector labels (docs/53 P-B).
  const componentsByKey = React.useMemo(
    () => new Map(components.map((c) => [c.key, c])),
    [components]
  );

  // The content type this collection template renders, if any — its key drives
  // the "Fields" rail tab and the inspector's inline "+ New field" (docs/51
  // keystone). A singleton page or an untargeted/commerce template has none.
  const contentTypeKey =
    active?.kind === 'collection' && active.recordType?.startsWith('cms.')
      ? active.recordType.slice('cms.'.length)
      : null;

  // The shared editing brain. `save` persists the active page; `onTreeChange`
  // writes the optimistic tree back into this component's catalog state.
  const editor = useBuilderEditor({
    tree,
    catalog: bindingCatalog,
    components: componentsByKey,
    save: async (next) => {
      if (!active) return false;
      const res = await savePageTree(active.id, next);
      return res.ok;
    },
    onTreeChange: (next) => {
      if (!active) return;
      const id = active.id;
      setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, tree: next } : t)));
    },
  });

  // Focus the rename input when it opens (avoids the autoFocus prop, which the
  // a11y lint rule forbids), and select the text for quick replace.
  React.useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);

  const onSelectTemplate = (id: string) => {
    void editor.flushSave(); // persist the page we're leaving before switching
    setActiveId(id);
    editor.setSelectedId(null);
  };

  const onNewTemplate = async () => {
    setBusy(true);
    await editor.flushSave();
    const res = await createPage({ name: 'Untitled page', kind: 'singleton' });
    setBusy(false);
    if (!res.ok || !res.data) {
      editor.setSaveStatus('error');
      return;
    }
    const created = res.data;
    setTemplates((ts) => [...ts, toTemplate(created)]);
    setActiveId(created.id);
    editor.setSelectedId(created.tree.id);
    editor.setRailTab('add');
  };

  const onDeleteActive = async () => {
    if (!active || templates.length <= 1) return; // keep at least one page
    const ok = await confirm({
      title: `Delete “${active.name}”?`,
      description: 'This permanently removes the page and everything on it. This can’t be undone.',
      confirmLabel: 'Delete page',
      tone: 'danger',
    });
    if (!ok) return;
    const removedId = active.id;
    setBusy(true);
    const res = await deletePage(removedId);
    setBusy(false);
    if (!res.ok) {
      editor.setSaveStatus('error');
      return;
    }
    const remaining = templates.filter((t) => t.id !== removedId);
    setTemplates(remaining);
    setActiveId((cur) => (cur === removedId ? (remaining[0]?.id ?? null) : cur));
    editor.setSelectedId(null);
  };

  const onPublish = async () => {
    if (!active) return;
    setBusy(true);
    await editor.flushSave();
    const res = await publishPage(active.id);
    setBusy(false);
    if (res.ok && res.data) {
      const published = res.data;
      setTemplates((ts) => ts.map((t) => (t.id === published.id ? toTemplate(published) : t)));
      editor.setSaveStatus('saved');
    } else {
      editor.setSaveStatus('error');
    }
  };

  // The public path this page previews at: a slugged singleton → `/{slug}`; the
  // home singleton → `/` (docs/49); a collection template renders per-record (no
  // single URL) and an unrouted slugless singleton has none → null = not
  // previewable. Without the home branch, every slugless page (incl. the home, and
  // every freshly-seeded one) left Preview permanently disabled.
  const previewPath: string | null =
    active?.kind === 'singleton'
      ? active.slug
        ? active.slug.replace(/^\/+/, '')
        : active.id === homeId
          ? ''
          : null
      : null;

  // Open the live site at this page on its DRAFT (docs/45 §2.6): flush the autosave
  // so the draft on disk is current, mint a short-lived site-preview token, then
  // open `<origin>/<path>?tenant=…&property=…&sparxSitePreview=…` in a new tab.
  // `&property=` scopes it to the site being authored (docs/49) — without it the
  // storefront falls back to the primary site. Needs a previewable path + a
  // resolved site origin (else disabled).
  const canPreview = previewPath !== null && Boolean(siteOrigin && tenantSlug);
  const onPreview = async () => {
    if (previewPath === null || !siteOrigin || !tenantSlug) return;
    setBusy(true);
    await editor.flushSave();
    const res = await mintBuilderPreviewToken();
    setBusy(false);
    if (!res.ok || !res.data) {
      editor.setSaveStatus('error');
      return;
    }
    const propertyQuery = previewPropertySlug
      ? `&property=${encodeURIComponent(previewPropertySlug)}`
      : '';
    const url =
      `${siteOrigin}/${previewPath}?tenant=${encodeURIComponent(tenantSlug)}` +
      propertyQuery +
      `&sparxSitePreview=${encodeURIComponent(res.data.token)}`;
    window.open(url, '_blank', 'noopener');
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
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
    editor.setSaveStatus('saving');
    const res = await renamePage(id, name);
    editor.setSaveStatus(res.ok ? 'saved' : 'error');
  };

  // Set/clear the page's storefront slug (docs/44). Optimistic, then reflect the
  // server-normalized slug (or revert on a validation error).
  const onSlug = async (slug: string) => {
    if (!active) return;
    const id = active.id;
    const prev = active.slug;
    const optimistic = slug.trim() === '' ? null : slug.trim();
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, slug: optimistic } : t)));
    editor.setSaveStatus('saving');
    const res = await setPageSlug(id, slug);
    if (res.ok && res.data) {
      const saved = res.data;
      setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, slug: saved.slug } : t)));
      editor.setSaveStatus('saved');
    } else {
      setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, slug: prev } : t)));
      editor.setSaveStatus('error');
    }
  };

  // Retarget a collection template at the content type / source it renders per
  // record (docs/51 §6). Optimistic like onSlug; reflect the server value or revert.
  const onRetarget = async (recordType: string | null) => {
    if (!active) return;
    const id = active.id;
    const prev = active.recordType;
    setTemplates((ts) =>
      ts.map((t) => (t.id === id ? { ...t, recordType: recordType ?? undefined } : t))
    );
    editor.setSaveStatus('saving');
    const res = await retargetPage(id, recordType);
    if (res.ok && res.data) {
      const saved = res.data;
      setTemplates((ts) =>
        ts.map((t) => (t.id === id ? { ...t, recordType: saved.recordType ?? undefined } : t))
      );
      editor.setSaveStatus('saved');
    } else {
      setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, recordType: prev } : t)));
      editor.setSaveStatus('error');
    }
  };

  // Make the active collection template the DEFAULT for its recordType (docs/51
  // §6). Optimistic: flag this one and clear the others sharing the recordType
  // (one default per type); revert all on a server error.
  const onMakeDefault = async () => {
    if (!active?.recordType) return;
    const id = active.id;
    const rt = active.recordType;
    const prev = templates
      .filter((t) => t.recordType === rt)
      .map((t) => ({ id: t.id, isDefault: t.isDefault }));
    setTemplates((ts) =>
      ts.map((t) => (t.recordType === rt ? { ...t, isDefault: t.id === id } : t))
    );
    editor.setSaveStatus('saving');
    const res = await setPageDefault(id);
    if (res.ok) {
      editor.setSaveStatus('saved');
    } else {
      setTemplates((ts) =>
        ts.map((t) => {
          const p = prev.find((x) => x.id === t.id);
          return p ? { ...t, isDefault: p.isDefault } : t;
        })
      );
      editor.setSaveStatus('error');
    }
  };

  // Inline "+ New field" from the inspector binding picker (docs/51 keystone) —
  // the quick path that adds a field to the active template's content type and
  // returns its key so the picker can bind the node to it. Fetches the raw
  // schema (the binding catalog is lossy — no required/max), appends, and saves;
  // a built-in forks server-side. Refreshes so the catalog gains the field.
  const onAddField = async (label: string, kind: CreatableType): Promise<string | null> => {
    if (!contentTypeKey) return null;
    const cur = await getContentTypeSchema(contentTypeKey);
    if (!cur.ok || !cur.data) return null;
    const existing = cur.data.schema_json.fields ?? [];
    const key = deriveFieldKey(label, existing);
    const res = await saveContentTypeSchema(contentTypeKey, [
      ...existing,
      makeFieldDef(kind, key, label),
    ]);
    if (!res.ok) return null;
    router.refresh();
    return key;
  };

  // "Save as component" (docs/53 P-C): turn the selected subtree into a reusable
  // tenant component, then replace it in-place with a pinned placement. The subtree
  // may itself contain components (nesting, docs/53 4a) — the create call rejects a
  // cycle/over-deep nesting server-side. The new component seeds with a sensible
  // name (rename + parameterize in the component editor); router.refresh reloads
  // the component map so the placement previews.
  const onSaveAsComponent = async (node: BuilderNode) => {
    const def = getDef(node.type);
    setBusy(true);
    const res = await copyComponent({
      name: node.name ?? def?.label ?? 'Component',
      group: def?.group ?? 'content',
      icon: 'box',
      surfaces: ['page'],
      tree: node,
    });
    if (!res.ok || !res.data) {
      setBusy(false);
      editor.setSaveStatus('error');
      return;
    }
    const created = res.data;
    editor.replaceNode(
      node.id,
      makeCustomNode(created.key, created.latestVersion, makeId('custom'))
    );
    await editor.flushSave();
    setBusy(false);
    editor.setSaveStatus('saved');
    router.refresh();
  };

  // Patch the active singleton's SEO (docs/50). Optimistic like onSlug: write the
  // merged values immediately, revert on a server error. Empty strings clear a
  // field server-side, so the storefront falls back to the page name.
  const onSeo = async (patch: Partial<PageSeo>) => {
    if (!active) return;
    const id = active.id;
    const prev = active.seo;
    const next = { ...prev, ...patch };
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, seo: next } : t)));
    editor.setSaveStatus('saving');
    const res = await updatePageSeo(id, {
      seoTitle: next.title,
      seoDescription: next.description,
      canonical: next.canonical,
      ogImage: next.ogImage,
      noindex: next.noindex,
    });
    if (res.ok) {
      editor.setSaveStatus('saved');
    } else {
      setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, seo: prev } : t)));
      editor.setSaveStatus('error');
    }
  };

  // Import a page document/tree into the ACTIVE page: validate, replace its
  // tree, persist. Keeps the page's identity (name/slug/kind) — only the tree is
  // replaced. Returns an error message (shown by the control) or null.
  const onImportText = (text: string): string | null => {
    if (!active) return 'No active page to import into.';
    const result = parsePageImport(text);
    if (!result.ok) return result.error;
    const id = active.id;
    setTemplates((ts) => ts.map((t) => (t.id === id ? { ...t, tree: result.tree } : t)));
    editor.setSelectedId(null);
    editor.setSaveStatus('saving');
    void savePageTree(id, result.tree).then((res) =>
      editor.setSaveStatus(res.ok ? 'saved' : 'error')
    );
    return null;
  };

  const activeModules = MODULES.filter((m) => m.on);
  const offModules = MODULES.filter((m) => !m.on);

  // No pages (a failed load). Offer a way in rather than a blank editor.
  if (!active || !tree) {
    return (
      <ModuleProvider module="builder">
        <div className="bx-shell">
          <div className="bx-noempty">
            <p className="bx-noempty__lead">No pages yet.</p>
            <Button
              size="sm"
              variant="solid"
              leftIcon={<Plus className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void onNewTemplate()}
            >
              Create a page
            </Button>
          </div>
        </div>
      </ModuleProvider>
    );
  }

  return (
    <ModuleProvider module="builder">
      <div className="bx-shell">
        {/* Editor toolbar — page-specific actions. The global header, main
            sidebar, and module sidebar come from the dashboard shell. */}
        <div className="bx-toolbar">
          {/* Which site you're editing — hidden for single-site tenants. */}
          <SiteSwitcher properties={properties} activePropertyId={activePropertyId} />
          <div className="bx-toolbar__templates">
            {renaming ? (
              <Input
                ref={renameInputRef}
                size="sm"
                className="bx-tplselect"
                value={nameDraft}
                aria-label="Page name"
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
                aria-label="Page"
                onChange={(e) => onSelectTemplate(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {templateLabel(t)}
                  </option>
                ))}
              </NativeSelect>
            )}
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Rename this page"
              disabled={busy || renaming}
              onClick={startRename}
            >
              <Pencil aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="New page"
              disabled={busy || renaming}
              onClick={() => void onNewTemplate()}
            >
              <Plus aria-hidden />
            </button>
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Delete this page"
              disabled={busy || renaming || templates.length <= 1}
              onClick={() => void onDeleteActive()}
            >
              <Trash2 aria-hidden />
            </button>
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
              disabled={busy || !canPreview}
              title={
                canPreview
                  ? 'Open this page’s draft on the live site'
                  : active?.kind === 'collection'
                    ? 'Collection templates preview per record, not as one page'
                    : 'This page has no public URL yet'
              }
              onClick={() => void onPreview()}
            >
              Preview
            </Button>
            <ImportExportControls
              kind="page"
              name={active.name}
              getDocument={() =>
                toPageDocument({
                  name: active.name,
                  kind: active.kind,
                  slug: active.slug,
                  recordType: active.recordType ?? null,
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

        {/* Context bar — what this page composes from */}
        <div className="bx-ctx">
          <span className="bx-ctx__lead">This page composes data from</span>
          {activeModules.map((m) => (
            <span
              key={m.key}
              className="bx-ctx__chip"
              style={{ '--chip': m.color } as React.CSSProperties}
            >
              <span className="bx-ctx__dot" />
              {m.label}
            </span>
          ))}
          {offModules.map((m) => (
            <span key={m.key} className="bx-ctx__chip bx-ctx__chip--off">
              {m.label}
              <span className="bx-ctx__enable">+ enable</span>
            </span>
          ))}
          <span className="bx-ctx__note">
            Commerce is one module among many — turn it off and its sections just hide.
          </span>
        </div>

        <BuilderWorkspace
          tree={tree}
          editor={editor}
          catalog={bindingCatalog}
          surface="page"
          chrome={layoutTree ?? null}
          frame={
            siteOrigin ? { kind: 'browser', origin: siteOrigin, path: active.slug } : undefined
          }
          components={componentsByKey}
          contentTypeKey={contentTypeKey}
          onAddField={onAddField}
          onSaveAsComponent={onSaveAsComponent}
          fields={contentTypeKey ? <FieldsPanel typeKey={contentTypeKey} /> : undefined}
          settings={
            <PageSettings
              pageId={active.id}
              name={active.name}
              slug={active.slug}
              kind={active.kind}
              recordType={active.recordType ?? null}
              isDefault={active.isDefault}
              catalog={bindingCatalog}
              seo={active.seo}
              onSlug={onSlug}
              onSeo={onSeo}
              onRetarget={onRetarget}
              onMakeDefault={onMakeDefault}
            />
          }
        />
      </div>
    </ModuleProvider>
  );
}
