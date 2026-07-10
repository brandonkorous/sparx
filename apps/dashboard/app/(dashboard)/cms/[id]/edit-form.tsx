'use client';

// Edit-form for one CMS page entry. Explicit-save only (one Save button),
// last-write-wins — consistent with every other dashboard editor. An unsaved
// edit registers the leave-guard (docs/105) so closing / navigating away
// confirms before discarding. (Autosave + ETag conflict detection were removed
// platform-wide for consistency.)

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AdaptiveLabel, statusLabel, statusTone, toast, useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Label,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import { ContentBlockEditor, EMPTY_DOC, type CmsDoc } from '@sparx/cms-editor';
import Link from 'next/link';
import { CalendarClock, Check, History, Trash2 } from 'lucide-react';
import type { Property } from '@/lib/sites';
import { deletePage, schedulePagePublish, setPageStatus, updatePage } from '../actions';
import { SiteScopeField } from '../../_components/site-scope-field';
import { SeoPanel, type SeoFields } from './seo-panel';
import { PreviewButton } from './preview-button';
import { DetailFooterSlot, DetailHeaderSlot } from '../../_components/detail-header-slot';
import { useUnsavedGuard } from '../../_components/unsaved-guard';

export interface EditableTenantPage {
  id: string;
  typeKey: string;
  slug: string;
  title: string;
  status: string;
  body: CmsDoc;
  seo: SeoFields;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  updatedAt: Date;
}

const ZONE_DOMAIN = process.env.NEXT_PUBLIC_SPARX_ZONE_DOMAIN ?? 'sparx.zone';

function siteOrigin(tenantSlug: string | null): string {
  if (tenantSlug) return `https://${tenantSlug}.${ZONE_DOMAIN}`;
  return process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://sparx.works';
}

export function EditPageForm({
  page,
  tenantSlug,
  sites,
  initialPropertyIds,
}: {
  page: EditableTenantPage;
  tenantSlug: string | null;
  // Multi-site (docs/49 §3) — the tenant's sites + this page's current scope.
  // SiteScopeField hides itself for single-site tenants.
  sites: Property[];
  initialPropertyIds: string[];
}) {
  const previewOrigin = siteOrigin(tenantSlug);
  const router = useRouter();
  const confirm = useConfirm();
  const multiSite = sites.length > 1;
  // Scoped to the schedule dialog only now — it has room for an inline error.
  // The main Save/Publish/Delete actions surface failures as a toast (see
  // below): the header lifecycle zone and the compact footer Save slot have no
  // room for a persistent error line, matching the Product edit form.
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [doc, setDoc] = React.useState<CmsDoc>(page.body ?? EMPTY_DOC);
  const [title, setTitle] = React.useState(page.title);
  const [slug, setSlug] = React.useState(page.slug);
  const [seo, setSeo] = React.useState<SeoFields>(page.seo);

  const v = useFieldValidation(
    { title, slug },
    { title: rule.required('Title is required.'), slug: rule.required('Slug is required.') }
  );
  const [propertyIds, setPropertyIds] = React.useState<string[]>(initialPropertyIds);

  // Schedule dialog (kept in this file so it shares the edit form's local state
  // without prop-drilling). Delete uses useConfirm — no open state needed.
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleAt, setScheduleAt] = React.useState<Date | undefined>(
    page.scheduledAt ?? undefined
  );

  // Unsaved-changes guard (docs/105): `dirty` is a RENDER-COMPUTED compare against
  // the last-saved snapshot — no effect, so it's immune to StrictMode's dev
  // double-invoke (a "skip first render" ref flips dirty spuriously there) and to
  // the block editor's on-mount normalization (an equal doc compares equal). The
  // baseline is a ref advanced on each successful Save rather than the props, so a
  // JSONB key-reorder on refetch can't make a just-saved page look dirty.
  const savedRef = React.useRef({
    title: page.title,
    slug: page.slug,
    doc: page.body ?? EMPTY_DOC,
    seo: page.seo,
    propertyIds: initialPropertyIds,
  });
  const saved = savedRef.current;
  const dirty =
    title !== saved.title ||
    slug !== saved.slug ||
    JSON.stringify(doc) !== JSON.stringify(saved.doc) ||
    JSON.stringify(seo) !== JSON.stringify(saved.seo) ||
    JSON.stringify(propertyIds) !== JSON.stringify(saved.propertyIds);
  useUnsavedGuard(dirty, { kind: 'edit', noun: 'page' });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavedAt(null);
    if (!v.validate()) return;
    const formData = new FormData(e.currentTarget);
    formData.set('content', JSON.stringify(doc));
    formData.set('seoTitle', seo.title);
    formData.set('metaDescription', seo.description);
    formData.set('canonical', seo.canonical);
    formData.set('robots', seo.robots);
    formData.set('ogImage', seo.ogImage);
    // Model B per-site scoping (docs/49 §3) — multi-site only. Single-site
    // tenants don't render the control, so the key stays absent and api-rest
    // leaves the page's scope untouched.
    if (multiSite) formData.set('property_ids', JSON.stringify(propertyIds));

    startTransition(async () => {
      const result = await updatePage(page.id, formData);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save changes.');
        return;
      }
      // Advance the saved snapshot to what we just persisted, so the guard reads
      // clean immediately (independent of how the refetch serializes the body).
      savedRef.current = { title, slug, doc, seo, propertyIds };
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  function onTogglePublish() {
    const target = page.status === 'published' ? 'draft' : 'published';

    startTransition(async () => {
      const result = await setPageStatus(page.id, target);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not update status.');
        return;
      }
      toast.success(target === 'published' ? 'Published.' : 'Reverted to draft.');
      router.refresh();
    });
  }

  function confirmSchedule() {
    if (!scheduleAt) {
      setError('Pick a date and time to schedule the publish.');
      return;
    }
    if (scheduleAt.getTime() <= Date.now()) {
      setError('Pick a time in the future.');
      return;
    }
    setError(null);
    const target = scheduleAt;

    startTransition(async () => {
      const result = await schedulePagePublish(page.id, target.toISOString());
      if (!result.ok) {
        setError(result.error ?? 'Could not schedule publish.');
        return;
      }
      setScheduleOpen(false);
      toast.success(`Scheduled for ${target.toLocaleString()}`);
      router.refresh();
    });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: 'Delete this page?',
      description: (
        <>
          <strong>{page.title || '(untitled)'}</strong>
          {page.slug && (
            <>
              {' '}
              at <code>/{page.slug}</code>
            </>
          )}{' '}
          will be soft-deleted. The entry stays recoverable in the database for 30 days but will not
          render on the site or appear in lists. Use <em>Unpublish</em> instead if you want it to
          stay editable.
        </>
      ),
      confirmLabel: 'Delete page',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await deletePage(page.id);
      if (!result.ok) {
        toast.error(result.error ?? 'Could not delete page.');
        return;
      }
      router.push('/cms');
      router.refresh();
    });
  }

  return (
    <form id="cms-page-edit-form" onSubmit={onSubmit} noValidate>
      {/* Lifecycle controls live in the detail frame's header (drawer chrome or
          the full-page shell), not a bespoke Status card atop the form — parity
          with Product. The form still owns all the state + handlers; this just
          teleports the cluster up. */}
      <DetailHeaderSlot>
        <Badge color={statusTone(page.status)} variant="soft">
          {statusLabel(page.status)}
        </Badge>
        <PreviewButton
          iconOnly
          entryId={page.id}
          slug={page.slug}
          typeKey={page.typeKey}
          tenantSlug={tenantSlug}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          render={<Link href={`/cms/${page.id}/revisions`} />}
          aria-label="Revisions"
          title="Revisions"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
        {/* Delete is rare + destructive (soft-delete), so it's demoted the same
            way Product demotes Archive: icon-only ghost + tooltip, placed before
            the primary forward action (Publish). */}
        <Tooltip content="Delete">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Delete"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
        {page.status !== 'published' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Schedule publish"
            title="Schedule publish"
            onClick={() => setScheduleOpen(true)}
            disabled={pending}
          >
            <CalendarClock className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          type="button"
          color={page.status === 'published' ? 'neutral' : 'module'}
          variant={page.status === 'published' ? 'outline' : 'solid'}
          size="sm"
          onClick={onTogglePublish}
          disabled={pending}
        >
          {page.status === 'published' ? 'Unpublish' : 'Publish'}
        </Button>
      </DetailHeaderSlot>

      <div className="flex flex-col gap-6">
        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Content</h3>
            <p className="opacity-70">
              Title, slug, and the body block editor. Edits are saved when you click Save changes.
            </p>
            <div className="flex flex-col gap-4">
              <Field {...v.field('title')}>
                <FieldLabel required>Title</FieldLabel>
                <FieldControl
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  {...v.control('title')}
                />
              </Field>
              <Field {...v.field('slug')}>
                <FieldLabel required>Slug</FieldLabel>
                <FieldControl
                  name="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  {...v.control('slug')}
                />
                <FieldDescription>/{slug} is your site path.</FieldDescription>
              </Field>
              <div className="flex flex-col gap-2">
                <Label htmlFor="entry-body-editor">Body</Label>
                <ContentBlockEditor
                  id="entry-body-editor"
                  value={doc}
                  onChange={setDoc}
                  placeholder="Write the page body. Use the toolbar for formatting."
                  ariaLabel="Page body editor"
                />
              </div>
            </div>
          </CardBody>
        </Card>

        {multiSite && (
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Sites</h3>
              <p className="opacity-70">Which of your sites show this page.</p>
              <SiteScopeField sites={sites} value={propertyIds} onChange={setPropertyIds} />
            </CardBody>
          </Card>
        )}

        <SeoPanel
          value={seo}
          onChange={setSeo}
          previewOrigin={previewOrigin}
          slug={slug}
          fallbackTitle={title}
          entryId={page.id}
        />
      </div>

      {/* The primary action teleports up into the frame's top toolbar (next to
          lifecycle actions), not floored at the bottom — it renders OUTSIDE the
          scrolling body, portaled out of this <form>, so it re-associates by id.
          A failed save surfaces as a toast — there's no room for a persistent
          error line in the compact shared toolbar row. */}
      <DetailFooterSlot>
        <div className="flex items-center gap-2">
          {savedAt !== null && !dirty && (
            <span className="text-success flex items-center gap-1 text-xs">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}
          <Button
            type="submit"
            form="cms-page-edit-form"
            size="sm"
            color="module"
            disabled={pending || !dirty}
            loading={pending}
          >
            <AdaptiveLabel label={{ full: 'Save changes', short: 'Save' }} />
          </Button>
        </div>
      </DetailFooterSlot>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <div className="px-6 pt-6">
            <DialogTitle>Schedule publish</DialogTitle>
            <DialogDescription>
              Pick when this page should flip to <strong>published</strong>. Times are interpreted
              in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}) and stored
              as UTC on the server.
            </DialogDescription>
          </div>
          <div className="px-6 py-4">
            <Field className="gap-3">
              <FieldLabel required>When</FieldLabel>
              <DatePicker
                id="schedule-at"
                value={scheduleAt ?? null}
                onValueChange={(d) => setScheduleAt(d ?? undefined)}
              />
              {scheduleAt && (
                <FieldDescription aria-live="polite">
                  Will publish at <strong>{scheduleAt.toLocaleString()}</strong>
                  {' · '}UTC <code>{scheduleAt.toISOString()}</code>
                </FieldDescription>
              )}
              {error && (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
              )}
            </Field>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-6">
            <Button type="button" variant="ghost" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              color="module"
              onClick={confirmSchedule}
              disabled={pending || !scheduleAt}
              loading={pending}
            >
              Schedule publish
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
