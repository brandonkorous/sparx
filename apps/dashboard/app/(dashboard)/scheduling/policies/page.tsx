export const dynamic = 'force-dynamic';

import { ShieldCheck } from 'lucide-react';
import { Badge, Card, EmptyState } from '@wizeworks/silicaui-react';
import { ListPageShell, PageHeader } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import type { BookingPolicy } from '../_lib/types';
import { NewPolicyButton } from './_components/new-policy-button';
import { PoliciesList } from './_components/policies-list';

// Policies index — a standard docs/34 List surface: a ListToolbar with search
// + a Table/Cards toggle on top of the shared SelectionList. No categorical
// filter dimension exists beyond search for this small, tenant-authored catalog.

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SchedulingPoliciesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const q = stringParam(params.q);

  const [prefs, { data: policies, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<BookingPolicy[]>(
      `/v1/scheduling/policies?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
        ...(q ? { q } : {}),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? policies.length;
  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <ListPageShell
      header={
        <PageHeader
          className="mb-0"
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Policies"
          badge={
            <Badge color="module" variant="soft">
              {total} polic{total !== 1 ? 'ies' : 'y'}
            </Badge>
          }
          description="Deposits, cancellation windows, no-show fees, and reminders — attach a policy to a service to protect against no-shows."
        />
      }
      toolbar={
        <ListToolbar
          searchPlaceholder="Search name or policy text…"
          enableViewToggle
          primaryAction={<NewPolicyButton />}
        />
      }
      pager={<ListPager total={total} />}
    >
      {policies.length === 0 ? (
        <Card>
          <EmptyState
            title={q ? 'No policies match this search' : 'No policies yet'}
            description={
              q
                ? 'Try a different name or policy text.'
                : 'Create a policy to require deposits or card holds and set your cancellation rules.'
            }
            actions={q ? undefined : <NewPolicyButton />}
          />
        </Card>
      ) : (
        <PoliciesList policies={policies} view={view} />
      )}
    </ListPageShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
