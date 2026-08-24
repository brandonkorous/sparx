'use client';

// The assembled report: one capped, centred column of cards, in the order the
// questions get asked. Each block below owns its own load and error state, so a
// slow or failed query costs you that card rather than the whole page.

import { Alert, AlertContent, AlertDescription, AlertTitle, Text } from '@wizeworks/silicaui-react';
import { InlineWaiting } from '../../components/inline-waiting';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { InventorySummary } from './reports-data';
import { COLUMN, targetFor } from './reports-shared';
import type { ReportQueries, ReportRange } from './reports-queries';
import { Headline, HealthCard, LocationsCard } from './reports-value';
import { UncostedNotice } from './reports-uncosted';
import { AgeingCard, DeadStockCard } from './reports-ageing';
import { ShrinkageCard } from './reports-shrinkage';
import { CostOfGoodsCard, TurnoverCard } from './reports-movement';
import { AsOfCard } from './reports-asof';

function CouldNotWorkOut({ what }: { what: string }) {
  return (
    <Alert color="warning">
      <AlertContent>
        <AlertTitle>Could not work out {what} just now</AlertTitle>
        <AlertDescription>
          The rest of your figures are fine. Refresh to try this one again.
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}

interface BlockProps {
  ctx: SurfaceContext;
  q: ReportQueries;
  data: InventorySummary;
  currency: string;
  locationName: string | null;
}

/**
 * Losses sit between "how it is looking" and "what is sitting still" because
 * they answer the question those two raise: stock that is neither healthy nor
 * slow-moving because it is no longer there.
 */
function Losses({ ctx, q, currency }: Omit<BlockProps, 'data' | 'locationName'>) {
  if (q.shrinkage.isError) return <CouldNotWorkOut what="losses" />;
  if (!q.shrinkage.data) return null;
  return (
    <ShrinkageCard
      report={q.shrinkage.data}
      currency={currency}
      onOpen={(variantId, event) => {
        ctx.open('inventory.stock.item', { variantId }, { target: targetFor(event) });
      }}
    />
  );
}

function Ageing({ ctx, q, currency, locationName }: Omit<BlockProps, 'data'>) {
  if (q.aging.isError) return <CouldNotWorkOut what="ageing" />;
  if (!q.aging.data) return <InlineWaiting label="Working out ageing…" />;
  const deadStock = q.aging.data.deadStock;

  return (
    <>
      <AgeingCard report={q.aging.data} currency={currency} locationName={locationName} />
      {deadStock.length > 0 ? (
        <DeadStockCard
          items={deadStock}
          currency={currency}
          onOpen={(item, event) => {
            ctx.open(
              'inventory.stock.item',
              { variantId: item.variantId },
              { target: targetFor(event) }
            );
          }}
        />
      ) : (
        <Alert color="success" variant="soft">
          <AlertContent>
            <AlertTitle>Nothing is gathering dust</AlertTitle>
            <AlertDescription>
              Everything you hold{locationName ? ` at ${locationName}` : ''} has sold recently
              enough not to count as dead stock. That is money working, not sitting.
            </AlertDescription>
          </AlertContent>
        </Alert>
      )}
    </>
  );
}

export function ReportsColumn({
  ctx,
  q,
  data,
  currency,
  locationName,
  range,
  locationId,
}: BlockProps & { range: ReportRange; locationId: string }) {
  return (
    <div className={COLUMN}>
      <Text>
        What your stock is worth, what is sitting still, and how fast it moves — the money side of
        what you hold.
      </Text>

      <Headline summary={data} aging={q.aging.data} turnover={q.turnover.data} />
      <UncostedNotice ctx={ctx} valuation={data.valuation} />
      <HealthCard summary={data} />
      {data.byLocation.length > 1 ? <LocationsCard summary={data} /> : null}

      <Losses ctx={ctx} q={q} currency={currency} />
      <Ageing ctx={ctx} q={q} currency={currency} locationName={locationName} />

      {q.turnover.isError ? (
        <CouldNotWorkOut what="selling pace" />
      ) : q.turnover.data ? (
        <TurnoverCard report={q.turnover.data} currency={currency} />
      ) : null}

      {/* Cost of goods sits after selling pace because it is the other half of
          the same sum: pace says how fast stock moved, this says what the stock
          that moved had cost. */}
      <CostOfGoodsCard range={range} locationId={locationId} />

      {/* Last, because it is the one figure on the screen that is not about
          now — an accountant's question, asked occasionally, rather than the
          owner's question, asked daily. */}
      <AsOfCard locationId={locationId} />
    </div>
  );
}
