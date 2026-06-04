import { Container, PageHeader, Stack } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { ContentTypeCreateForm } from '../_components/content-type-create-form';

export const dynamic = 'force-dynamic';

// Full-page surface for creating a custom content type. The form body lives in
// the surface-aware `ContentTypeCreateForm` (§13.1) so the SAME component
// renders here (`surface="page"`) and inside the `@detail` drawer/modal
// (`surface="overlay"`). fullPage / newTab detail-view prefs, deep links, and
// the overlay's "maximize" button all resolve here.
//
// `?from=<key>` duplicates an existing type: the form is pre-filled from that
// type's schema + identity (with a unique-key suggestion), so a user can fork a
// built-in or custom type into a new editable one — docs/51 §7. The source is
// untouched.

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
  let title = 'New custom content type';
  let description =
    'Define a tenant-specific authoring shape — testimonials, case studies, events, anything. The schema validates against the same FieldDef union the platform uses for built-ins, so the schema-driven form on this dashboard works out of the box.';

  if (from) {
    try {
      const src = await api.get<ApiContentType>(
        `/v1/content/types/${encodeURIComponent(from)}`
      );
      initial = {
        key: `${src.key}_copy`,
        name: `${src.name} copy`,
        pluralName: `${src.plural_name} copy`,
        description: src.description ?? '',
        urlPattern: src.url_pattern ?? '',
        isSingleton: src.is_singleton,
        schema: JSON.stringify(src.schema_json ?? { fields: [] }, null, 2),
      };
      title = `Duplicate ${src.name}`;
      description = `Creates a new custom content type pre-filled from ${src.name}'s schema. Give it a unique key, then tailor the fields — the original is left untouched.`;
    } catch {
      // Source type gone or unreadable — fall back to a blank create form.
    }
  }

  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader title={title} description={description} />
        <ContentTypeCreateForm surface="page" initial={initial} />
      </Stack>
    </Container>
  );
}
