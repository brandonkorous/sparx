import { Plus, Send } from 'lucide-react';
import { EmptyState } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { ListToolbar } from '../../_components/list-toolbar';
import { getUserPreferences } from '../../_shell/preferences';
import { EmailShell } from '../_components/email-shell';
import type { BroadcastRow } from '../_lib/types';
import { BroadcastsList } from './_components/broadcasts-list';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BroadcastsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [prefs, broadcasts] = await Promise.all([
    getUserPreferences(),
    api.get<BroadcastRow[]>('/v1/email/broadcasts'),
  ]);

  const view = (stringParam(params.view) ?? prefs.defaultListView) === 'card' ? 'card' : 'table';

  return (
    <EmailShell
      width="full"
      icon={<Send className="h-5 w-5" />}
      title="Broadcasts"
      description="Segment-targeted marketing campaigns."
      actions={
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
    >
      <ListToolbar searchable={false} enableViewToggle />

      {broadcasts.length === 0 ? (
        <EmptyState
          icon={<Send className="h-5 w-5" />}
          title="No broadcasts yet"
          description="Compose a campaign, target a CRM segment, and send or schedule it."
        />
      ) : (
        <BroadcastsList rows={broadcasts} view={view} />
      )}
    </EmailShell>
  );
}

function stringParam(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}
