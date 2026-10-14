'use client';

// COST TO KEEP: what a year of holding all of it comes to. Stock is talked about
// as an asset; a money figure for storage, insurance, tied-up cash and breakage
// turns "we have plenty" into a number you can weigh against a discount.

// The second table is the point: the most expensive things to KEEP are not the
// most valuable things to own, since a slow line ties its money up for longer.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  EmptyState,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
} from '@wizeworks/silicaui-react';
import { faBoxOpen, faCoins } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { formatCents } from './data';
import { useHoldingCost, type HoldingCostReport } from './planning-data';
import { PlanningShell } from './planning-shell';
import { InlineWaiting } from '../../components/inline-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { SET_COSTS_SURFACE, SetCostsAction } from './set-costs-action';
import { HoldingByClassCard, HoldingTopItemsCard } from './planning-holding-tables';

export function PlanningHoldingSurface({ ctx }: { ctx: SurfaceContext }) {
  const report = useHoldingCost('');

  return (
    <PlanningShell
      label="Cost to keep controls"
      isFetching={report.isFetching}
      updatedAt={report.data ? report.dataUpdatedAt : undefined}
      onRefresh={() => {
        void report.refetch();
      }}
    >
      {(locationId) => <CostPanel ctx={ctx} locationId={locationId} />}
    </PlanningShell>
  );
}

function CostStats({ data }: { data: HoldingCostReport }) {
  return (
    <Stats className="grid grid-cols-1 gap-2 px-2 py-1 @2xl:grid-cols-3">
      <Stat>
        <StatTitle>Stock is worth</StatTitle>
        <StatValue>{formatCents(data.totalValueCents)}</StatValue>
        <StatDesc>At what you paid for it</StatDesc>
      </Stat>
      <Stat>
        <StatTitle>Costs a year to keep</StatTitle>
        <StatValue className="text-warning">{formatCents(data.annualHoldingCostCents)}</StatValue>
        <StatDesc>{formatCents(data.monthlyHoldingCostCents)} a month</StatDesc>
      </Stat>
      <Stat>
        <StatTitle>Carrying rate</StatTitle>
        <StatValue>{data.annualRatePct}%</StatValue>
        <StatDesc>{data.usingDefaultRate ? 'The usual estimate' : 'Your figure'}</StatDesc>
      </Stat>
    </Stats>
  );
}

// Every figure is a sum, and a level with no cost price adds nothing to it. A
// total that quietly understates is worse than one that names its gap.
function CostAlerts({ ctx, data }: { ctx: SurfaceContext; data: HoldingCostReport }) {
  return (
    <>
      {data.itemsWithoutCost > 0 ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>
              {data.itemsWithoutCost === 1
                ? '1 item has no cost price'
                : `${data.itemsWithoutCost} items have no cost price`}
            </AlertTitle>
            <AlertDescription>
              That stock is left out of everything on this screen, so what your stock is really
              worth (and what it really costs to keep) is higher than these figures say.
            </AlertDescription>
          </AlertContent>
          <SetCostsAction
            onOpen={() => {
              ctx.open(SET_COSTS_SURFACE, {}, { target: 'tab' });
            }}
          />
        </Alert>
      ) : null}

      {data.usingDefaultRate ? (
        <Alert color="info">
          <AlertContent>
            <AlertTitle>This uses the standard estimate</AlertTitle>
            <AlertDescription>
              25% a year is what the trade generally reckons storage, insurance, the money tied up,
              breakage and things going out of date come to together. If you know your own figure,
              set it under Planning settings and every number here follows it.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}
    </>
  );
}

function CostPanel({ ctx, locationId }: { ctx: SurfaceContext; locationId: string }) {
  const report = useHoldingCost(locationId);
  const data = report.data;

  // Before the `!data` branch, which would otherwise report a failed request as
  // "there is no stock on hand", a confident statement based on nothing.
  if (report.isError) {
    return (
      <PaneLoadError
        icon={<Icon glyph={faBoxOpen} className="size-6" aria-hidden />}
        title="Could not work out what your stock costs to keep"
        description="This is a problem reaching the server, not a finding about your stock. Try again in a moment."
        error={report.error}
      />
    );
  }
  if (report.isLoading) {
    return <InlineWaiting label="Working out what your stock costs to keep…" />;
  }
  if (!data) {
    return (
      <EmptyState
        icon={<Icon glyph={faCoins} className="size-6" aria-hidden />}
        title="Nothing to cost yet"
        description="There is no stock on hand to work this out from."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <CostStats data={data} />
      <CostAlerts ctx={ctx} data={data} />
      <HoldingByClassCard data={data} />
      <HoldingTopItemsCard data={data} />
    </div>
  );
}
