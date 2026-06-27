// AR aging panel for Finance → Receivables (docs/110 Slice 4c). The full aging
// breakdown across every open billing document — invoicing + B2B in one view. Server
// component, presentational only: the page fetches the report. Balances are dollars
// (the report mirrors Decimal money columns). Past-due buckets read in danger so the
// eye lands on what's actually late.

import { Card, CardContent, CardHeader, CardTitle, Stack, Stat, Text } from '@sparx/ui';

import { fmtDollars } from '../../_lib/format';
import type { AgingReport } from '../actions';

export function ArAgingPanel({ aging }: { aging: AgingReport }) {
  const overdue = aging.buckets
    .filter((b) => b.key !== 'current')
    .reduce((n, b) => n + b.balance, 0);
  const overdueCount = aging.buckets
    .filter((b) => b.key !== 'current')
    .reduce((n, b) => n + b.count, 0);

  return (
    <Card variant="module">
      <CardHeader>
        <Stack direction="row" align="center" justify="between" gap={2} wrap>
          <CardTitle>Accounts receivable</CardTitle>
          <Text size="xs" variant="muted">
            {aging.totalCount} open invoice{aging.totalCount === 1 ? '' : 's'}
          </Text>
        </Stack>
      </CardHeader>
      <CardContent>
        <Stack gap={5}>
          <div className="grid grid-cols-2 gap-3 sm:max-w-lg sm:grid-cols-3">
            <Stat label="Outstanding" value={fmtDollars(aging.totalOutstanding)} />
            <Stat label="Current" value={fmtDollars(aging.totalOutstanding - overdue)} />
            <Stat
              label="Overdue"
              value={fmtDollars(overdue)}
              hint={overdue > 0 ? `${overdueCount} past due` : 'Nothing past due'}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {aging.buckets.map((b) => {
              const pastDue = b.key !== 'current' && b.balance > 0;
              return (
                <div
                  key={b.key}
                  className="flex flex-col gap-0.5 rounded-lg border border-[var(--color-border-default)] p-3"
                >
                  <Text size="xs" variant="muted">
                    {b.label}
                  </Text>
                  <Text
                    size="lg"
                    weight="medium"
                    className={
                      pastDue ? 'text-[var(--color-danger-text)] tabular-nums' : 'tabular-nums'
                    }
                  >
                    {fmtDollars(b.balance)}
                  </Text>
                  <Text size="xs" variant="muted">
                    {b.count} invoice{b.count === 1 ? '' : 's'}
                  </Text>
                </div>
              );
            })}
          </div>
        </Stack>
      </CardContent>
    </Card>
  );
}
