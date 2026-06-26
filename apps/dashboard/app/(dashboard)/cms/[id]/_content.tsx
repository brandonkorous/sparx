import { notFound } from 'next/navigation';
import { api, type ApiRestError } from '@/lib/api-rest-client';
import { listProperties, type Property } from '@/lib/sites';
import { EditPageForm, type EditableTenantPage } from './edit-form';

// Detail content for a CMS page. Used by both:
//   - apps/dashboard/.../cms/[id]/page.tsx (the full route)
//   - apps/dashboard/.../_components/detail-panel.tsx (drawer / modal)
//
// Full-page chrome (back button, CmsTabs, Container width constraint) is
// NOT included here — it's the route page's responsibility to add. Keeping
// this component chrome-free lets the panel mount it identically.

export const dynamic = 'force-dynamic';

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

interface CmsPageDetailContentProps {
  id: string;
}

export async function CmsPageDetailContent({ id }: CmsPageDetailContentProps) {
  const [entryResult, tenant, sites] = await Promise.all([
    (async () => {
      try {
        return await api.get<ApiEntry>(`/v1/content/entries/${id}`);
      } catch (err) {
        const e = err as ApiRestError;
        if (e?.status === 404) notFound();
        throw err;
      }
    })(),
    api.get<{ slug: string }>('/v1/tenant'),
    listProperties().catch(() => [] as Property[]),
  ]);
  const entry = entryResult;

  const docBody =
    entry.body.body && typeof entry.body.body === 'object'
      ? (entry.body.body as Record<string, unknown>)
      : { type: 'doc', content: [] };

  const seoVal = entry.seo ?? {};
  const editable: EditableTenantPage = {
    id: entry.id,
    typeKey: entry.type_key,
    slug: entry.slug ?? '',
    title: typeof entry.body.title === 'string' ? entry.body.title : '',
    status: entry.status,
    body: docBody,
    seo: {
      title: typeof seoVal.title === 'string' ? seoVal.title : '',
      description: typeof seoVal.description === 'string' ? seoVal.description : '',
      canonical: typeof seoVal.canonical === 'string' ? seoVal.canonical : '',
      robots: typeof seoVal.robots === 'string' ? seoVal.robots : '',
      ogImage: typeof seoVal.ogImage === 'string' ? seoVal.ogImage : '',
    },
    publishedAt: entry.published_at ? new Date(entry.published_at) : null,
    scheduledAt: entry.scheduled_at ? new Date(entry.scheduled_at) : null,
    updatedAt: new Date(entry.updated_at),
  };

  // Identity (title + slug) lives only in the editable fields of EditPageForm;
  // the form teleports its own status + lifecycle controls into the frame header.
  return (
    <EditPageForm
      page={editable}
      tenantSlug={tenant?.slug ?? null}
      sites={sites}
      initialPropertyIds={entry.propertyIds ?? []}
    />
  );
}
