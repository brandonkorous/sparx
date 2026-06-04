import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Heading, Stack, Text } from '@sparx/ui';
import { ExternalLink } from 'lucide-react';
import type { FieldDef } from '@sparx/cms-schemas';
import { cmsContentTypeTargetId } from '@sparx/sitebuilder-schemas';

import { api, type ApiRestError } from '@/lib/api-rest-client';
import { EditEntryForm } from './edit-entry-form';
import { type SeoFields } from '../../../[id]/seo-panel';
// Site-Builder-owned layout assignment (docs/36 §6). The content type's stable
// `key` is the target identifier; the entry id is the item. Self-hides when
// Site Builder is inactive. Server component — rendered here, not inside the
// client EditEntryForm.
import { LayoutAssignmentSection } from '../../../../sitebuilder/_components/layout-assignment-section';

// Detail content for one content-type entry. Used by both:
//   - cms/types/[typeKey]/[id]/page.tsx (the full route)
//   - the dashboard shell's `@detail` slot (drawer / modal)
//
// Chrome-free, exactly like cms/[id]/_content.tsx — the route page adds the
// width-constrained Container; the drawer/modal mounts it as-is. Because the
// detail token (`content-entry:<id>`) can't carry the type key, the drawer's
// "maximize to full page" affordance is suppressed (see fullPageHrefFor); we
// render our own "Open full editor" link here instead, which knows the key.

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
}

interface ContentEntryDetailContentProps {
  id: string;
  /** The drawer/modal renders the "Open full editor" link; the full route
   *  passes false (it would link to itself). */
  showOpenInFull?: boolean;
}

export async function ContentEntryDetailContent({
  id,
  showOpenInFull = true,
}: ContentEntryDetailContentProps) {
  const [entryResult, tenant] = await Promise.all([
    (async () => {
      try {
        return await api.getWithEtag<ApiEntry>(`/v1/content/entries/${id}`);
      } catch (err) {
        const e = err as ApiRestError;
        if (e?.status === 404) notFound();
        throw err;
      }
    })(),
    api.get<{ slug: string }>('/v1/tenant'),
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
        {showOpenInFull && (
          <Button variant="link" size="sm" asChild className="w-fit px-0">
            <Link href={`/cms/types/${type.key}/${id}`}>
              Open full editor
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </Stack>

      <EditEntryForm
        id={entry.id}
        typeKey={type.key}
        typeName={type.name}
        urlPattern={type.url_pattern}
        initialSlug={entry.slug ?? ''}
        schema={type.schema_json}
        initialBody={entry.body}
        initialSeo={initialSeo}
        initialStatus={entry.status}
        publishedAt={entry.published_at ? new Date(entry.published_at) : null}
        scheduledAt={entry.scheduled_at ? new Date(entry.scheduled_at) : null}
        initialEtag={initialEtag}
        tenantSlug={tenant?.slug ?? null}
      />

      {/* SEO + layout only matter for types that render on the site (have a URL
          pattern). Per-entry layout so every record can target its own. */}
      {type.url_pattern ? (
        <LayoutAssignmentSection
          targetId={cmsContentTypeTargetId(type.key)}
          itemRef={entry.id}
          note="Saved now; takes effect on your site once content pages render through layouts."
        />
      ) : null}
    </Stack>
  );
}
