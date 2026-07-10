import { Plus, Send } from 'lucide-react';
import { EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import type { BroadcastRow } from '../_lib/types';
import { BroadcastsList } from './_components/broadcasts-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BroadcastsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);

  const [prefs, { data: broadcasts, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<BroadcastRow[]>(
      `/v1/email/broadcasts?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? broadcasts.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<Send className="h-5 w-5" />}
          title="Broadcasts"
          description="Segment-targeted marketing campaigns."
          className="mb-0"
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search name or subject…"
          enableViewToggle
          primaryAction={
            <EntityCreateButton
              entityType="broadcast"
              newHref="/email/broadcasts/new"
              color="module"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
        />
      }
      pager={<ListPager total={total} />}
    >
      {broadcasts.length === 0 ? (
        <EmptyState
          icon={<Send className="h-5 w-5" />}
          title={q ? 'No broadcasts match this search' : 'No broadcasts yet'}
          description={
            q
              ? 'Clear the search to see every broadcast.'
              : 'Compose a campaign, target a CRM segment, and send or schedule it.'
          }
        />
      ) : (
        <BroadcastsList rows={broadcasts} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
