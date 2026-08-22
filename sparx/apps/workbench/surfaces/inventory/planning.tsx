'use client';

// AT RISK — what is about to run out, ordered by what running out would cost.
//
// The daily planning surface, and the reason the module exists. Its siblings —
// What matters, Not selling, Cost to keep and Planning settings — are separate
// surfaces rather than tabs; see planning-shell.tsx for why.
//
// ── Ordered by money, not by emptiness ────────────────────────────────────
//
// "Least in stock first" ranks by how empty a shelf looks. With forty rows and
// an hour, a buyer needs the row whose emptiness costs the most — a fast £40
// line four days out beats a dormant £2 one down to its last unit. Every row
// carries the sentence explaining its own figure, so the ordering is checkable
// rather than asserted.
//
// ── Every number says how much to trust it ────────────────────────────────
//
// A forecast built on nine days of sales and one delivery is arithmetically the
// same shape as one built on three years and forty deliveries. So a row that has
// never been measured says so instead of showing a zero, and an empty list says
// WHICH kind of empty it is: nothing at risk, or nothing looked at yet.

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
  Text,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Boxes, Gauge, PackageX, TriangleAlert } from 'lucide-react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { formatCents, plural } from './data';
import {
  coverPhrase,
  leadTimeSourceLabel,
  riskTone,
  useLeadTimes,
  useStockoutRisk,
  type StockoutRiskRow,
} from './planning-data';
import { PlanningShell, targetFor, useHasBeenMeasured } from './planning-shell';

export function PlanningSurface({ ctx }: { ctx: SurfaceContext }) {
  const risk = useStockoutRisk('');

  return (
    <PlanningShell
      label="At risk controls"
      isFetching={risk.isFetching}
      updatedAt={risk.data ? risk.dataUpdatedAt : undefined}
      onRefresh={() => {
        void risk.refetch();
      }}
    >
      {(locationId) => <RiskPanel ctx={ctx} locationId={locationId} />}
    </PlanningShell>
  );
}

function RiskPanel({ ctx, locationId }: { ctx: SurfaceContext; locationId: string }) {
  const risk = useStockoutRisk(locationId);
  const leadTimes = useLeadTimes();
  const measured = useHasBeenMeasured();

  const open = (row: StockoutRiskRow, event: { shiftKey: boolean; altKey: boolean }) => {
    ctx.open(
      'inventory.planning.explain',
      { variantId: row.variantId, warehouseId: row.warehouseId },
      { target: targetFor(event) }
    );
  };

  if (risk.isError) {
    return (
      <EmptyState
        icon={<PackageX className="size-6" aria-hidden />}
        title="Could not work out what is at risk"
        description="This is a problem reaching the server. Your stock is unaffected — the figures just could not be read right now."
      />
    );
  }
  if (risk.isLoading) {
    return (
      <p className="p-4 text-base" role="status">
        Working out what is at risk…
      </p>
    );
  }

  const report = risk.data;
  const rows = report?.rows ?? [];
  const measuredSuppliers = (leadTimes.data?.items ?? []).filter((l) => l.isReliable).length;

  return (
    <div className="flex flex-col gap-3">
      <Stats className="w-full">
        <Stat>
          <StatTitle>Sales at risk</StatTitle>
          <StatValue className="text-danger">
            {formatCents(report?.totalRevenueAtRiskCents ?? 0)}
          </StatValue>
          <StatDesc>Orders that would have nothing to come from</StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Items to act on</StatTitle>
          <StatValue>{rows.length}</StatValue>
          <StatDesc>Ordered by what running out would cost</StatDesc>
        </Stat>
        <Stat>
          <StatTitle>Suppliers measured</StatTitle>
          <StatValue>{measuredSuppliers}</StatValue>
          <StatDesc>Delivery times taken from real deliveries</StatDesc>
        </Stat>
      </Stats>

      {report && report.unmeasuredLevels > 0 ? (
        <Alert color="warning">
          <AlertContent>
            <AlertTitle>
              {plural(report.unmeasuredLevels, 'stock line has', 'stock lines have')} never been
              measured
            </AlertTitle>
            <AlertDescription>
              They cannot appear in this list, because nothing is known about how fast they sell.
              They will be picked up on the next overnight run.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        // TWO empty lists that mean opposite things. Before a sweep has run this
        // list is empty because nobody has looked — announcing "nothing is at
        // risk, this is the good version of an empty list" there would be the
        // most damaging sentence on the screen.
        measured ? (
          <EmptyState
            icon={<Boxes className="size-6" aria-hidden />}
            title="Nothing is at risk"
            description="Every item that sells has enough stock, or enough on its way, to last until a replacement could arrive. This is the good version of an empty list."
          />
        ) : (
          <EmptyState
            icon={<Gauge className="size-6" aria-hidden />}
            title="Nothing has been checked yet"
            description="This list is empty because no pass has been made over your sales and deliveries — not because everything is fine. Press “Work it out now” above to find out which it is."
          />
        )
      ) : (
        <Card className="overflow-x-auto">
          <Table size="sm" hover>
            <thead>
              <tr>
                <th>Item</th>
                <th className="hidden text-right whitespace-nowrap @lg:table-cell">Left</th>
                <th className="hidden text-right whitespace-nowrap @xl:table-cell">On the way</th>
                <th className="hidden whitespace-nowrap @2xl:table-cell">Supplier takes</th>
                <th className="whitespace-nowrap">Runs out</th>
                <th className="text-right whitespace-nowrap">At risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const tone = riskTone(row);
                return (
                  <tr
                    key={`${row.variantId}:${row.warehouseId}`}
                    className="cursor-pointer"
                    tabIndex={0}
                    role="button"
                    onClick={(event) => {
                      open(row, event);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      open(row, event);
                    }}
                  >
                    <td className="w-full max-w-0">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{row.title ?? 'Untitled product'}</span>
                        <span className="truncate font-mono text-sm">{row.sku ?? 'No code'}</span>
                        {/* The sentence IS the row. Everything else is a number
                            you would otherwise have to assemble yourself. */}
                        <span className="truncate text-sm">{row.reasoning}</span>
                      </span>
                    </td>
                    <td className="hidden text-right tabular-nums @lg:table-cell">
                      {row.available}
                    </td>
                    <td className="hidden text-right tabular-nums @xl:table-cell">
                      {row.onOrder > 0 ? row.onOrder : '—'}
                    </td>
                    <td className="hidden whitespace-nowrap @2xl:table-cell">
                      <Tooltip content={leadTimeSourceLabel(row.leadTimeSource)}>
                        <Badge
                          color={row.leadTimeSource === 'measured' ? 'success' : 'warning'}
                          variant="soft"
                          size="sm"
                        >
                          {Math.round(row.leadTimeDays)} days
                        </Badge>
                      </Tooltip>
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge color={tone} variant="soft" size="sm">
                        {coverPhrase(row)}
                      </Badge>
                    </td>
                    <td className="text-right font-medium whitespace-nowrap tabular-nums">
                      {row.revenueAtRiskCents > 0 ? formatCents(row.revenueAtRiskCents) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {rows.length > 0 ? (
        <Text className="px-1 text-sm">
          <TriangleAlert className="mr-1 inline size-4 align-text-bottom" aria-hidden />
          Click a row to see exactly how its figures were worked out · shift-click alongside
        </Text>
      ) : null}
    </div>
  );
}
