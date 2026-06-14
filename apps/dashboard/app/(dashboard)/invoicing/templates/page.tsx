import { LayoutTemplate } from 'lucide-react';

import { Container, PageHeader, Stack, Text } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { TemplatesList, type TemplateRow } from './_components/templates-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InvoicingTemplatesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  // listOrSeed lazily materializes the built-in default on first visit.
  const [prefs, templates] = await Promise.all([
    getUserPreferences(),
    api.get<TemplateRow[]>('/v1/invoicing/templates'),
  ]);

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <Container size="lg">
      <Stack gap={6} className="py-10">
        <PageHeader
          icon={<LayoutTemplate className="h-5 w-5" />}
          title="Print templates"
          description="Design how invoices and estimates print. Every document renders with the built-in default until you publish a template; the default template, once published, drives every document's print + PDF."
        />

        <ListToolbar enableViewToggle searchable={false} />

        <TemplatesList rows={templates} view={view} />

        <Text size="xs" variant="muted">
          Templates reuse the builder framework (the same node-tree machinery as the page + email
          builders). The visual template editor is coming; today the default ships ready to publish,
          and you can preview any template against sample data.
        </Text>
      </Stack>
    </Container>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
