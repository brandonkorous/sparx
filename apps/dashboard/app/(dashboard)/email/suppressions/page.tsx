import { Plus, ShieldOff } from 'lucide-react';
import { Card, CardBody, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { SuppressionsList } from './_components/suppressions-list';
import type { SuppressionRow } from '../_lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SuppressionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);
  const [prefs, { data: items, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<SuppressionRow[]>(
      `/v1/email/suppressions?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
      }).toString()}`
    ),
  ]);
  const total = typeof meta?.total === 'number' ? meta.total : items.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          icon={<ShieldOff className="h-5 w-5" />}
          title="Suppressions"
          description="Addresses that are never emailed. Bounces, complaints, and unsubscribes are added automatically; you can also suppress addresses manually."
          className="mb-0"
        />
      }
      toolbar={
        <>
          <p className="text-base-content text-sm">
            {total} suppressed address{total === 1 ? '' : 'es'}
          </p>
          <ListToolbar
            enableViewToggle
            searchPlaceholder="Search email address…"
            primaryAction={
              <EntityCreateButton
                entityType="suppression"
                newHref="/email/suppressions/new"
                color="module"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
              >
                New
              </EntityCreateButton>
            }
          />
        </>
      }
      pager={<ListPager total={total} />}
    >
      {items.length === 0 ? (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              icon={<ShieldOff className="h-5 w-5" />}
              title={q ? 'No suppressed addresses match this search' : 'No suppressed addresses'}
              description={
                q
                  ? 'Clear the search to see every suppressed address.'
                  : 'Bounces, complaints, and unsubscribes will appear here automatically, and you can add addresses manually with the New button.'
              }
              actions={
                <EntityCreateButton
                  entityType="suppression"
                  newHref="/email/suppressions/new"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  New
                </EntityCreateButton>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <SuppressionsList rows={items} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
