'use client';

// Campaigns — the app landing. Every named path to an outcome this business
// runs, and how each one is doing.

import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, SearchInput } from '@wizeworks/silicaui-react';
import { faArrowProgress, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL, PaneToolbar } from '../../components/pane-toolbar';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import { useViewer } from '../../lib/api/shell-data';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { CampaignRow } from './campaign-row';
import { funnelErrorMessage, useFunnels } from './data';
import { canEditCampaigns } from './presentation';
import type { FunnelStatus } from './types';

const STATUS_FILTERS = [
  { value: 'all', label: 'Every campaign' },
  { value: 'active', label: 'Running' },
  { value: 'draft', label: 'Drafts' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
];

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function CampaignsSurface({ ctx }: { ctx: SurfaceContext }) {
  const funnels = useFunnels();
  const viewer = useViewer();
  const canEdit = canEditCampaigns(viewer.data?.role);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FunnelStatus | 'all'>('all');

  // Memoised so the fallback array does not re-run the filter every render.
  const all = useMemo(() => funnels.data ?? [], [funnels.data]);
  const needle = search.trim().toLowerCase();
  const matches = useMemo(
    () =>
      all.filter(
        (f) =>
          (status === 'all' || f.status === status) &&
          (!needle || f.name.toLowerCase().includes(needle))
      ),
    [all, needle, status]
  );

  const openCampaign = (id: string, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open('funnels.campaign', { id }, { target: targetFor(event) });
  };

  if (funnels.isError) {
    return (
      <div className={PANE_SHELL}>
        <PaneLoadError
          module="funnels"
          title="Could not load your campaigns"
          description={funnelErrorMessage(
            funnels.error,
            'This is a problem reaching the server. Nothing about your campaigns has changed.'
          )}
          onRetry={() => {
            void funnels.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Campaign list controls"
        search={
          <div className="max-w-xs min-w-0 flex-1">
            <SearchInput
              size="sm"
              aria-label="Search campaigns"
              placeholder="Search campaigns…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
        }
        filters={[
          {
            label: 'Show',
            key: 'status',
            value: status,
            neutralValue: 'all',
            onValueChange: (next) => {
              setStatus(next as FunnelStatus | 'all');
            },
            options: STATUS_FILTERS,
            present: 'chips',
          },
        ]}
        primaryAction={
          canEdit
            ? {
                label: 'New campaign',
                icon: faPlus,
                title: 'Start a new campaign — hold Shift to open alongside, Alt for a new window',
                onClick: (event) => {
                  openCampaign('new', event);
                },
              }
            : undefined
        }
        refresh={
          <RefreshButton
            isFetching={funnels.isFetching}
            updatedAt={funnels.data ? funnels.dataUpdatedAt : undefined}
            onRefresh={() => {
              void funnels.refetch();
            }}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {funnels.isPending ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneWaiting module="funnels" />
          </Card>
        ) : all.length === 0 ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
            <PaneEmpty
              module="funnels"
              icon={<Icon glyph={faArrowProgress} className="size-6" aria-hidden />}
              title="No campaigns yet"
              description="A campaign is a named path to an outcome: somebody finds your page, leaves their details, and eventually buys something or books you in. Set one up and you will see how many people made it to each step, and where they stopped."
              actions={
                canEdit ? (
                  <Button
                    color="module"
                    size="sm"
                    onClick={() => {
                      openCampaign('new', { shiftKey: false, altKey: false });
                    }}
                  >
                    <Icon glyph={faPlus} className="size-4" aria-hidden />
                    New campaign
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : matches.length === 0 ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
            <EmptyState
              icon={<Icon glyph={faArrowProgress} className="size-6" aria-hidden />}
              title="No campaigns match that"
              description="Try different words, or show every campaign again."
            />
          </Card>
        ) : (
          <ul className="flex w-full flex-col gap-2 p-4">
            {matches.map((funnel) => (
              <CampaignRow
                key={funnel.id}
                funnel={funnel}
                onOpen={(event) => {
                  openCampaign(funnel.id, event);
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <RowOpenHint what="a campaign to open it" />
    </div>
  );
}

export default CampaignsSurface;
