import { Globe, Plus } from 'lucide-react';
import { EmptyState } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { parsePageParams } from '@/lib/pagination';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { ListPager } from '../../_components/list-pager';
import { getUserPreferences } from '../../_shell/preferences';
import { EmailShell } from '../_components/email-shell';
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
      actions={
        <EntityCreateButton
          entityType="sending-domain"
          newHref="/email/domains/new"
          color="module"
          leftIcon={<Plus className="h-4 w-4" />}
        >
          New
        </EntityCreateButton>
      }
    >
      {domains.length === 0 ? (
        <EmptyState
          icon={<Globe className="h-5 w-5" />}
          title="No sending domains yet"
          description="Add your first domain with the New button to start sending from your own brand."
          action={
            <EntityCreateButton
              entityType="sending-domain"
              newHref="/email/domains/new"
              variant="outline"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New
            </EntityCreateButton>
          }
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
