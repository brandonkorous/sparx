// sparx.market settlement surface (docs/106 §4.7) — the read-only revenue figures
// every seller sees: aggregate GMV / commission / net / pending / paid, plus the
// weekly settlement-run history. Server component (no interactivity beyond the
// status badges), so it renders straight from the settlement reads.

import { Badge, Card, CardBody, CardTitle, Table } from 'silicaui-react';
import { Stat, statusLabel, statusTone } from '@sparx/ui';

import { formatMoney } from '../_format';
import type { MarketSettlementRun, MarketSettlementSummary } from '../_types';

function periodLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const fmt = (d: Date) =>
    Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function SettlementPanel({
  summary,
  runs,
}: {
  summary: MarketSettlementSummary | null;
  runs: MarketSettlementRun[];
}) {
  // Currency comes off the runs (single-currency per run — Phase 1 USD); the
  // aggregate figures are reported in the same currency.
  const currency = runs[0]?.currency ?? 'USD';

  return (
    // Neutral: the sparx Pay balance card up the page is this finance surface's one
    // tinted (primary) card — a second finance tint here would be competing washes,
    // not wayfinding (one-tinted-card-per-hue). The hue rides the chrome + badges.
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Marketplace earnings</CardTitle>
          {summary && (
            <p className="text-base-content/70 text-xs">
              {summary.orderCount.toLocaleString()} order{summary.orderCount === 1 ? '' : 's'} all
              time
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {summary ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Gross sales" value={formatMoney(summary.grossCents, currency)} />
              <Stat label="Commission" value={formatMoney(summary.commissionCents, currency)} />
              <Stat
                label="Pending payout"
                value={formatMoney(summary.pendingCents, currency)}
                hint="Accrued, not yet paid"
              />
              <Stat
                label="Paid out"
                value={formatMoney(summary.paidCents, currency)}
                hint="Settled via ACH"
              />
            </div>
          ) : (
            <p className="text-base-content/70 text-sm">
              Earnings will appear here once you make your first sale on sparx.market.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Payout history</p>
            {runs.length === 0 ? (
              <p className="text-base-content/70 text-sm">
                No payouts yet. Settlements run weekly — your net (gross minus commission and
                refunds) is sent to your bank account on file.
              </p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Gross</th>
                    <th className="text-right">Commission</th>
                    <th className="text-right">Net</th>
                    <th>Status</th>
                    <th>Payout ref</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td className="font-medium whitespace-nowrap">
                        {periodLabel(run.periodStart, run.periodEnd)}
                      </td>
                      <td className="text-right tabular-nums">{run.orderCount.toLocaleString()}</td>
                      <td className="text-right tabular-nums">
                        {formatMoney(run.grossCents, run.currency)}
                      </td>
                      <td className="text-base-content/70 text-right tabular-nums">
                        {formatMoney(run.commissionCents, run.currency)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatMoney(run.netCents, run.currency)}
                      </td>
                      <td>
                        <Badge color={statusTone(run.status)} variant="soft" size="sm">
                          {statusLabel(run.status)}
                        </Badge>
                      </td>
                      <td className="text-base-content/70 font-mono text-xs">
                        {run.disbursementRef ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
