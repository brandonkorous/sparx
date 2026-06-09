import { Plus, Send } from 'lucide-react';
import { EmptyState } from '@sparx/ui';

import { api } from '@/lib/api-rest-client';
import { EntityCreateButton } from '../../_components/entity-create-button';
import { EmailShell } from '../_components/email-shell';
import type { BroadcastRow } from '../_lib/types';
import { BroadcastsSelectionGrid } from './_components/broadcasts-selection-grid';

export const dynamic = 'force-dynamic';

export default async function BroadcastsPage() {
  const broadcasts = await api.get<BroadcastRow[]>('/v1/email/broadcasts');

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
      {broadcasts.length === 0 ? (
        <EmptyState
          icon={<Send className="h-5 w-5" />}
          title="No broadcasts yet"
          description="Compose a campaign, target a CRM segment, and send or schedule it."
        />
      ) : (
        <BroadcastsSelectionGrid broadcasts={broadcasts} />
      )}
    </EmailShell>
  );
}
