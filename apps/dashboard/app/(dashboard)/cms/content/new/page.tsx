import { notFound } from 'next/navigation';
import { Container, PageHeader, Stack } from '@sparx/ui';
import type { FieldDef } from '@sparx/cms-schemas';
import { FileText } from 'lucide-react';
import { api } from '@/lib/api-rest-client';
import { ContentEntryWizard } from './content-entry-wizard';

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
    const res = await api.get<{ items: TypeSummary[] }>('/v1/content/types?take=200');
    types = res.items ?? [];
  } catch {
    notFound();
  }

  if (typeKey) {
    try {
      preselectedType = await api.get<TypeSchema>(
        `/v1/content/types/${encodeURIComponent(typeKey)}`
      );
    } catch {
      // Type not found — fall through to step 1 (type picker)
    }
  }

  const title = preselectedType ? `New ${preselectedType.name.toLowerCase()}` : 'New content entry';
  const description = preselectedType
    ? preselectedType.name
    : 'Choose a content type, fill required fields, and publish.';

  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<FileText className="h-5 w-5" />}
          title={title}
          description={description}
        />
        <ContentEntryWizard types={types} preselectedType={preselectedType} />
      </Stack>
    </Container>
  );
}
