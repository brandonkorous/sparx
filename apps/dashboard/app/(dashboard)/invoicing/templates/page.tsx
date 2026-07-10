import { LayoutTemplate } from 'lucide-react';

import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';

import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { TemplatesList, type TemplateRow } from './_components/templates-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InvoicingTemplatesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  // listOrSeed lazily materializes the built-in default on first visit.
  const [prefs, { data: templates, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<TemplateRow[]>(
      `/v1/invoicing/templates?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? templates.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      className="mx-auto w-full max-w-screen-lg"
      header={
        <PageHeader
          icon={<LayoutTemplate className="h-5 w-5" />}
          title="Print templates"
          description="Design how invoices and estimates print. Every document renders with the built-in default until you publish a template; the default template, once published, drives every document's print + PDF."
          className="mb-0"
        />
      }
      toolbar={<ListToolbar enableViewToggle searchPlaceholder="Search template name…" />}
      pager={<ListPager total={total} />}
    >
      <div className="flex flex-col gap-6">
        <TemplatesList rows={templates} view={view} />

        <p className="text-base-content/70 text-xs">
          Templates reuse the builder framework (the same node-tree machinery as the page + email
          builders). The visual template editor is coming; today the default ships ready to publish,
          and you can preview any template against sample data.
        </p>
      </div>
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
