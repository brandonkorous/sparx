'use client';

// The content region of the campaigns landing: the load failure, waiting, no
// campaigns yet, nothing matching the filters, and the list itself.

import { Button, Card, EmptyState } from '@wizeworks/silicaui-react';
import { faArrowProgress, faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { CampaignRow } from './campaign-row';
import type { useFunnels } from './data';
import { funnelErrorMessage } from './data';
import type { Funnel, FunnelStatus } from './types';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

export const STATUS_FILTERS = [
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

function NoCampaigns(props: { canEdit: boolean; onNew: () => void }) {
  return (
    <Card className="min-h-0 flex-1 items-center justify-center">
      <PaneEmpty
        module="funnels"
        icon={<Icon glyph={faArrowProgress} className="size-6" aria-hidden />}
        title="No campaigns yet"
        description="A campaign is a named path to an outcome: somebody finds your page, leaves their details, and in the end does what you were hoping for: signs up, books in or buys. Set one up and you will see how many people made it to each step, and where they stopped."
        actions={
          props.canEdit ? (
            <Button color="module" size="sm" onClick={props.onNew}>
              <Icon glyph={faPlus} className="size-4" aria-hidden />
              New campaign
            </Button>
          ) : undefined
        }
      />
    </Card>
  );
}

function NothingMatches(props: {
  search: string;
  status: FunnelStatus | 'all';
  onShowAll: () => void;
}) {
  const { status } = props;
  const words = props.search.trim();
  return (
    <Card className="min-h-0 flex-1 items-center justify-center">
      {/* Says WHICH of the two is hiding them: "try different words" to somebody
          who typed none is wrong advice. [[feedback_one_outcome_two_causes]] */}
      <EmptyState
        icon={<Icon glyph={faArrowProgress} className="size-6" aria-hidden />}
        title="Nothing matches"
        description={
          words && status !== 'all'
            ? `Nothing called "${words}" is showing under ${statusWord(status)}. Try other words, or show every campaign.`
            : words
              ? `Nothing here is called "${words}". Try other words.`
              : `You have campaigns, but none of them is showing under ${statusWord(status)}.`
        }
        actions={
          status === 'all' ? undefined : (
            <Button size="sm" color="module" variant="soft" onClick={props.onShowAll}>
              Show every campaign
            </Button>
          )
        }
      />
    </Card>
  );
}

function CampaignsLoadFailed({ funnels }: { funnels: ReturnType<typeof useFunnels> }) {
  return (
    <Card className="min-h-0 flex-1 items-center justify-center">
      <PaneLoadError
        module="funnels"
        title="Could not load your campaigns"
        description={funnelErrorMessage(
          funnels.error,
          'This is a problem reaching the server. Nothing about your campaigns has changed.'
        )}
        error={funnels.error}
        onRetry={() => {
          void funnels.refetch();
        }}
      />
    </Card>
  );
}

export function CampaignsBody(props: {
  funnels: ReturnType<typeof useFunnels>;
  all: Funnel[];
  matches: Funnel[];
  search: string;
  status: FunnelStatus | 'all';
  canEdit: boolean;
  onShowAll: () => void;
  onOpen: (id: string, event: OpenEvent) => void;
}) {
  const { funnels, matches } = props;
  if (funnels.isError) return <CampaignsLoadFailed funnels={funnels} />;
  if (funnels.isPending) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneWaiting module="funnels" />
      </Card>
    );
  }
  if (props.all.length === 0) {
    const onNew = () => {
      props.onOpen('new', { shiftKey: false, altKey: false });
    };
    return <NoCampaigns canEdit={props.canEdit} onNew={onNew} />;
  }
  if (matches.length === 0) {
    return (
      <NothingMatches search={props.search} status={props.status} onShowAll={props.onShowAll} />
    );
  }
  return (
    <ul className="flex w-full flex-col gap-2 p-4">
      {matches.map((funnel) => (
        <CampaignRow
          key={funnel.id}
          funnel={funnel}
          onOpen={(event) => {
            props.onOpen(funnel.id, event);
          }}
        />
      ))}
    </ul>
  );
}
