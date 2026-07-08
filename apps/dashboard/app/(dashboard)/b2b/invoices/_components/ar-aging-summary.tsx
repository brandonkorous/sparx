// AR aging summary — the B2B Invoices page pulling the canonical aging report
// (GET /v1/invoicing/aging?scope=b2b) into its own space (docs/87 §8/§14).
//
// Invoicing owns the billing-document substrate; B2B is a consumer. Because
// invoicing is BUNDLED_FREE with B2B, this endpoint answers for any B2B tenant
// with no standalone purchase. Presentational only — the page fetches the report.

import { Card, CardBody } from 'silicaui-react';

export interface AgingBucket {
  key: string;
  label: string;
  count: number;
  balance: number;
}

export interface AgingReport {
  asOf: string;
  buckets: AgingBucket[];
  totalOutstanding: number;
  totalCount: number;
}

function money(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ArAgingSummary({ aging }: { aging: AgingReport }) {
  // Nothing open → the page header already says "All current"; don't add noise.
  if (aging.totalCount === 0) return null;

  return (
    <Card className="bg-module bg-soft">
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">AR aging</p>
            <p className="text-base-content/70 text-xs">
              {money(aging.totalOutstanding)} outstanding · {aging.totalCount} open
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {aging.buckets.map((b) => {
              const pastDue = b.key !== 'current' && b.balance > 0;
              return (
                <div
                  key={b.key}
                  className="flex flex-col gap-0.5 rounded-lg border border-[var(--color-border-default)] p-3"
                >
                  <p className="text-base-content/70 text-xs">{b.label}</p>
                  <p
                    className={
                      pastDue
                        ? 'text-lg font-medium text-[var(--color-danger)] tabular-nums'
                        : 'text-lg font-medium tabular-nums'
                    }
                  >
                    {money(b.balance)}
                  </p>
                  <p className="text-base-content/70 text-xs">
                    {b.count} invoice{b.count === 1 ? '' : 's'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
