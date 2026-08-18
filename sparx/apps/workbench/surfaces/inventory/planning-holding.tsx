'use client';

// COST TO KEEP — what a year of holding all of it comes to.
//
// The figure nobody has, and the one that makes every other planning decision
// arguable. Stock is normally discussed as an asset, so "too much of it" reads
// as a mild inefficiency rather than a bill. Putting a pound figure on a year of
// storage, insurance, tied-up money, breakage and obsolescence is what turns
// "we have plenty" into a number you can weigh against a discount.
//
// The second table is the point of the screen: the most expensive things to KEEP
// are not the most valuable things to own. A slow line ties its money up for far
// longer than a fast one of the same value, and only this ranking shows it.

import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  EmptyState,
  Heading,
  Stat,
  StatDesc,
  StatTitle,
  StatValue,
  Stats,
  Table,
  Text,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Coins, PackageX } from 'lucide-react';
import { formatCents } from './data';
import { abcLabel, abcTone, useHoldingCost } from './planning-data';
import { PlanningShell } from './planning-shell';

export function PlanningHoldingSurface() {
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
      {(locationId) => <CostPanel locationId={locationId} />}
    </PlanningShell>
  );
}

function CostPanel({ locationId }: { locationId: string }) {
  const report = useHoldingCost(locationId);
  const data = report.data;

  // Must come before the `!data` branch below, which would otherwise report a
  // failed request as "there is no stock on hand" — a confident statement about
  // the warehouse based on not having reached the server.
  if (report.isError) {
    return (
      <EmptyState
        icon={<PackageX className="size-6" aria-hidden />}
        title="Could not work out what your stock costs to keep"
        description="This is a problem reaching the server, not a finding about your stock. Try again in a moment."
      />
    );
  }
  if (report.isLoading) {
    return (
      <p className="p-4 text-base" role="status">
        Working out what your stock costs to keep…
      </p>
    );
  }
  if (!data) {
    return (
      <EmptyState
        icon={<Coins className="size-6" aria-hidden />}
        title="Nothing to cost yet"
        description="There is no stock on hand to work this out from."
      />
    );
  }

  const multiLocation = new Set(data.topItems.map((item) => item.warehouseId)).size > 1;

  return (
    <div className="flex flex-col gap-3">
      <Stats className="w-full">
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

      {/* Every figure above is a sum, and a level with no cost price adds
          nothing to it. A total that quietly understates is worse than one that
          names its gap. */}
      {data.itemsWithoutCost > 0 ? (
        <Alert color="warning" variant="soft">
          <AlertContent>
            <AlertTitle>
              {data.itemsWithoutCost === 1
                ? '1 item has no cost price'
                : `${data.itemsWithoutCost} items have no cost price`}
            </AlertTitle>
            <AlertDescription>
              They are left out of everything on this screen, so what your stock is really worth —
              and what it really costs to keep — is higher than these figures say.
            </AlertDescription>
          </AlertContent>
        </Alert>
      ) : null}

      {data.usingDefaultRate ? (
        <Alert color="info" variant="soft">
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

      <Card className="flex flex-col gap-2 p-3">
        <Heading level={3} className="text-base">
          By how much the item matters
        </Heading>
        <Table size="sm">
          <thead>
            <tr>
              <th>Group</th>
              <th className="text-right">Worth</th>
              <th className="text-right">Costs a year</th>
            </tr>
          </thead>
          <tbody>
            {data.byClass.map((c) => (
              <tr key={c.abcClass}>
                <td>
                  <Badge color={abcTone(c.abcClass)} variant="soft" size="sm">
                    {abcLabel(c.abcClass === 'unclassified' ? null : c.abcClass)}
                  </Badge>
                </td>
                <td className="text-right tabular-nums">{formatCents(c.valueCents)}</td>
                <td className="text-right tabular-nums">{formatCents(c.annualHoldingCostCents)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card className="flex flex-col gap-2 p-3">
        <Heading level={3} className="text-base">
          The most expensive things to keep
        </Heading>
        <Text className="text-sm">
          Not the same list as the most valuable things to own — a slow item ties its money up for
          far longer.
        </Text>
        <div className="overflow-x-auto">
          <Table size="sm">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">In stock</th>
                <th className="text-right">Worth</th>
                <th className="text-right">Cover</th>
                <th className="text-right">Costs a year</th>
              </tr>
            </thead>
            <tbody>
              {data.topItems.map((item) => (
                <tr key={`${item.variantId}:${item.warehouseId}`}>
                  <td className="w-full max-w-0">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{item.title ?? 'Untitled product'}</span>
                      <span className="truncate text-sm">
                        <span className="font-mono">{item.sku ?? 'No code'}</span>
                        {/* Stock kept in two places is two rows in this ranking,
                            and both would otherwise read identically. */}
                        {multiLocation && item.warehouseName ? (
                          <span> · {item.warehouseName}</span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{item.onHand}</td>
                  <td className="text-right tabular-nums">
                    {item.costKnown ? (
                      formatCents(item.valueCents)
                    ) : (
                      <Tooltip content="No cost price recorded for this item, so what it is worth cannot be worked out.">
                        <span>No cost set</span>
                      </Tooltip>
                    )}
                  </td>
                  <td className="text-right tabular-nums">
                    {item.daysOfCover === null ? '—' : `${Math.round(item.daysOfCover)} days`}
                  </td>
                  <td className="text-right tabular-nums">
                    {item.costKnown ? formatCents(item.annualHoldingCostCents) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
