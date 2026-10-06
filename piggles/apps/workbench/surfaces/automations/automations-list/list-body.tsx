'use client';

import { Button, Card } from '@wizeworks/silicaui-react';
import { faDiagramProject, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneWaiting } from '../../../components/pane-waiting';
import { ListEmptyState } from '../../../components/list-empty-state';
import { PaneLoadError } from '../../../components/pane-load-error';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { targetFor } from '../target-for';
import { AutomationsTable } from './automations-table';
import type { AutomationsList } from './use-automations-list';

/** Registry module for this surface, so the brand's empty-state artwork is this
 *  app's own picture rather than the generic one. */
const MODULE = 'automations';

function ListEmpty({ ctx, filtering }: { ctx: SurfaceContext; filtering: boolean }) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={filtering}
      noResults={{
        icon: <Icon glyph={faDiagramProject} className="size-6" aria-hidden />,
        title: 'No automations match those filters',
        description: 'Try a different search, or switch the filters back to Any.',
      }}
      firstRun={{
        title: 'No automations yet',
        description:
          'Automations run jobs for you: email a customer when they order, chase an overdue invoice, tag a big spender. Create your first to get started.',
        actions: (
          <Button
            size="sm"
            color="module"
            onClick={(event) => {
              ctx.open('automations.detail', { id: 'new' }, { target: targetFor(event) });
            }}
          >
            <Icon glyph={faPlus} className="size-4" aria-hidden />
            New automation
          </Button>
        ),
      }}
    />
  );
}

export function ListBody({ ctx, list }: { ctx: SurfaceContext; list: AutomationsList }) {
  const { isError, isPending, rows, filtering, refetch } = list;
  return (
    <Card className="min-h-0 flex-1 overflow-y-auto">
      {isError ? (
        <PaneLoadError
          icon={<Icon glyph={faDiagramProject} className="size-6" aria-hidden />}
          title="Could not load your automations"
          description="Something went wrong reaching the server. Your rules are unaffected and still running. Try again in a moment."
          onRetry={() => {
            void refetch();
          }}
        />
      ) : isPending ? (
        <PaneWaiting label="Loading automations…" />
      ) : rows.length === 0 ? (
        <ListEmpty ctx={ctx} filtering={filtering} />
      ) : (
        <AutomationsTable ctx={ctx} list={list} />
      )}
    </Card>
  );
}
