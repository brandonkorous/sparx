'use client';

// Edit-form for one CMS page entry. Explicit-save only (one Save button),
// last-write-wins — consistent with every other dashboard editor. An unsaved
// edit registers the leave-guard (docs/105) so closing / navigating away
// confirms before discarding. (Autosave + ETag conflict detection were removed
// platform-wide for consistency.)

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  DatePicker,
  Heading,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  Stack,
  statusLabel,
  statusTone,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import { ContentBlockEditor, EMPTY_DOC, type CmsDoc } from '@sparx/cms-editor';
import Link from 'next/link';
import { CalendarClock, History, Trash2 } from 'lucide-react';
import type { Property } from '@/lib/sites';
import { deletePage, schedulePagePublish, setPageStatus, updatePage } from '../actions';
import { SiteScopeField } from '../../_components/site-scope-field';
import { SeoPanel, type SeoFields } from './seo-panel';
import { PreviewButton } from './preview-button';
import { DetailHeaderSlot } from '../../_components/detail-header-slot';
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
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [doc, setDoc] = React.useState<CmsDoc>(page.body ?? EMPTY_DOC);
  const [title, setTitle] = React.useState(page.title);
  const [slug, setSlug] = React.useState(page.slug);
  const [seo, setSeo] = React.useState<SeoFields>(page.seo);
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
    setError(null);
    setMessage(null);
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
        setError(result.error ?? 'Could not save changes.');
        return;
      }
      // Advance the saved snapshot to what we just persisted, so the guard reads
      // clean immediately (independent of how the refetch serializes the body).
      savedRef.current = { title, slug, doc, seo, propertyIds };
      setMessage('Saved.');
      router.refresh();
    });
  }

  function onTogglePublish() {
    setError(null);
    setMessage(null);
    const target = page.status === 'published' ? 'draft' : 'published';

    startTransition(async () => {
      const result = await setPageStatus(page.id, target);
      if (!result.ok) {
        setError(result.error ?? 'Could not update status.');
        return;
      }
      setMessage(target === 'published' ? 'Published.' : 'Reverted to draft.');
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
    setMessage(null);
    const target = scheduleAt;

    startTransition(async () => {
      const result = await schedulePagePublish(page.id, target.toISOString());
      if (!result.ok) {
        setError(result.error ?? 'Could not schedule publish.');
        return;
      }
      setScheduleOpen(false);
      setMessage(`Scheduled for ${target.toLocaleString()}.`);
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
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deletePage(page.id);
      if (!result.ok) {
        setError(result.error ?? 'Could not delete page.');
        return;
      }
      router.push('/cms');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
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
          asChild
          aria-label="Revisions"
          title="Revisions"
        >
          <Link href={`/cms/${page.id}/revisions`}>
            <History className="h-3.5 w-3.5" />
          </Link>
        </Button>
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

      <Stack gap={6}>
        <Card variant="default">
          <CardHeader>
            <Heading level={3}>Content</Heading>
            <CardDescription>
              Title, slug, and the body block editor. Edits are saved when you click Save changes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Stack gap={4}>
              <Stack gap={2}>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  required
                />
                <Text size="xs" variant="muted">
                  /{slug} is your site path.
                </Text>
              </Stack>
              <Stack gap={2}>
                <Label htmlFor="entry-body-editor">Body</Label>
                <ContentBlockEditor
                  id="entry-body-editor"
                  value={doc}
                  onChange={setDoc}
                  placeholder="Write the page body. Use the toolbar for formatting."
                  ariaLabel="Page body editor"
                />
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {multiSite && (
          <Card variant="default">
            <CardHeader>
              <Heading level={3}>Sites</Heading>
              <CardDescription>Which of your sites show this page.</CardDescription>
            </CardHeader>
            <CardContent>
              <SiteScopeField sites={sites} value={propertyIds} onChange={setPropertyIds} />
            </CardContent>
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

        <Card variant="default">
          <CardContent>
            <Stack gap={2}>
              {error && (
                <Text size="sm" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}
              {message && (
                <Text size="sm" variant="success" aria-live="polite">
                  {message}
                </Text>
              )}
            </Stack>
          </CardContent>
          <CardFooter>
            <Button
              type="button"
              variant="ghost"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={handleDelete}
              disabled={pending}
            >
              Delete
            </Button>
            <Button type="submit" color="module" disabled={pending} loading={pending}>
              Save changes
            </Button>
          </CardFooter>
        </Card>
      </Stack>

      <Modal open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Schedule publish</ModalTitle>
            <ModalDescription>
              Pick when this page should flip to <strong>published</strong>. Times are interpreted
              in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}) and stored
              as UTC on the server.
            </ModalDescription>
          </ModalHeader>
          <div className="px-6 py-4">
            <Stack gap={3}>
              <Label htmlFor="schedule-at" required>
                When
              </Label>
              <DatePicker value={scheduleAt} onChange={setScheduleAt} />
              {scheduleAt && (
                <Text size="xs" variant="muted" aria-live="polite">
                  Will publish at <strong>{scheduleAt.toLocaleString()}</strong>
                  {' · '}UTC <code>{scheduleAt.toISOString()}</code>
                </Text>
              )}
              {error && (
                <Text size="sm" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}
            </Stack>
          </div>
          <ModalFooter>
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
          </ModalFooter>
        </ModalContent>
      </Modal>
    </form>
  );
}
