'use client';

// Page-settings for the silica studio (docs/118 Stage 10) — the SEO + collection-
// template controls that silica's flat `Page` schema (`{id,name,slug,root}`) has no
// home for. They live on the sparx `BuilderPage` ROW columns, edited here and
// persisted through the SAME page endpoints the legacy builder uses (the silica page
// id IS the row id — `siteService.sync` reuses it), so no silica onChange ever
// carries this domain metadata.
//
// Three controls, three existing server actions:
//   · recordType picker → `retargetPage` (a page WITH a record type IS a collection
//     template; the service derives kind='collection' from it). This is what makes a
//     page the storefront's product / entry template.
//   · "Make default"    → `setPageDefault` (the per-type winner when a record has no
//     per-record override).
//   · SEO fields        → `updatePageSeo` (title/description/canonical/ogImage/noindex).
//
// Reached from the header `toolbarSlot` button (silica-toolbar). The metadata seed
// comes from the server-fetched page list; a page not yet in it (materialized on the
// next autosave) shows a "save first" note rather than 404-ing a write.

import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  NativeSelect,
  Switch,
  Textarea,
} from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';
import type { BuilderPageDto, DataSource } from '@sparx/builder-schemas';

import { retargetPage, setPageDefault, updatePageSeo } from '../_lib/actions';

export interface SilicaPageSettingsProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** The active page (id === the BuilderPage row id). */
  page: { id: string; name: string };
  /** The row's current metadata, from the server-fetched page list. Undefined
   *  when the page hasn't been materialized into a row yet (a brand-new page
   *  before its first autosave) — the controls stay disabled until it is. */
  meta: BuilderPageDto | undefined;
  /** The tenant's binding catalog; the collection (`array`) sources are the
   *  record types a template can render. */
  sources: DataSource[];
}

interface SeoState {
  seoTitle: string;
  seoDescription: string;
  canonical: string;
  ogImage: string;
  noindex: boolean;
}

function seedSeo(meta: BuilderPageDto | undefined): SeoState {
  return {
    seoTitle: meta?.seoTitle ?? '',
    seoDescription: meta?.seoDescription ?? '',
    canonical: meta?.canonical ?? '',
    ogImage: meta?.ogImage ?? '',
    noindex: meta?.noindex ?? false,
  };
}

/** The search-metadata fieldset — a standalone page's SEO (a collection template
 *  inherits SEO per-record, so this is hidden there). Split out of the drawer body
 *  as its own cohesive unit. */
function SeoFields({
  seo,
  disabled,
  pageName,
  onChange,
}: {
  seo: SeoState;
  disabled: boolean;
  pageName: string;
  onChange: (next: (s: SeoState) => SeoState) => void;
}) {
  return (
    <div className="border-base-300 flex flex-col gap-4 border-t pt-5">
      <Field>
        <FieldLabel>Search engine title</FieldLabel>
        <Input
          value={seo.seoTitle}
          disabled={disabled}
          placeholder={pageName}
          onChange={(e) => onChange((s) => ({ ...s, seoTitle: e.target.value }))}
        />
      </Field>
      <Field>
        <FieldLabel>Search engine description</FieldLabel>
        <Textarea
          value={seo.seoDescription}
          disabled={disabled}
          rows={3}
          placeholder="A sentence or two describing this page for search results."
          onChange={(e) => onChange((s) => ({ ...s, seoDescription: e.target.value }))}
        />
      </Field>
      <Field>
        <FieldLabel>Canonical URL</FieldLabel>
        <Input
          value={seo.canonical}
          disabled={disabled}
          placeholder="Leave blank unless this page duplicates another."
          onChange={(e) => onChange((s) => ({ ...s, canonical: e.target.value }))}
        />
      </Field>
      <Field>
        <FieldLabel>Social share image URL</FieldLabel>
        <Input
          value={seo.ogImage}
          disabled={disabled}
          placeholder="https://…"
          onChange={(e) => onChange((s) => ({ ...s, ogImage: e.target.value }))}
        />
      </Field>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <FieldLabel>Hide from search engines</FieldLabel>
          <FieldDescription>Ask Google and others not to list this page.</FieldDescription>
        </div>
        <Switch
          checked={seo.noindex}
          disabled={disabled}
          onCheckedChange={(v) => onChange((s) => ({ ...s, noindex: v }))}
          color="warning"
        />
      </div>
    </div>
  );
}

export function SilicaPageSettings({
  open,
  onOpenChange,
  page,
  meta,
  sources,
}: SilicaPageSettingsProps) {
  const [recordType, setRecordType] = useState<string>(meta?.recordType ?? '');
  const [isDefault, setIsDefault] = useState<boolean>(meta?.isDefault ?? false);
  const [seo, setSeo] = useState<SeoState>(() => seedSeo(meta));
  const [busy, setBusy] = useState(false);

  // Re-seed whenever the drawer opens on a (possibly different) page, so it always
  // reflects the freshest server metadata rather than a stale prior edit.
  useEffect(() => {
    if (!open) return;
    setRecordType(meta?.recordType ?? '');
    setIsDefault(meta?.isDefault ?? false);
    setSeo(seedSeo(meta));
  }, [open, meta]);

  const collectionSources = sources.filter((s) => s.cardinality === 'array');
  const materialized = meta !== undefined;
  const isCollection = recordType !== '';

  async function applyRecordType(next: string): Promise<void> {
    setRecordType(next);
    setBusy(true);
    const res = await retargetPage(page.id, next === '' ? null : next);
    setBusy(false);
    if (res.ok) {
      // Clearing the type returns the page to a standalone singleton, which can't
      // be a default — mirror that locally so the "Make default" affordance hides.
      if (next === '') setIsDefault(false);
      toast.success(next === '' ? 'Page is now standalone' : 'Template target set');
    } else {
      toast.error(res.error ?? 'Could not update the template target.');
    }
  }

  async function makeDefault(): Promise<void> {
    setBusy(true);
    const res = await setPageDefault(page.id);
    setBusy(false);
    if (res.ok) {
      setIsDefault(true);
      toast.success('Set as the default template for this record type');
    } else {
      toast.error(res.error ?? 'Could not set the default.');
    }
  }

  async function saveSeo(): Promise<void> {
    setBusy(true);
    const res = await updatePageSeo(page.id, seo);
    setBusy(false);
    if (res.ok) toast.success('SEO saved');
    else toast.error(res.error ?? 'Could not save SEO.');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Page settings — {page.name}</DialogTitle>
          <DialogDescription>
            Choose how this page is used and how search engines and social links see it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-6 py-2">
          {!materialized && (
            <p className="text-base-content/70 text-base">
              These settings become available once your first change to this page has saved.
            </p>
          )}

          {/* Template target — what makes a page a per-record template. */}
          <Field>
            <FieldLabel>Page type</FieldLabel>
            <NativeSelect
              value={recordType}
              disabled={!materialized || busy}
              onChange={(e) => void applyRecordType(e.target.value)}
            >
              <option value="">Standalone page</option>
              {collectionSources.map((s) => (
                <option key={s.key} value={s.key}>
                  Template for every {s.label}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>
              A standalone page lives at its own address. A template renders every record of one
              type — a product page, a blog post — with that record’s content.
            </FieldDescription>
          </Field>

          {isCollection && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <FieldLabel>Use as the default</FieldLabel>
                <FieldDescription>
                  Show this template for every record of its type that doesn’t have its own.
                </FieldDescription>
              </div>
              <Switch
                checked={isDefault}
                disabled={!materialized || busy || isDefault}
                onCheckedChange={() => void makeDefault()}
                color="primary"
              />
            </div>
          )}

          {/* SEO — inert on a collection template (each record supplies its own). */}
          {!isCollection && (
            <SeoFields
              seo={seo}
              disabled={!materialized || busy}
              pageName={page.name}
              onChange={setSeo}
            />
          )}
        </div>

        <DialogFooter className="px-6 pb-6">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isCollection && (
            <Button color="primary" disabled={!materialized || busy} onClick={() => void saveSeo()}>
              Save SEO
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
