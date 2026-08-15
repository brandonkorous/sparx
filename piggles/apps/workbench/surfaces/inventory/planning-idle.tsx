'use client';

// NOT SELLING — stock that has stopped moving, and stock there is simply too
// much of. Two different problems with two different answers, so the row says
// which one it is rather than lumping both under "slow".
//
//   Not selling   nothing has gone out for longer than you consider dead.
//                 Every unit is a candidate for discounting or writing off.
//   Too much      it still sells, but there is more cover than the horizon you
//                 set. Only the EXCESS is the problem; the rest is fine.
//   Slowing       it sells more slowly than it did. Nothing is wrong yet — this
//                 is the one you catch before it becomes either of the above.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  EmptyState,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Table,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Gauge, PackageX, Snail } from 'lucide-react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural } from './data';
import { slowMoverLabel, slowMoverTone, useSlowMovers } from './planning-data';
import { PlanningShell, targetFor, useHasBeenMeasured } from './planning-shell';
import { InlineWaiting } from '../../components/inline-waiting';

export function PlanningIdleSurface({ ctx }: { ctx: SurfaceContext }) {
  const report = useSlowMovers('');

  return (
    <PlanningShell
      label="Not selling controls"
      isFetching={report.isFetching}
      updatedAt={report.data ? report.dataUpdatedAt : undefined}
      onRefresh={() => {
        void report.refetch();
      }}
    >
      {(locationId) => <SlowMoverPanel ctx={ctx} locationId={locationId} />}
    </PlanningShell>
  );
}

function SlowMoverPanel({ ctx, locationId }: { ctx: SurfaceContext; locationId: string }) {
  const report = useSlowMovers(locationId);
  const measured = useHasBeenMeasured();
  const rows = report.data?.rows ?? [];
  const totals = report.data?.totals;
  const multiLocation = new Set(rows.map((row) => row.warehouseId)).size > 1;

  // BEFORE the empty state, always. Without this branch a failed request falls
  // through to `rows = []` and the screen announces "nothing has been checked
  // yet" — a claim about the DATA when the truth is a broken connection. Seen
  // live while api-rest was restarting, and it was completely convincing.
  if (report.isError) {
    return (
      <EmptyState
        icon={<PackageX className="size-6" aria-hidden />}
        title="Could not work out what is not selling"
        description="This is a problem reaching the server, not a finding about your stock. Nothing here is a real answer until it loads — try again in a moment."
      />
    );
  }
  if (report.isLoading) {
    return <InlineWaiting label="Looking for stock that is not moving…" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <Stats className="w-full">
        <Stat>
          <StatTitle>Cash tied up</StatTitle>
          <StatValue className="text-warning">
            {formatCents(totals?.excessValueCents ?? 0)}
          </StatValue>
          <StatDesc>In stock beyond what the demand can absorb</StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Costing you a year</StatTitle>
          <StatValue>{formatCents(totals?.annualHoldingCostCents ?? 0)}</StatValue>
          <StatDesc>At {report.data?.holdingCostRatePct ?? 25}% a year to keep it</StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Not selling at all</StatTitle>
          <StatValue className="text-danger">{totals?.deadItems ?? 0}</StatValue>
          <StatDesc>{formatCents(totals?.deadValueCents ?? 0)} of it</StatDesc>
        </Stat>
      </Stats>

      {/* The money figures above are sums over rows, and a row with no cost
          price contributes nothing to them. Saying so is the difference between
          a total that is low and a total that is wrong. */}
      {totals && totals.itemsWithoutCost > 0 ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>
              {plural(totals.itemsWithoutCost, 'item has', 'items have')} no cost price
            </AlertTitle>
            <AlertDescription>
              The cash figures above leave {totals.itemsWithoutCost === 1 ? 'it' : 'them'} out
              entirely, so the real amount tied up is higher than it says. Set what you pay for{' '}
              {totals.itemsWithoutCost === 1 ? 'that item' : 'those items'} and they will be counted
              in.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        measured ? (
          <EmptyState
            icon={<Snail className="size-6" aria-hidden />}
            title="Everything is moving"
            description="Nothing is sitting beyond the horizon you set, and nothing has gone quiet. Either the buying is well judged, or there is not enough history yet to tell."
          />
        ) : (
          <EmptyState
            icon={<Gauge className="size-6" aria-hidden />}
            title="Nothing has been checked yet"
            description="This list is empty because no pass has been made over your sales — not because everything is moving. Press “Work it out now” above to find out which it is."
          />
        )
      ) : (
        <Card className="overflow-x-auto">
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Item</th>
                <th className="whitespace-nowrap">What is wrong</th>
                <th className="hidden text-right whitespace-nowrap @lg:table-cell">In stock</th>
                <th className="hidden text-right whitespace-nowrap @xl:table-cell">Too many</th>
                <th className="text-right whitespace-nowrap">Cash in it</th>
                <th className="hidden text-right whitespace-nowrap @2xl:table-cell">A year</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.variantId}:${row.warehouseId}`}
                  className="cursor-pointer"
                  tabIndex={0}
                  role="button"
                  onClick={(event) => {
                    ctx.open(
                      'inventory.stock.item',
                      { variantId: row.variantId },
                      { target: targetFor(event) }
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    ctx.open('inventory.stock.item', { variantId: row.variantId });
                  }}
                >
                  <td className="w-full max-w-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{row.title ?? 'Untitled product'}</span>
                      <span className="truncate text-sm">
                        <span className="font-mono">{row.sku ?? 'No code'}</span>
                        {multiLocation && row.warehouseName ? (
                          <span> · {row.warehouseName}</span>
                        ) : null}
                      </span>
                      {/* Printed once per run of the same problem: the action
                          follows from the KIND, so on a list of six dead lines
                          it would otherwise be the same sentence six times. */}
                      {row.suggestedAction !== rows[index - 1]?.suggestedAction ? (
                        <span className="truncate text-sm">{row.suggestedAction}</span>
                      ) : null}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <Badge color={slowMoverTone(row.kind)} variant="soft" size="sm">
                      {slowMoverLabel(row.kind)}
                    </Badge>
                  </td>
                  <td className="hidden text-right tabular-nums @lg:table-cell">{row.onHand}</td>
                  <td className="hidden text-right tabular-nums @xl:table-cell">
                    {row.excessUnits > 0 ? row.excessUnits : '—'}
                  </td>
                  {/* No cost price means these are zero because nothing was
                      recorded, not because the stock is worthless. A hundred
                      notebooks reading $0.00 is a wrong answer; "No cost set"
                      is the right one and points at the fix. */}
                  <td className="text-right font-medium whitespace-nowrap tabular-nums">
                    {row.costKnown ? (
                      formatCents(row.excessValueCents)
                    ) : (
                      <Tooltip content="No cost price recorded for this item, so what it ties up cannot be worked out.">
                        <span className="font-normal">No cost set</span>
                      </Tooltip>
                    )}
                  </td>
                  <td className="hidden text-right whitespace-nowrap tabular-nums @2xl:table-cell">
                    {row.costKnown ? formatCents(row.annualHoldingCostCents) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
