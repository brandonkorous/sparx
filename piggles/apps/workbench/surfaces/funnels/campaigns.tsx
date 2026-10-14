'use client';

// Campaigns — the app landing. Every named path to an outcome this business
// runs, and how each one is doing.

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { SearchInput, Text } from '@wizeworks/silicaui-react';
import { faArrowProgress, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PANE_SHELL, PaneToolbar } from '../../components/pane-toolbar';
import type { ToolbarFilter } from '../../components/pane-toolbar-filters';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import { useViewer } from '../../lib/api/shell-data';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useFunnels } from './data';
import { canEditCampaigns } from './presentation';
import type { FunnelStatus } from './types';
import { CampaignsBody, STATUS_FILTERS } from './campaigns-body';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
type StatusFilter = FunnelStatus | 'all';

/** How many campaigns, and how many the filters let through: the filtered number
 *  alone would claim the others do not exist. [[feedback_never_present_absence_as_measurement]] */
function countWord(shown: number, total: number): string {
  if (total === 0) return 'None set up yet';
  if (shown === total) return total === 1 ? '1 campaign' : `${String(total)} campaigns`;
  return `${String(shown)} of ${total === 1 ? '1 campaign' : `${String(total)} campaigns`}`;
}

function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

function CampaignsToolbar(props: {
  funnels: ReturnType<typeof useFunnels>;
  count: string;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  status: StatusFilter;
  setStatus: Dispatch<SetStateAction<StatusFilter>>;
  canEdit: boolean;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const { funnels } = props;
  return (
    <PaneToolbar
      label="Campaigns controls"
      status={
        <>
          <Icon glyph={faArrowProgress} className="size-4 shrink-0" aria-hidden />
          <Text as="span" className="shrink-0 text-sm whitespace-nowrap">
            {props.count}
          </Text>
        </>
      }
      statusReady={!funnels.isPending}
      statusFailed={funnels.isError}
      search={
        <div className="max-w-xs min-w-0 flex-1">
          <SearchInput
            size="sm"
            aria-label="Search campaigns"
            placeholder="Search campaigns…"
            value={props.search}
            onValueChange={props.setSearch}
          />
        </div>
      }
      filters={statusFilters(props.status, props.setStatus)}
      primaryAction={props.canEdit ? newCampaignAction(props.onOpen) : undefined}
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
  );
}

function statusFilters(
  status: StatusFilter,
  setStatus: Dispatch<SetStateAction<StatusFilter>>
): ToolbarFilter[] {
  return [
    {
      label: 'Show',
      key: 'status',
      value: status,
      neutralValue: 'all',
      onValueChange: (next) => {
        setStatus(next as StatusFilter);
      },
      options: STATUS_FILTERS,
      present: 'chips',
    },
  ];
}

function newCampaignAction(onOpen: (id: string, event: OpenEvent) => void) {
  return {
    label: 'New campaign',
    icon: faPlus,
    title: 'Start a new campaign. Hold Shift to open alongside, Alt for a new window',
    onClick: (event: OpenEvent) => {
      onOpen('new', event);
    },
  };
}

function useCampaignMatches(funnels: ReturnType<typeof useFunnels>) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  // Memoized so the fallback array does not re-run the filter every render.
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
  return { search, setSearch, status, setStatus, all, matches };
}

export function CampaignsSurface({ ctx }: { ctx: SurfaceContext }) {
  const funnels = useFunnels();
  const viewer = useViewer();
  const canEdit = canEditCampaigns(viewer.data?.role);
  const { search, setSearch, status, setStatus, all, matches } = useCampaignMatches(funnels);

  const openCampaign = (id: string, event: OpenEvent) => {
    ctx.open('funnels.campaign', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <CampaignsToolbar
        funnels={funnels}
        count={countWord(matches.length, all.length)}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        canEdit={canEdit}
        onOpen={openCampaign}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* A failure renders INSIDE the content region, never a `return` before
            the toolbar: search, filters and New campaign still work. */}
        <CampaignsBody
          funnels={funnels}
          all={all}
          matches={matches}
          search={search}
          status={status}
          canEdit={canEdit}
          onShowAll={() => {
            setStatus('all');
          }}
          onOpen={openCampaign}
        />
      </div>

      {matches.length > 0 && !funnels.isError ? <RowOpenHint what="a campaign to open it" /> : null}
    </div>
  );
}

export default CampaignsSurface;
