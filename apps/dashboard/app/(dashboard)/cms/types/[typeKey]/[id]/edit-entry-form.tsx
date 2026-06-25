'use client';

// Edit container for one content-type entry. The entries analog of the CMS
// Pages editor's `EditPageForm` — same card layout (Status / Content / SEO /
// footer) and the same per-keystroke autosave + ETag conflict machinery, so
// editing a blog post feels identical to editing a page.
//
// Two things differ from the Pages editor:
//   - The body is SCHEMA-DRIVEN. The content type owns its fields, so the
//     Content card hosts a controlled `<ContentEntryForm>` (one
//     FieldRenderer per field) rather than a fixed title/slug/rich-text set.
//     `slug`, `title`, etc. are body keys the schema declares.
//   - Autosave is PRE-VALIDATED on the client. A schema-invalid body (e.g.
//     the editor cleared the slug on a routable type) would 422 the whole
//     PATCH, so we skip the round-trip and show a soft "needs attention"
//     indicator instead of a scary error/conflict banner.
//
// Body + SEO (+ slug) ride in ONE PATCH against ONE ETag cursor — see
// `autosaveEntry`. SEO reuses the Pages editor's `SeoPanel` verbatim.

import * as React from 'react';
import { createPortal } from 'react-dom';
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
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Stack,
  Text,
  toast,
  useConfirm,
} from '@sparx/ui';
import { Trash2 } from 'lucide-react';
import { validateBody, type FieldDef } from '@sparx/cms-schemas';
import type { BuilderTemplateOption } from '@sparx/builder-schemas';
import type { Property } from '@/lib/sites';
import { ContentEntryForm, missingRequiredFields } from '../../../_components/content-entry-form';
import { SiteScopeField } from '../../../../_components/site-scope-field';
import { SeoPanel, type SeoFields } from '../../../[id]/seo-panel';
import { EntryStatusBar, type SaveState } from './entry-status-bar';
import { DetailHeaderSlot } from '../../../../_components/detail-header-slot';
import { EntryTemplatePicker } from './entry-template-picker';
import {
  autosaveEntry,
  deleteEntry,
  saveEntry,
  scheduleEntryPublish,
  setEntryStatus,
} from '../../actions';

const ZONE_DOMAIN = process.env.NEXT_PUBLIC_SPARX_ZONE_DOMAIN ?? 'sparx.zone';
const AUTOSAVE_DEBOUNCE_MS = 600;
// Autosave is OFF for now (see EditPageForm): the platform standard is explicit save,
// and running it alongside a Save button is contradictory. The machinery stays behind
// this env flag (unset ⇒ off) so re-enabling autosave-everywhere later is a flip.
const AUTOSAVE_ENABLED = process.env.NEXT_PUBLIC_CMS_AUTOSAVE === 'true';

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
  initialEtag: string | null;
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
   *  preview can re-render as you type (docs/51 §6). This component still OWNS +
   *  autosaves the body; the workspace only observes it. Omitted ⇒ no preview. */
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
  initialEtag,
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

  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const [body, setBody] = React.useState<Record<string, unknown>>(initialBody);
  const [seo, setSeo] = React.useState<SeoFields>(initialSeo);
  const [status, setStatus] = React.useState(initialStatus);
  const [propertyIds, setPropertyIds] = React.useState<string[]>(initialPropertyIds);

  // Autosave bookkeeping (mirrors EditPageForm).
  const [saveState, setSaveState] = React.useState<SaveState>({ kind: 'idle' });
  const etagRef = React.useRef<string | null>(initialEtag);
  const inFlightRef = React.useRef(false);
  const dirtyRef = React.useRef(false);
  const hydratedRef = React.useRef(false);
  // The conflict guard reads save state through a ref so `runAutosave` stays a
  // STABLE callback. If it depended on `saveState.kind`, its identity would
  // churn on every save transition, re-arming the debounce effect below and
  // re-saving an untouched entry in a loop.
  const saveStateRef = React.useRef(saveState);
  React.useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleAt, setScheduleAt] = React.useState<Date | undefined>(scheduledAt ?? undefined);

  // Stable refs so the debounce closure reads current values without
  // re-arming the timer on every keystroke.
  const bodyRef = React.useRef(body);
  const seoRef = React.useRef(seo);
  const propertyIdsRef = React.useRef(propertyIds);
  React.useEffect(() => {
    bodyRef.current = body;
  }, [body]);
  React.useEffect(() => {
    seoRef.current = seo;
  }, [seo]);
  React.useEffect(() => {
    propertyIdsRef.current = propertyIds;
  }, [propertyIds]);

  const slugFromBody = (): string | undefined => {
    const s = bodyRef.current.slug;
    return routable && typeof s === 'string' && s.length > 0 ? s : undefined;
  };

  // The effective routing slug: an editable `slug` field in the body wins (the
  // user can retype it); otherwise the persisted column (auto-derived types).
  const slug = str(body.slug) || initialSlug;
  const fallbackTitle = str(body.title);

  const runAutosave = React.useCallback(async () => {
    if (inFlightRef.current) return;
    if (saveStateRef.current.kind === 'conflict') return;
    // Pre-validate: a schema-invalid body (cleared slug, missing required key)
    // would 422 the PATCH. Skip the round-trip and show a soft indicator so the
    // editor isn't startled by an error/conflict banner mid-typing.
    const check = validateBody({ fields: schema.fields }, bodyRef.current);
    if (!check.ok) {
      setSaveState({ kind: 'invalid', count: Object.keys(check.errors ?? {}).length });
      return;
    }
    inFlightRef.current = true;
    dirtyRef.current = false;
    setSaveState({ kind: 'saving' });
    const result = await autosaveEntry(
      id,
      {
        body: bodyRef.current,
        seo: seoRef.current,
        slug: slugFromBody(),
        propertyIds: multiSite ? propertyIdsRef.current : undefined,
      },
      etagRef.current
    );
    inFlightRef.current = false;
    if (!result.ok) {
      if (result.error === 'CONFLICT') {
        setSaveState({ kind: 'conflict' });
      } else {
        setSaveState({ kind: 'error', message: result.error ?? 'Autosave failed.' });
      }
      return;
    }
    etagRef.current = result.data?.etag ?? etagRef.current;
    setSaveState({ kind: 'saved', at: new Date() });
    // Catch-up: the editor typed during the save.
    if (dirtyRef.current) {
      void runAutosave();
    }
    // `schema`/`routable`/`id`/`multiSite` are stable for the editor's lifetime;
    // conflict state is read via `saveStateRef`. Keeping the dep list free of
    // changing values is what makes this callback stable (see saveStateRef above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, routable]);

  // Debounce: mark dirty + schedule a save 600ms after the last edit. Skip the
  // first render so prop hydration doesn't trigger a needless save. Site scope
  // (propertyIds) rides the same PATCH, so a scope change autosaves like any edit.
  React.useEffect(() => {
    if (!AUTOSAVE_ENABLED) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    dirtyRef.current = true;
    const handle = setTimeout(() => {
      void runAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      clearTimeout(handle);
    };
  }, [body, seo, propertyIds, runAutosave]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const missing = missingRequiredFields({ fields: schema.fields }, bodyRef.current);
    if (missing.length) {
      setError(`Required: ${missing.join(', ')}.`);
      return;
    }
    startTransition(async () => {
      const result = await saveEntry(
        id,
        typeKey,
        {
          body: bodyRef.current,
          seo: seoRef.current,
          slug: slugFromBody(),
          propertyIds: multiSite ? propertyIdsRef.current : undefined,
        },
        etagRef.current
      );
      if (!result.ok) {
        if (result.error === 'CONFLICT') {
          setSaveState({ kind: 'conflict' });
          return;
        }
        setError(result.error ?? 'Could not save changes.');
        return;
      }
      etagRef.current = result.data?.etag ?? etagRef.current;
      setSaveState({ kind: 'saved', at: new Date() });
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

  const lowerType = typeName.toLowerCase();

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
    saveState,
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
    onDiscardConflict: () => {
      setSaveState({ kind: 'idle' });
      router.refresh();
    },
    onKeepConflict: () => {
      // Force save: drop the stale If-Match so the next PATCH wins over whatever the
      // other tab wrote. Local edits stay.
      etagRef.current = null;
      setSaveState({ kind: 'idle' });
      dirtyRef.current = true;
      void runAutosave();
    },
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <Stack gap={6}>
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

        <Card variant="module">
          <CardHeader>
            <Heading level={3}>Content</Heading>
            <CardDescription>
              {AUTOSAVE_ENABLED
                ? `The ${lowerType}'s fields. Autosaves every keystroke after a brief pause.`
                : `The ${lowerType}'s fields. Edits are saved when you click Save changes.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContentEntryForm
              schema={schema}
              body={body}
              onBodyChange={(next) => {
                setBody(next);
                onBody?.(next);
              }}
            />
          </CardContent>
        </Card>

        {multiSite && (
          <Card variant="module">
            <CardHeader>
              <Heading level={3}>Sites</Heading>
              <CardDescription>Which of your sites show this {lowerType}.</CardDescription>
            </CardHeader>
            <CardContent>
              <SiteScopeField sites={sites} value={propertyIds} onChange={setPropertyIds} />
            </CardContent>
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

        <Card variant="module">
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
              Pick when this {lowerType} should flip to <strong>published</strong>. Times are
              interpreted in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}
              ) and stored as UTC on the server.
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
