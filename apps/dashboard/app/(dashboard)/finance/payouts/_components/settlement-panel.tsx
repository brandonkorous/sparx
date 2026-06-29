// sparx.market settlement surface (docs/106 §4.7) — the read-only revenue figures
// every seller sees: aggregate GMV / commission / net / pending / paid, plus the
// weekly settlement-run history. Server component (no interactivity beyond the
// status badges), so it renders straight from the settlement reads.

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Stack,
  Stat,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
  statusLabel,
  statusTone,
} from '@sparx/ui';

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
      <CardHeader>
        <Stack direction="row" align="center" justify="between" gap={2} wrap>
          <CardTitle>Marketplace earnings</CardTitle>
          {summary && (
            <Text size="xs" variant="muted">
              {summary.orderCount.toLocaleString()} order{summary.orderCount === 1 ? '' : 's'} all
              time
            </Text>
          )}
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={5}>
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
            <Text size="sm" variant="muted">
              Earnings will appear here once you make your first sale on sparx.market.
            </Text>
          )}

          <Stack gap={2}>
            <Text size="sm" weight="medium">
              Payout history
            </Text>
            {runs.length === 0 ? (
              <Text size="sm" variant="muted">
                No payouts yet. Settlements run weekly — your net (gross minus commission and
                refunds) is sent to your bank account on file.
              </Text>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Payout ref</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {periodLabel(run.periodStart, run.periodEnd)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {run.orderCount.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(run.grossCents, run.currency)}
                        </TableCell>
                        <TableCell className="text-right text-[var(--color-text-secondary)] tabular-nums">
                          {formatMoney(run.commissionCents, run.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(run.netCents, run.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge color={statusTone(run.status)} variant="soft" size="sm">
                            {statusLabel(run.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[var(--color-text-secondary)]">
                          {run.disbursementRef ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
