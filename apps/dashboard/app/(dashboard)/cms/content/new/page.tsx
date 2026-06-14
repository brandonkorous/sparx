import { notFound } from 'next/navigation';
import type { FieldDef } from '@sparx/cms-schemas';
import { api } from '@/lib/api-rest-client';
import { ContentEntryWizard } from './content-entry-wizard';
import { loadAuthorOptions } from './author-options';

// Full-page surface for creating a content entry. The WizardFrame `page` variant
// (docs/86) owns the viewport. On the content list the "New" affordance opens
// this same wizard inside the dashboard's drawer/modal detail chrome, picked by
// the user's `defaultDetailView` preference (the `overlay` presentation). This
// route is the full-page option and the one that carries a `?type=` preselection.

export const dynamic = 'force-dynamic';

interface TypeSummary {
  key: string;
  name: string;
  plural_name: string;
  description: string | null;
  is_singleton: boolean;
}

interface TypeSchema {
  key: string;
  name: string;
  url_pattern: string | null;
  schema_json: { fields: FieldDef[] };
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function sp(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function NewContentEntryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const typeKey = sp(params.type);

  let types: TypeSummary[] = [];
  let preselectedType: TypeSchema | undefined;

  try {
    // The endpoint returns a bare array (envelope `data`), not `{ items }`.
    // Request the max page so the full type catalog returns despite the route's
    // offset-pagination default (50).
    types = await api.get<TypeSummary[]>('/v1/content/types?take=250');
  } catch {
    notFound();
  }

  if (typeKey) {
    try {
      preselectedType = await api.get<TypeSchema>(
        `/v1/content/types/${encodeURIComponent(typeKey)}`
      );
    } catch {
      // Type not found — fall through to the type-picker step.
    }
  }

  const authors = await loadAuthorOptions();

  return (
    <ContentEntryWizard
      types={types}
      preselectedType={preselectedType}
      presentation="page"
      authors={authors}
    />
  );
}
