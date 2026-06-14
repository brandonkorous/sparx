import { ShieldOff } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Text,
} from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EmailShell } from '../_components/email-shell';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { AddSuppressionForm } from './_components/add-suppression-form';
import { SuppressionsList } from './_components/suppressions-list';
import type { SuppressionRow } from '../_lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SuppressionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);
  const [prefs, { data: items, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<SuppressionRow[]>(
      `/v1/email/suppressions?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
  ]);
  const total = typeof meta?.total === 'number' ? meta.total : items.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <EmailShell
      width="full"
      icon={<ShieldOff className="h-5 w-5" />}
      title="Suppressions"
      description="Addresses that are never emailed. Bounces, complaints, and unsubscribes are added automatically; you can also suppress addresses manually."
    >
      <Card>
        <CardHeader>
          <CardTitle>Suppress an address</CardTitle>
          <CardDescription>
            Add one or many addresses to the do-not-send list. Choose whether to block all email or
            just marketing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddSuppressionForm />
        </CardContent>
      </Card>

      <Text size="sm" variant="muted">
        {total} suppressed address{total === 1 ? '' : 'es'}
      </Text>

      <ListToolbar enableViewToggle searchable={false} />

      {items.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<ShieldOff className="h-5 w-5" />}
            title="No suppressed addresses"
            description="Bounces, complaints, and unsubscribes will appear here automatically, and you can add addresses manually above."
          />
        </Card>
      ) : (
        <SuppressionsList rows={items} view={view} />
      )}

      <ListPager total={total} />
    </EmailShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
