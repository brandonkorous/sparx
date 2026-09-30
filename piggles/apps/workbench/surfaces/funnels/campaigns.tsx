'use client';

// Campaigns — the app landing. Every named path to an outcome this business
// runs, and how each one is doing.

import { useMemo, useState } from 'react';
import { Button, Card, EmptyState, SearchInput, Text } from '@wizeworks/silicaui-react';
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

/** The filter chip's own words, so the empty state names the control she
 *  pressed rather than a word only this file knows. */
function statusWord(status: FunnelStatus | 'all'): string {
  return STATUS_FILTERS.find((f) => f.value === status)?.label ?? 'that filter';
}

/**
 * How many campaigns, and how many of them the filters are letting through.
 *
 * The bar's left side was empty, so the one fact a person wants before reading
 * anything — how many are there — was only obtainable by counting the rows. And
 * when a filter hides some, saying the filtered number alone would claim the
 * others do not exist. [[feedback_never_present_absence_as_measurement]]
 */
function countWord(shown: number, total: number): string {
  if (total === 0) return 'None set up yet';
  if (shown === total) return total === 1 ? '1 campaign' : `${String(total)} campaigns`;
  return `${String(shown)} of ${total === 1 ? '1 campaign' : `${String(total)} campaigns`}`;
}

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

  return (
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Campaigns controls"
        status={
          <>
            <Icon glyph={faArrowProgress} className="size-4 shrink-0" aria-hidden />
            <Text as="span" className="shrink-0 text-sm whitespace-nowrap">
              {countWord(matches.length, all.length)}
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
                title: 'Start a new campaign. Hold Shift to open alongside, Alt for a new window',
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
        {/* The failure branches INSIDE the content region, not around it.
            This used to `return` before the toolbar, which drops the bar, the
            search, the filters and New campaign along with the list — a bigger
            claim than the truth, since none of those is broken and changing a
            filter is a second way to re-run the read. pane-load-error.tsx says
            so in its own header; this call site pre-dated it. */}
        {funnels.isError ? (
          <Card className="min-h-0 flex-1 items-center justify-center">
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
          </Card>
        ) : funnels.isPending ? (
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
            {/* WHICH of the two is hiding them. "Try different words" sent
                somebody who had typed no words off to change words they never
                typed — one outcome, two causes, one piece of advice that is
                wrong half the time. [[feedback_one_outcome_two_causes]] */}
            <EmptyState
              icon={<Icon glyph={faArrowProgress} className="size-6" aria-hidden />}
              title="Nothing matches"
              description={
                needle && status !== 'all'
                  ? `Nothing called "${search.trim()}" is showing under ${statusWord(status)}. Try other words, or show every campaign.`
                  : needle
                    ? `Nothing here is called "${search.trim()}". Try other words.`
                    : `You have campaigns, but none of them is showing under ${statusWord(status)}.`
              }
              actions={
                status === 'all' ? undefined : (
                  <Button
                    size="sm"
                    color="module"
                    variant="soft"
                    onClick={() => {
                      setStatus('all');
                    }}
                  >
                    Show every campaign
                  </Button>
                )
              }
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

      {matches.length > 0 && !funnels.isError ? <RowOpenHint what="a campaign to open it" /> : null}
    </div>
  );
}

export default CampaignsSurface;
