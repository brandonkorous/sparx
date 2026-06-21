import { api } from '@/lib/api-rest-client';
import { ContentTypeCreateForm } from '../_components/content-type-create-form';

// Full-page surface for creating a custom content type. The surface-aware
// `ContentTypeCreateForm` (docs/86 F layout) renders the SAME WizardFrame here
// (`surface="page"` → the `embedded` contained sheet, filling the dashboard
// content area with its own title + pinned toolbar) and inside the `@detail`
// drawer/modal overlay (`surface="overlay"`). This route is what `fullPage` /
// `newTab` detail-view preferences, deep links, and the overlay's "maximize"
// button resolve to — no page-level Container/PageHeader, so the title isn't
// rendered twice.
//
// `?from=<key>` duplicates an existing type: the form is pre-filled from that
// type's schema + identity (with a unique-key suggestion), so a user can fork a
// built-in or custom type into a new editable one — docs/51 §7. The source is
// untouched.

export const dynamic = 'force-dynamic';

interface ApiContentType {
  key: string;
  name: string;
  plural_name: string;
  description: string | null;
  url_pattern: string | null;
  is_singleton: boolean;
  schema_json: unknown;
}

interface PageProps {
  searchParams: Promise<{ from?: string | string[] }>;
}

function asString(v: string | string[] | undefined): string | undefined {
  if (typeof v === 'string' && v.length > 0) return v;
  if (Array.isArray(v)) return v[0];
  return undefined;
}

export default async function NewContentTypePage({ searchParams }: PageProps) {
  const from = asString((await searchParams).from);

  let initial: React.ComponentProps<typeof ContentTypeCreateForm>['initial'];

  if (from) {
    try {
      const src = await api.get<ApiContentType>(`/v1/content/types/${encodeURIComponent(from)}`);
      initial = {
        key: `${src.key}_copy`,
        name: `${src.name} copy`,
        pluralName: `${src.plural_name} copy`,
        description: src.description ?? '',
        urlPattern: src.url_pattern ?? '',
        isSingleton: src.is_singleton,
        schema: JSON.stringify(src.schema_json ?? { fields: [] }, null, 2),
      };
    } catch {
      // Source type gone or unreadable — fall back to a blank create form.
    }
  }

  return <ContentTypeCreateForm surface="page" initial={initial} />;
}
