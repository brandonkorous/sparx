// Redirects — a standard Collection/List surface (docs/34 §7). The ListToolbar's
// Table/Cards toggle (honoring the user's defaultListView) flips the existing
// redirects between views. Creating a redirect (surface-aware form) and CSV bulk
// import live in the header actions; the client RedirectsList renders the rows
// and the per-row delete. No search / filters — the endpoint exposes none.

import { Plus } from 'lucide-react';

import { PageHeader } from '@sparx/ui';
import { Badge } from '@wizeworks/silicaui-react';
import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { getUserPreferences } from '../../_shell/preferences';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { RedirectsList } from './redirects-list';
import { ImportRedirectsButton } from './_components/import-redirects-button';

export const dynamic = 'force-dynamic';

interface ApiRedirect {
  id: string;
  from_path: string;
  to_path: string;
  status_code: number;
  hit_count: number;
  created_at: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RedirectsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, { data: redirects, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<ApiRedirect[]>(
      `/v1/redirects?${new URLSearchParams({ take: String(take), skip: String(skip) }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? redirects.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <div className="mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 py-10">
        <PageHeader
          title="Redirects"
          badge={
            <Badge color="neutral" variant="soft" size="sm">
              {total}
            </Badge>
          }
          description="Forward old URLs to new ones. Loops and chains over 8 hops are rejected at insert."
          actions={
            <div className="flex flex-row gap-2">
              <ImportRedirectsButton />
              <EntityCreateButton
                entityType="redirect"
                newHref="/cms/redirects/new"
                color="module"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            </div>
          }
        />
        <ListToolbar searchable={false} enableViewToggle />
        <RedirectsList rows={redirects} view={view} />
        <ListPager total={total} />
      </div>
    </div>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
