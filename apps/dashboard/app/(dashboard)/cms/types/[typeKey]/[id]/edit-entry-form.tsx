'use client';

// Edit container for one content-type entry. The entries analog of the CMS
// Pages editor's `EditPageForm` — same card layout (Status / Content / SEO /
// footer), explicit-save only (one Save button, last-write-wins), so editing a
// blog post feels identical to editing a page.
//
// The body is SCHEMA-DRIVEN: the content type owns its fields, so the Content
// card hosts a controlled `<ContentEntryForm>` (one FieldRenderer per field)
// rather than a fixed title/slug/rich-text set — `slug`, `title`, etc. are body
// keys the schema declares. Body + SEO (+ slug for routable types) save in ONE
// PATCH via `saveEntry`; SEO reuses the Pages editor's `SeoPanel` verbatim. An
// unsaved edit registers the leave-guard (docs/105) so closing / navigating away
// confirms before discarding. (Autosave + ETag conflict detection were removed
// platform-wide for consistency.)

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast, useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardActions,
  CardBody,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  FieldStatus,
} from '@wizeworks/silicaui-react';
import { Trash2 } from 'lucide-react';
import { type FieldDef } from '@sparx/cms-schemas';
import type { BuilderTemplateOption } from '@sparx/builder-schemas';
import type { Property } from '@/lib/sites';
import { ContentEntryForm, missingRequiredFields } from '../../../_components/content-entry-form';
import { SiteScopeField } from '../../../../_components/site-scope-field';
import { SeoPanel, type SeoFields } from '../../../[id]/seo-panel';
import { EntryStatusBar } from './entry-status-bar';
import { DetailHeaderSlot } from '../../../../_components/detail-header-slot';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import { EntryTemplatePicker } from './entry-template-picker';
import { deleteEntry, saveEntry, scheduleEntryPublish, setEntryStatus } from '../../actions';

const ZONE_DOMAIN = process.env.NEXT_PUBLIC_SPARX_ZONE_DOMAIN ?? 'sparx.zone';

function siteOrigin(tenantSlug: string | null): string {
  if (tenantSlug) return `https://${tenantSlug}.${ZONE_DOMAIN}`;
  return process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://sparx.works';
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export interface EditEntryFormProps {
  id: string;
  typeKey: string;
  /** Human label for the type, e.g. "Blog post" — used in copy. */
  typeName: string;
  /** Routable types carry a URL pattern; null ⇒ no slug / SEO / preview. */
  urlPattern: string | null;
  /** The entry's top-level `slug` column. The routing slug of record — used for
   *  the SEO preview + Preview link. Types whose schema has no editable slug
   *  field (e.g. blog_post, auto-derived) keep their slug here, not in body. */
  initialSlug: string;
  schema: { fields: FieldDef[] };
  initialBody: Record<string, unknown>;
  initialSeo: SeoFields;
  initialStatus: string;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  tenantSlug: string | null;
  /** Per-record template override (docs/51 §6). Null when the Builder module is
   *  off or the type has no collection template — the picker then doesn't render. */
  templateOptions?: BuilderTemplateOption[] | null;
  /** The currently-pinned template id, or null when this entry uses the default. */
  currentTemplateId?: string | null;
  // Multi-site (docs/49 §3) — the tenant's sites + this entry's current scope.
  // SiteScopeField hides itself for single-site tenants, so the Sites card only
  // appears once a tenant runs more than one property.
  sites: Property[];
  initialPropertyIds: string[];
  /** Mirror every body change up to the editor workspace, so an embedded live
   *  preview can re-render as you type (docs/51 §6). This component still OWNS the
   *  body; the workspace only observes it. Omitted ⇒ no preview. */
  onBody?: (body: Record<string, unknown>) => void;
  /** When the editor workspace hosts a builder-style toolbar (the live-preview
   *  surface), it passes a DOM slot here and the status + publish actions render
   *  INTO it (the 'bar' layout) instead of as the standalone Status card. The form
   *  still owns all the state — only the DOM location moves. Undefined ⇒ the card. */
  statusSlot?: HTMLElement | null;
  /** Drawer/modal surfaces (no live-preview toolbar) route the status bar into the
   *  detail chrome header instead of the standalone Status card. Full-page surfaces
   *  with no chrome header (a type with no builder template) leave this false and keep
   *  the card. */
  statusInHeader?: boolean;
}

export function EditEntryForm({
  id,
  typeKey,
  typeName,
  urlPattern,
  initialSlug,
  schema,
  initialBody,
  initialSeo,
  initialStatus,
  publishedAt,
  scheduledAt,
  tenantSlug,
  templateOptions,
  currentTemplateId,
  sites,
  initialPropertyIds,
  onBody,
  statusSlot,
  statusInHeader,
}: EditEntryFormProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const routable = Boolean(urlPattern);
  const previewOrigin = siteOrigin(tenantSlug);
  const multiSite = sites.length > 1;
  const lowerType = typeName.toLowerCase();

  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const [body, setBody] = React.useState<Record<string, unknown>>(initialBody);
  const [seo, setSeo] = React.useState<SeoFields>(initialSeo);
  const [status, setStatus] = React.useState(initialStatus);
  const [propertyIds, setPropertyIds] = React.useState<string[]>(initialPropertyIds);

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleAt, setScheduleAt] = React.useState<Date | undefined>(scheduledAt ?? undefined);

  const slugFromBody = (): string | undefined => {
    const s = body.slug;
    return routable && typeof s === 'string' && s.length > 0 ? s : undefined;
  };

  // The effective routing slug: an editable `slug` field in the body wins (the
  // user can retype it); otherwise the persisted column (auto-derived types).
  const slug = str(body.slug) || initialSlug;
  const fallbackTitle = str(body.title);

  // Unsaved-changes guard (docs/105): `dirty` is a RENDER-COMPUTED compare against
  // the last-saved snapshot — no effect, so it's immune to StrictMode's dev
  // double-invoke (a "skip first render" ref flips dirty spuriously there) and to
  // any field's on-mount normalization (an equal value compares equal). The
  // baseline is a ref advanced on each successful Save rather than the props, so a
  // JSONB key-reorder on refetch can't make a just-saved entry look dirty. (`slug`
  // rides inside `body`, so comparing body covers it.)
  const savedRef = React.useRef({
    body: initialBody,
    seo: initialSeo,
    propertyIds: initialPropertyIds,
  });
  const saved = savedRef.current;
  const dirty =
    JSON.stringify(body) !== JSON.stringify(saved.body) ||
    JSON.stringify(seo) !== JSON.stringify(saved.seo) ||
    JSON.stringify(propertyIds) !== JSON.stringify(saved.propertyIds);
  useUnsavedGuard(dirty, { kind: 'edit', noun: lowerType });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const missing = missingRequiredFields({ fields: schema.fields }, body);
    if (missing.length) {
      setError(`Required: ${missing.join(', ')}.`);
      return;
    }
    startTransition(async () => {
      const result = await saveEntry(id, typeKey, {
        body,
        seo,
        slug: slugFromBody(),
        propertyIds: multiSite ? propertyIds : undefined,
      });
      if (!result.ok) {
        setError(result.error ?? 'Could not save changes.');
        return;
      }
      // Advance the saved snapshot to what we just persisted, so the guard reads
      // clean immediately (independent of how the refetch serializes the body).
      savedRef.current = { body, seo, propertyIds };
      setMessage('Saved.');
      router.refresh();
    });
  }

  function onTogglePublish() {
    setError(null);
    setMessage(null);
    const target = status === 'published' ? 'draft' : 'published';
    startTransition(async () => {
      const result = await setEntryStatus(id, typeKey, target);
      if (!result.ok) {
        setError(result.error ?? 'Could not update status.');
        return;
      }
      setStatus(target);
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
      const result = await scheduleEntryPublish(id, typeKey, target.toISOString());
      if (!result.ok) {
        setError(result.error ?? 'Could not schedule publish.');
        return;
      }
      setScheduleOpen(false);
      setStatus('scheduled');
      setMessage(`Scheduled for ${target.toLocaleString()}.`);
      toast.success(`Scheduled for ${target.toLocaleString()}`);
      router.refresh();
    });
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete this ${lowerType}?`,
      description: (
        <>
          <strong>{fallbackTitle || '(untitled)'}</strong>
          {slug && (
            <>
              {' '}
              at <code>/{slug}</code>
            </>
          )}{' '}
          will be soft-deleted. The entry stays recoverable in the database for 30 days but will not
          render on your site or appear in lists. Use <em>Unpublish</em> instead if you want it to
          stay editable.
        </>
      ),
      confirmLabel: `Delete ${lowerType}`,
      tone: 'danger',
    });
    if (!ok) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await deleteEntry(id, typeKey);
      if (!result.ok) {
        setError(result.error ?? 'Could not delete entry.');
        return;
      }
      // Back to this type's items on the unified content list (/cms/types/<key>
      // is now the schema page, not the entry list).
      router.push(`/cms/content?type=${typeKey}`);
      router.refresh();
    });
  }

  // The status + publish actions are one cohesive unit (EntryStatusBar) that the
  // form owns but renders in one of two places: the standalone Status card, or — on
  // the live-preview surface — PORTALED into the workspace's builder-style toolbar.
  // All the state stays here; `statusSlot` only moves where the DOM lands.
  const embedded = statusSlot !== undefined;
  const statusBarProps = {
    status,
    pending,
    routable,
    entryId: id,
    slug,
    typeKey,
    tenantSlug,
    publishedAt,
    scheduledAt,
    onTogglePublish,
    onSchedule: () => setScheduleOpen(true),
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="flex flex-col gap-6">
        {/* Live-preview surface: status + actions live in the toolbar (portaled into
            the workspace's slot). Otherwise the standalone Status card. */}
        {embedded ? (
          statusSlot ? (
            createPortal(<EntryStatusBar layout="bar" {...statusBarProps} />, statusSlot)
          ) : null
        ) : statusInHeader ? (
          // Drawer/modal: the type signal + status/publish bar teleport into the
          // detail chrome header (parity with Product), not a Status card atop the form.
          <DetailHeaderSlot>
            <Badge color="module">{lowerType}</Badge>
            <EntryStatusBar layout="bar" {...statusBarProps} />
          </DetailHeaderSlot>
        ) : (
          <EntryStatusBar layout="card" {...statusBarProps} />
        )}

        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Content</h3>
            <p className="opacity-70">
              The fields for this {lowerType}. Edits are saved when you click Save changes.
            </p>
            <ContentEntryForm
              schema={schema}
              body={body}
              onBodyChange={(next) => {
                setBody(next);
                onBody?.(next);
              }}
            />
          </CardBody>
        </Card>

        {multiSite && (
          <Card>
            <CardBody>
              <h3 className="text-xl font-semibold">Sites</h3>
              <p className="opacity-70">Which of your sites show this {lowerType}.</p>
              <SiteScopeField sites={sites} value={propertyIds} onChange={setPropertyIds} />
            </CardBody>
          </Card>
        )}

        {routable && (
          <SeoPanel
            value={seo}
            onChange={setSeo}
            previewOrigin={previewOrigin}
            slug={slug}
            fallbackTitle={fallbackTitle}
            entryId={id}
          />
        )}

        {templateOptions && templateOptions.length > 0 && (
          <EntryTemplatePicker
            typeKey={typeKey}
            itemRef={id}
            typeName={typeName}
            options={templateOptions}
            current={currentTemplateId ?? null}
          />
        )}

        <Card>
          <CardBody>
            <div className="flex flex-col gap-2">
              {error && (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
              )}
              {message && (
                <FieldStatus status="success" attached={false} aria-live="polite">
                  {message}
                </FieldStatus>
              )}
            </div>
            <CardActions>
              <Button
                type="button"
                variant="ghost"
                iconStart={<Trash2 className="h-4 w-4" />}
                onClick={handleDelete}
                disabled={pending}
              >
                Delete
              </Button>
              <Button type="submit" color="module" disabled={pending} loading={pending}>
                Save changes
              </Button>
            </CardActions>
          </CardBody>
        </Card>
      </div>

      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <div>
            <DialogTitle>Schedule publish</DialogTitle>
            <DialogDescription>
              Pick when this {lowerType} should flip to <strong>published</strong>. Times are
              interpreted in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}
              ) and stored as UTC on the server.
            </DialogDescription>
          </div>
          <div className="px-6 py-4">
            <Field className="gap-3">
              <FieldLabel required>When</FieldLabel>
              <DatePicker value={scheduleAt} onValueChange={(d) => setScheduleAt(d ?? undefined)} />
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
          <div>
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
