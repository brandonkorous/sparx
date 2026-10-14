'use client';

// ON THE WAY: what suppliers have told you they have shipped. A notice is a CLAIM,
// not stock: nothing here has arrived or moved a number. It gives you warning and,
// when the pallet lands, a pre-filled delivery to check against.

// A notice whose date has passed with nothing received against it is the strongest
// signal in buying: the supplier believes they shipped and you do not have it. It
// gets its own color and sorts to the top of the default view.

import { useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Card,
  EmptyState,
  NativeSelect,
  Text,
} from '@wizeworks/silicaui-react';
import { faBoxMagnifyingGlass, faTruck } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { plural } from './data';
import { useBusinessZone } from '../../lib/business-timezone';
import { useAdvanceShipNotices, type AsnListQuery } from './advance-ship-notices-data';
import { AsnListTable } from './asn-list-table';

type View = 'open' | 'overdue' | 'received' | 'all';

const VIEWS: Record<View, AsnListQuery> = {
  open: { status: 'expected' },
  overdue: { status: 'expected', overdueOnly: true },
  received: { status: 'received' },
  all: {},
};

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

type Notices = ReturnType<typeof useAdvanceShipNotices>;
type OpenNotice = (id: string, event: { shiftKey: boolean; altKey: boolean }) => void;

function AsnListBody({
  notices,
  view,
  onOpen,
}: {
  notices: Notices;
  view: View;
  onOpen: OpenNotice;
}) {
  // Calendar days in the SHOP's own zone, never elapsed hours on whichever clock
  // the reader happens to be near. `lib/console/days.ts` is the rule.
  const zone = useBusinessZone();
  const rows = notices.data?.items ?? [];
  if (notices.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faBoxMagnifyingGlass} className="size-6" aria-hidden />}
        title="Could not load what is on the way"
        description="This is a problem reaching the server, not a statement that nothing has shipped. Try again in a moment."
        error={notices.error}
      />
    );
  }
  if (notices.isLoading) {
    return <PaneWaiting label="Loading what is on the way…" />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Icon glyph={faTruck} className="size-6" aria-hidden />}
        title={view === 'overdue' ? 'Nothing is missing' : 'Nothing on the way'}
        description={
          view === 'overdue'
            ? 'Every shipment a supplier told you about has either arrived or is still inside its date.'
            : 'When a supplier tells you what they have shipped (by email, on a file, or through their own system), record it against the order and it appears here. Receiving then pre-fills from it instead of being typed from scratch.'
        }
      />
    );
  }
  return <AsnListTable rows={rows} now={new Date()} zone={zone} onOpen={onOpen} />;
}

function AsnListToolbar({
  view,
  onView,
  notices,
}: {
  view: View;
  onView: (view: View) => void;
  notices: Notices;
}) {
  return (
    <PaneToolbar
      label="On the way controls"
      controls={
        <NativeSelect
          size="sm"
          className="max-w-48 shrink"
          aria-label="Show shipments that are"
          value={view}
          onChange={(event) => {
            onView(event.target.value as View);
          }}
        >
          <option value="open">On the way</option>
          <option value="overdue">Should have arrived</option>
          <option value="received">Arrived</option>
          <option value="all">Everything</option>
        </NativeSelect>
      }
      views={{
        target: '/inventory/advance-ship-notices',
        params: { state: view },
        onApply: (next) => {
          onView(next.state && next.state in VIEWS ? (next.state as View) : 'open');
        },
      }}
      refresh={
        <RefreshButton
          isFetching={notices.isFetching}
          updatedAt={notices.data ? notices.dataUpdatedAt : undefined}
          onRefresh={() => {
            void notices.refetch();
          }}
        />
      }
    />
  );
}

export function AsnListSurface({ ctx }: { ctx: SurfaceContext }) {
  const [view, setView] = useState<View>('open');
  const notices = useAdvanceShipNotices(VIEWS[view]);
  const overdue = (notices.data?.items ?? []).filter((row) => row.isOverdue).length;

  const open: OpenNotice = (id, event) => {
    ctx.open('inventory.advance-ship-notices.detail', { id }, { target: targetFor(event) });
  };

  return (
    <div className={PANE_SHELL}>
      <AsnListToolbar view={view} onView={setView} notices={notices} />

      {overdue > 0 && view !== 'overdue' ? (
        <Alert color="danger" variant="soft">
          <AlertContent>
            <AlertTitle>{plural(overdue, 'shipment is', 'shipments are')} overdue</AlertTitle>
            <AlertDescription>
              The supplier has said this stock is on its way, and nothing has been booked in against
              it, so either it is stuck with the carrier or it never left.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      <Card className="min-h-0 flex-1 overflow-auto">
        <AsnListBody notices={notices} view={view} onOpen={open} />
      </Card>

      <Text className="text-sm">
        Nothing here counts as stock. A shipment becomes stock when somebody books the delivery in.
      </Text>
    </div>
  );
}
