import { Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { EmailShell } from '../_components/email-shell';
import { AddDomainForm } from './_components/add-domain-form';
import { DomainsList } from './_components/domains-list';
import type { SendingDomainRow } from '../_lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DomainsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { skip, take } = parsePageParams(params);

  const [prefs, { data: domains, meta }] = await Promise.all([
    getUserPreferences(),
    api.getPaged<SendingDomainRow[]>(
      `/v1/email/domains?${new URLSearchParams({
        take: String(take),
        skip: String(skip),
      }).toString()}`
    ),
  ]);
  const total = (meta?.total as number | undefined) ?? domains.length;

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <EmailShell
      width="full"
      icon={<Globe className="h-5 w-5" />}
      title="Sending domains"
      description="Send from your own domain with automatic DKIM, SPF, and DMARC. Until a domain is verified, email sends from the shared Sparx domain."
    >
      <Card>
        <CardHeader>
          <CardTitle>Add a sending domain</CardTitle>
          <CardDescription>
            Enter the domain (or subdomain) you want to send from. Sparx provisions it in Mailgun
            and shows the exact DNS records to publish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddDomainForm />
        </CardContent>
      </Card>

      {domains.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-5 w-5" />}
          title="No sending domains yet"
          description="Add your first domain above to start sending from your own brand."
        />
      ) : (
        <>
          <ListToolbar searchable={false} enableViewToggle />
          <DomainsList rows={domains} view={view} />
          <ListPager total={total} />
        </>
      )}
    </EmailShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
