import { notFound } from 'next/navigation';
import { Badge, Heading, Stack, Text } from '@sparx/ui';
import type { FieldDef } from '@sparx/cms-schemas';
import type { BuilderTemplateOption } from '@sparx/builder-schemas';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';
import { loadRecordPreviewBundle } from '../../../../builder/_lib/record-preview';
import { type EditEntryFormProps } from './edit-entry-form';
import { EntryEditorWorkspace, type EntryPreview } from './entry-editor-workspace';
import { type SeoFields } from '../../../[id]/seo-panel';

// Detail content for one content-type entry. Used by both:
//   - cms/types/[typeKey]/[id]/page.tsx (the full route)
//   - the dashboard shell's `@detail` slot (drawer / modal)
//
// Chrome-free, exactly like cms/[id]/_content.tsx — the route page adds the
// width-constrained Container; the drawer/modal mounts it as-is. The detail
// token encodes `content-entry:<typeKey>:<id>` so the drawer chrome's standard
// "maximize to full page" button can rebuild /cms/types/<typeKey>/<id> (see
// fullPageHrefFor) — no bespoke in-body link, same as every other entity.

export const dynamic = 'force-dynamic';

interface ApiContentType {
  key: string;
  name: string;
  plural_name: string;
  url_pattern: string | null;
  schema_json: { fields: FieldDef[] };
}

interface ApiEntry {
  id: string;
  type_key: string;
  slug: string | null;
  status: string;
  body: Record<string, unknown>;
  seo: Record<string, unknown>;
  published_at: string | null;
  scheduled_at: string | null;
  updated_at: string;
  // Model B per-site scoping (docs/49 §3). Empty = visible on all sites.
  propertyIds?: string[];
}

interface ContentEntryDetailContentProps {
  id: string;
  /** Mount the embedded live preview (docs/51 §6). Only the full-page route opts
   *  in; the dashboard shell's detail drawer stays form-only (too narrow to split). */
  previewEnabled?: boolean;
}

export async function ContentEntryDetailContent({
  id,
  previewEnabled = false,
}: ContentEntryDetailContentProps) {
  // The drawer token encodes `<typeKey>:<id>`; the full route passes a bare id.
  // Entry ids are UUIDs (no colons), so the segment after the last colon is the
  // id regardless of which caller invoked us.
  const entryId = id.includes(':') ? id.slice(id.lastIndexOf(':') + 1) : id;
  const [entryResult, tenant, sites] = await Promise.all([
    (async () => {
      try {
        return await api.getWithEtag<ApiEntry>(`/v1/content/entries/${entryId}`);
      } catch (err) {
        const e = err as ApiRestError;
        if (e?.status === 404) notFound();
        throw err;
      }
    })(),
    api.get<{ slug: string }>('/v1/tenant'),
    listProperties().catch(() => [] as Property[]),
  ]);
  const entry = entryResult.data;
  const initialEtag = entryResult.etag;

  let type: ApiContentType;
  try {
    type = await api.get<ApiContentType>(`/v1/content/types/${encodeURIComponent(entry.type_key)}`);
  } catch {
    notFound();
  }

  const seoVal = entry.seo ?? {};
  const initialSeo: SeoFields = {
    title: typeof seoVal.title === 'string' ? seoVal.title : '',
    description: typeof seoVal.description === 'string' ? seoVal.description : '',
    canonical: typeof seoVal.canonical === 'string' ? seoVal.canonical : '',
    robots: typeof seoVal.robots === 'string' ? seoVal.robots : '',
    ogImage: typeof seoVal.ogImage === 'string' ? seoVal.ogImage : '',
  };

  const title = typeof entry.body.title === 'string' ? entry.body.title : '';
  const lowerType = type.name.toLowerCase();

  // Per-record builder template override (docs/51 §6). Only relevant when the
  // Builder module is on AND the type has collection template(s) — a 404 (module
  // off) or empty list leaves both null, so the editor hides the picker.
  let templateOptions: BuilderTemplateOption[] | null = null;
  let currentTemplateId: string | null = null;
  try {
    const recordType = `cms.${entry.type_key}`;
    const { options } = await api.get<{ options: BuilderTemplateOption[] }>(
      `/v1/builder/template-options?recordType=${encodeURIComponent(recordType)}`
    );
    if (options.length > 0) {
      templateOptions = options;
      const { assignment } = await api.get<{ assignment: { builderPageId: string } | null }>(
        `/v1/builder/assignment?recordType=${encodeURIComponent(recordType)}&itemRef=${encodeURIComponent(entry.id)}`
      );
      currentTemplateId = assignment?.builderPageId ?? null;
    }
  } catch {
    templateOptions = null;
  }

  // Live preview (docs/51 §6): render THIS entry through its collection template on
  // the builder canvas. Only when the full-page route opts in AND the type has a
  // template (else the editor stays form-only). The effective template is the
  // entry's per-record override, else the type default, else the first option. The
  // bundle is fail-soft — a null degrades to the plain form.
  let preview: EntryPreview | null = null;
  if (previewEnabled && templateOptions && templateOptions.length > 0) {
    const effectiveTemplateId =
      currentTemplateId ??
      templateOptions.find((o) => o.isDefault)?.id ??
      templateOptions[0]?.id ??
      null;
    if (effectiveTemplateId) {
      const bundle = await loadRecordPreviewBundle({
        sourceKey: type.key,
        templateId: effectiveTemplateId,
      });
      if (bundle) {
        const slugVal = entry.slug ?? '';
        const path = type.url_pattern ? type.url_pattern.replace('{slug}', slugVal) : `/${slugVal}`;
        preview = { ...bundle, typeKey: type.key, path, templateId: effectiveTemplateId };
      }
    }
  }

  const formProps: EditEntryFormProps = {
    id: entry.id,
    typeKey: type.key,
    typeName: type.name,
    urlPattern: type.url_pattern,
    initialSlug: entry.slug ?? '',
    schema: type.schema_json,
    initialBody: entry.body,
    initialSeo,
    initialStatus: entry.status,
    publishedAt: entry.published_at ? new Date(entry.published_at) : null,
    scheduledAt: entry.scheduled_at ? new Date(entry.scheduled_at) : null,
    initialEtag,
    tenantSlug: tenant?.slug ?? null,
    templateOptions,
    currentTemplateId,
    sites,
    initialPropertyIds: entry.propertyIds ?? [],
  };

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        <Stack direction="row" align="center" gap={2}>
          <Heading level={1}>{title || `Untitled ${lowerType}`}</Heading>
          <Badge color="module">{lowerType}</Badge>
          <Badge color={entry.status === 'published' ? 'success' : 'outline'}>{entry.status}</Badge>
        </Stack>
        {entry.slug && (
          <Text size="sm" variant="muted">
            <code>/{entry.slug}</code>
          </Text>
        )}
      </Stack>

      <EntryEditorWorkspace form={formProps} preview={preview} />
    </Stack>
  );
}
